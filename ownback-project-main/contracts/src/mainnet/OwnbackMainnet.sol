// Mainnet-specific allowlisted derivative of the v3.7 Ownback checkout.
// Generated once from the audited-candidate source; keep in sync intentionally.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStockAdapter} from "../IStockAdapter.sol";

/// @title OWNBACK — checkout that pays customers back in tokenized stock
/// @notice Customers pay merchants in USDC through this contract. The payment itself is the
///         purchase proof: no off-chain order feed, no claim links. Each campaign rewards a
///         customer's first purchase and one comeback purchase inside a return window.
///         Rewards are reserved from the merchant's budget at payment time, released after a
///         refund hold, and delivered as tokenized stock to the paying wallet.
interface IBoundB20Inventory {
    function vault() external view returns (address);
    function stockToken() external view returns (IERC20);
    function usdc() external view returns (IERC20);
}

contract OwnbackMainnet is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Kind {
        NONE,
        FIRST,
        COMEBACK
    }

    enum Status {
        PAID,
        REWARDED,
        REFUNDED,
        REFUNDED_AFTER_REWARD
    }

    struct Campaign {
        address merchant;
        address stock;
        uint128 funded;
        uint128 spent;
        uint128 reserved;
        uint128 withdrawn;
        uint96 maxReward;
        uint96 minOrder;
        uint16 firstBps;
        uint16 comebackBps;
        uint64 expiresAt;
        uint32 holdSeconds;
        uint32 returnWindow;
        bool paused;
    }

    struct Purchase {
        uint256 campaignId;
        address customer;
        uint128 amount;
        uint128 reward;
        uint64 paidAt;
        Kind kind;
        Status status;
        bytes32 orderRef;
    }

    uint256 public constant MAX_HOLD = 30 days;
    uint256 public constant MAX_WINDOW = 90 days;
    uint256 public constant STALE_AFTER = 30 days;

    mapping(address => bool) public eligibleRecipient;
    event RecipientEligibilitySet(address indexed wallet, bool eligible);
    error RecipientNotEligible();
    address public immutable approvedStock;
    address internal constant AAPL_STOCK = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    address internal constant NVDA_STOCK = 0xb20000000000000000000078ee7ce2fE4908108C;
    IERC20 public immutable usdc;
    IStockAdapter public adapter;
    address public keeper;
    bool public globallyPaused;

    uint256 public nextCampaignId = 1;
    uint256 public nextPurchaseId = 1;

    mapping(address => bool) public allowStock;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Purchase) public purchases;
    /// campaignId => customer => purchaseId of their reward-eligible first purchase
    mapping(uint256 => mapping(address => uint256)) public firstPurchaseOf;
    /// campaignId => customer => purchaseId of their reward-eligible comeback purchase
    mapping(uint256 => mapping(address => uint256)) public comebackPurchaseOf;
    /// campaignId => payer => orderRef => used. Scoped per payer so nobody can burn another
    /// customer's pending checkout reference by front-running it with a tiny payment.
    mapping(uint256 => mapping(address => mapping(bytes32 => bool))) public orderRefUsed;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed merchant,
        address indexed stock,
        uint16 firstBps,
        uint16 comebackBps,
        uint96 maxReward,
        uint64 expiresAt
    );
    event CampaignFunded(uint256 indexed campaignId, uint256 amount);
    event CampaignPaused(uint256 indexed campaignId, bool paused);
    event Withdrawn(uint256 indexed campaignId, uint256 amount);
    event Purchased(
        uint256 indexed purchaseId,
        uint256 indexed campaignId,
        address indexed customer,
        uint256 amount,
        Kind kind,
        uint256 rewardReserved,
        bytes32 orderRef
    );
    event Refunded(uint256 indexed purchaseId, uint256 amount, bool afterReward);
    event RewardVoided(uint256 indexed purchaseId, uint256 releasedReward);
    event RewardDelivered(
        uint256 indexed purchaseId,
        uint256 indexed campaignId,
        address indexed customer,
        address stock,
        uint256 rewardUsdc,
        uint256 stockDelivered,
        Kind kind
    );
    event AdapterSet(address indexed adapter);
    event KeeperSet(address indexed keeper);
    event StockAllowed(address indexed stock, bool allowed);
    event GlobalPause(bool paused);

    error NoCampaign();
    error MerchantOnly();
    error NotAuthorized();
    error BadParams();
    error ZeroAmount();
    error OrderRefUsed();
    error InvalidOrderRef();
    error RewardBelowMinimum();
    error QuoteExpired();
    error WrongStatus();
    error NoReward();
    error RefundHold();
    error FirstNotSettled();
    error StockDisabled();
    error Paused();
    error InsufficientBudget();
    error InsufficientDelivery();
    error NotStale();

    constructor(address usdc_, address keeper_, address stock_) Ownable(msg.sender) {
        if (block.chainid != 8453 || usdc_ != 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) revert BadParams();
        if (stock_ != AAPL_STOCK && stock_ != NVDA_STOCK) revert BadParams();
        approvedStock = stock_;
        usdc = IERC20(usdc_);
        keeper = keeper_;
    }

    // ------------------------------------------------------------------ admin

    function setAdapter(address a) external onlyOwner {
        if (a == address(0) || IBoundB20Inventory(a).vault() != address(this) ||
            address(IBoundB20Inventory(a).stockToken()) != approvedStock ||
            address(IBoundB20Inventory(a).usdc()) != address(usdc)) revert BadParams();
        adapter = IStockAdapter(a);
        emit AdapterSet(a);
    }

    /// @notice Zero is allowed and disables keeper settlement; customers can always settle their own rewards.
    function setKeeper(address k) external onlyOwner {
        keeper = k;
        emit KeeperSet(k);
    }

    function setStock(address stock, bool allowed) external onlyOwner {
        if (stock != approvedStock) revert BadParams();
        allowStock[stock] = allowed;
        emit StockAllowed(stock, allowed);
    }

    /// @notice Emergency stop for new rewards and settlement. Explicit no-reward payments and refunds keep working.
    function setGlobalPause(bool paused) external onlyOwner {
        globallyPaused = paused;
        emit GlobalPause(paused);
    }

    /** Recipient allowlist is operated only after jurisdictional/issuer eligibility verification.
     * Owner MUST be a multisig. This is NOT a substitute for legal compliance assessment. */
    function setRecipientEligibility(address wallet, bool eligible) external onlyOwner {
        if (wallet == address(0)) revert BadParams();
        eligibleRecipient[wallet] = eligible;
        emit RecipientEligibilitySet(wallet, eligible);
    }

    // --------------------------------------------------------------- merchant

    function createCampaign(
        address stock,
        uint96 maxReward,
        uint96 minOrder,
        uint16 firstBps,
        uint16 comebackBps,
        uint64 expiresAt,
        uint32 holdSeconds,
        uint32 returnWindow
    ) external returns (uint256 id) {
        if (!allowStock[stock]) revert StockDisabled();
        if (maxReward == 0) revert BadParams();
        if (firstBps == 0 || comebackBps < firstBps || comebackBps > 10_000) revert BadParams();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + 365 days) revert BadParams();
        if (holdSeconds < 24 hours || holdSeconds > MAX_HOLD || returnWindow == 0 || returnWindow > MAX_WINDOW) revert BadParams();

        id = nextCampaignId++;
        Campaign storage c = campaigns[id];
        c.merchant = msg.sender;
        c.stock = stock;
        c.maxReward = maxReward;
        c.minOrder = minOrder;
        c.firstBps = firstBps;
        c.comebackBps = comebackBps;
        c.expiresAt = expiresAt;
        c.holdSeconds = holdSeconds;
        c.returnWindow = returnWindow;
        emit CampaignCreated(id, msg.sender, stock, firstBps, comebackBps, maxReward, expiresAt);
    }

    function fund(uint256 id, uint128 amount) external nonReentrant {
        Campaign storage c = _merchantCampaign(id);
        if (amount == 0) revert ZeroAmount();
        c.funded += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit CampaignFunded(id, amount);
    }

    function setPaused(uint256 id, bool paused) external {
        Campaign storage c = _merchantCampaign(id);
        c.paused = paused;
        emit CampaignPaused(id, paused);
    }

    /// @notice Merchants can withdraw any budget not reserved for a customer, at any time.
    ///         Reserved rewards are already promised to customers and stay locked.
    function withdraw(uint256 id, uint128 amount) external nonReentrant {
        Campaign storage c = _merchantCampaign(id);
        if (amount == 0 || amount > available(id)) revert BadParams();
        c.withdrawn += amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(id, amount);
    }

    /// @notice Refund a purchase. The merchant returns the USDC (needs allowance to this contract).
    ///         Before settlement the reserved reward is released; after settlement the stock already
    ///         delivered is not clawed back, and the refund is flagged for the merchant's records.
    function refund(uint256 purchaseId) external nonReentrant {
        Purchase storage p = purchases[purchaseId];
        Campaign storage c = _merchantCampaign(p.campaignId);

        bool afterReward = false;
        if (p.status == Status.PAID) {
            p.status = Status.REFUNDED;
            if (p.kind != Kind.NONE) _releaseReward(c, p, purchaseId);
        } else if (p.status == Status.REWARDED) {
            p.status = Status.REFUNDED_AFTER_REWARD;
            afterReward = true;
        } else {
            revert WrongStatus();
        }

        // msg.sender is the merchant (enforced by _merchantCampaign).
        usdc.safeTransferFrom(msg.sender, p.customer, p.amount);
        emit Refunded(purchaseId, p.amount, afterReward);
    }

    /// @notice Release a reward reservation nobody settled for STALE_AFTER past its hold.
    function releaseStale(uint256 purchaseId) external {
        Purchase storage p = purchases[purchaseId];
        Campaign storage c = _merchantCampaign(p.campaignId);
        if (p.status != Status.PAID || p.kind == Kind.NONE) revert WrongStatus();
        if (block.timestamp < uint256(p.paidAt) + c.holdSeconds + STALE_AFTER) revert NotStale();
        _releaseReward(c, p, purchaseId);
    }

    // --------------------------------------------------------------- customer

    /// @notice Pay a merchant through OWNBACK. All checks run before any USDC moves.
    /// @param orderRef     Client-generated idempotency key, unique per payer and campaign. A retried
    ///                     submission with the same key reverts instead of charging twice.
    /// @param minRewardUsdc The reward the customer was shown. If the live reward is lower (budget used
    ///                     up, campaign paused, window closed) the whole payment reverts: OWNBACK never
    ///                     silently downgrades a promised reward. Pass 0 only when the customer has
    ///                     explicitly accepted an order with no reward.
    /// @param quoteDeadline Unix time after which this checkout can no longer execute (max 1 hour ahead).
    function pay(uint256 campaignId, uint128 amount, bytes32 orderRef, uint128 minRewardUsdc, uint64 quoteDeadline)
        external
        nonReentrant
        returns (uint256 purchaseId)
    {
        Campaign storage c = campaigns[campaignId];
        if (!eligibleRecipient[msg.sender]) revert RecipientNotEligible();
        if (c.merchant == address(0)) revert NoCampaign();
        if (amount == 0) revert ZeroAmount();
        if (orderRef == bytes32(0)) revert InvalidOrderRef();
        if (quoteDeadline < block.timestamp || quoteDeadline > block.timestamp + 1 hours) revert QuoteExpired();
        if (orderRefUsed[campaignId][msg.sender][orderRef]) revert OrderRefUsed();

        (Kind kind, uint128 reward) = previewReward(campaignId, msg.sender, amount);
        if (reward < minRewardUsdc) revert RewardBelowMinimum();

        orderRefUsed[campaignId][msg.sender][orderRef] = true;
        purchaseId = nextPurchaseId++;
        if (kind == Kind.FIRST) firstPurchaseOf[campaignId][msg.sender] = purchaseId;
        else if (kind == Kind.COMEBACK) comebackPurchaseOf[campaignId][msg.sender] = purchaseId;
        if (reward > 0) c.reserved += reward;

        purchases[purchaseId] = Purchase({
            campaignId: campaignId,
            customer: msg.sender,
            amount: amount,
            reward: reward,
            paidAt: uint64(block.timestamp),
            kind: kind,
            status: Status.PAID,
            orderRef: orderRef
        });

        usdc.safeTransferFrom(msg.sender, c.merchant, amount);
        emit Purchased(purchaseId, campaignId, msg.sender, amount, kind, reward, orderRef);
    }

    /// @notice Deliver a reserved reward as tokenized stock once the refund hold has passed.
    ///         Callable by the customer (who protects their own minOut) or the keeper.
    function settle(uint256 purchaseId, uint256 minStockOut) external nonReentrant returns (uint256 delivered) {
        Purchase storage p = purchases[purchaseId];
        if (msg.sender != p.customer && msg.sender != keeper) revert NotAuthorized();
        if (!eligibleRecipient[p.customer]) revert RecipientNotEligible();
        if (p.status != Status.PAID) revert WrongStatus();
        if (p.kind == Kind.NONE || p.reward == 0) revert NoReward();
        if (globallyPaused) revert Paused();
        if (minStockOut == 0) revert BadParams();

        Campaign storage c = campaigns[p.campaignId];
        if (block.timestamp < uint256(p.paidAt) + c.holdSeconds) revert RefundHold();
        if (!allowStock[c.stock] || address(adapter) == address(0)) revert StockDisabled();
        if (p.kind == Kind.COMEBACK) {
            // The first reward must have been delivered. A refund issued after that delivery
            // does not undo the comeback, which was itself a real repeat purchase.
            Status fs = purchases[firstPurchaseOf[p.campaignId][p.customer]].status;
            if (fs != Status.REWARDED && fs != Status.REFUNDED_AFTER_REWARD) revert FirstNotSettled();
        }

        p.status = Status.REWARDED;
        c.reserved -= p.reward;
        c.spent += p.reward;

        IERC20 stock = IERC20(c.stock);
        // Delivery is measured from the customer's balance, not taken from the adapter's own report.
        // settle is nonReentrant and the adapter is owner-configured, so the pre-call read can't go stale.
        uint256 before = stock.balanceOf(p.customer);
        usdc.forceApprove(address(adapter), p.reward);
        // slither-disable-next-line unused-return,reentrancy-balance
        adapter.execute(c.stock, p.customer, p.reward, minStockOut);
        usdc.forceApprove(address(adapter), 0);
        delivered = stock.balanceOf(p.customer) - before;
        if (delivered < minStockOut) revert InsufficientDelivery();

        emit RewardDelivered(purchaseId, p.campaignId, p.customer, c.stock, p.reward, delivered, p.kind);
    }

    // ------------------------------------------------------------------ views

    /// @notice What a payment of `amount` by `customer` would earn right now.
    function previewReward(uint256 campaignId, address customer, uint128 amount)
        public
        view
        returns (Kind kind, uint128 reward)
    {
        Campaign storage c = campaigns[campaignId];
        if (!eligibleRecipient[customer]) return (Kind.NONE, 0);
        if (c.merchant == address(0)) return (Kind.NONE, 0);
        if (globallyPaused || c.paused || block.timestamp >= c.expiresAt || amount < c.minOrder) {
            return (Kind.NONE, 0);
        }

        uint256 firstId = firstPurchaseOf[campaignId][customer];
        uint16 bps = 0;
        if (firstId == 0) {
            kind = Kind.FIRST;
            bps = c.firstBps;
        } else if (comebackPurchaseOf[campaignId][customer] == 0) {
            Purchase storage f = purchases[firstId];
            bool live = f.status == Status.PAID || f.status == Status.REWARDED;
            if (live && block.timestamp > f.paidAt && block.timestamp <= uint256(f.paidAt) + c.returnWindow) {
                kind = Kind.COMEBACK;
                bps = c.comebackBps;
            }
        }
        if (kind == Kind.NONE) return (Kind.NONE, 0);

        uint256 r = (uint256(amount) * bps) / 10_000;
        if (r > c.maxReward) r = c.maxReward;
        if (r == 0 || r > available(campaignId)) return (Kind.NONE, 0);
        // Safe: r <= maxReward, which is a uint96.
        // forge-lint: disable-next-line(unsafe-typecast)
        reward = uint128(r);
    }

    /// @notice Budget free to reserve for new rewards or withdraw.
    function available(uint256 id) public view returns (uint256) {
        Campaign storage c = campaigns[id];
        return uint256(c.funded) - c.spent - c.reserved - c.withdrawn;
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return campaigns[id];
    }

    function getPurchase(uint256 id) external view returns (Purchase memory) {
        return purchases[id];
    }

    // --------------------------------------------------------------- internal

    function _merchantCampaign(uint256 id) private view returns (Campaign storage c) {
        c = campaigns[id];
        if (c.merchant == address(0)) revert NoCampaign();
        if (msg.sender != c.merchant) revert MerchantOnly();
    }

    /// @dev Releases a pending reward. Refunding a first purchase also voids a pending comeback
    ///      that depended on it, so its reservation cannot get stuck.
    function _releaseReward(Campaign storage c, Purchase storage p, uint256 purchaseId) private {
        uint128 released = p.reward;
        c.reserved -= released;
        p.reward = 0;

        if (p.kind == Kind.FIRST) {
            if (firstPurchaseOf[p.campaignId][p.customer] == purchaseId) {
                delete firstPurchaseOf[p.campaignId][p.customer];
            }
            uint256 cbId = comebackPurchaseOf[p.campaignId][p.customer];
            if (cbId != 0) {
                Purchase storage cb = purchases[cbId];
                if (cb.status == Status.PAID && cb.reward > 0) {
                    c.reserved -= cb.reward;
                    emit RewardVoided(cbId, cb.reward);
                    cb.reward = 0;
                    cb.kind = Kind.NONE;
                }
                delete comebackPurchaseOf[p.campaignId][p.customer];
            }
        } else if (p.kind == Kind.COMEBACK) {
            if (comebackPurchaseOf[p.campaignId][p.customer] == purchaseId) {
                delete comebackPurchaseOf[p.campaignId][p.customer];
            }
        }
        p.kind = Kind.NONE;
        emit RewardVoided(purchaseId, released);
    }
}
