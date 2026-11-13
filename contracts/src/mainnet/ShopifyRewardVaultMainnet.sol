// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStockAdapter} from "../IStockAdapter.sol";

/**
 * Shopify orders MUST be verified offchain before executor attestation. This vault only accepts a Shopify order
 * attestation from the configured executor, never a public self-reported order.
 * Merchant deposits real Base-native USDC; Shopify buyers are not charged twice.
 * Transfers real stock inventory supplied by an approved separate adapter, not minted shares.
 * Mainnet pilot only: external paid-order verification, legal eligibility checks, monitoring and
 * independent contract audit are REQUIRED; do not interpret compilation as launch approval.
 */
interface IBoundShopifyInventory {
    function vault() external view returns (address);
    function stockToken() external view returns (IERC20);
    function usdc() external view returns (IERC20);
}

contract ShopifyRewardVaultMainnet is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable stock;
    address public immutable merchant;
    address public executor;
    IStockAdapter public adapter;
    uint64 public immutable launchedAt;
    uint64 public immutable expiresAt;
    uint32 public immutable holdSeconds;
    uint32 public constant RETURN_WINDOW = 7 days;
    uint96 public constant MAX_REWARD = 10e6;
    bool public paused;
    uint256 public deposited;
    uint256 public spent;
    uint256 public withdrawn;

    mapping(address => bool) public eligibleRecipient;
    event RecipientEligibilitySet(address indexed wallet,bool eligible);
    mapping(bytes32 => bool) public paidOrder;
    mapping(bytes32 => uint64) public firstPurchaseTime;
    mapping(bytes32 => bool) public comebackPaid;

    event Funded(address indexed merchant,uint256 amount);
    event RewardDelivered(bytes32 indexed orderHash,bytes32 indexed customerHash,address indexed wallet,uint256 usdcReward,uint256 tokenOut,bool comeback);
    event Paused(bool paused);
    event Withdrawn(uint256 amount);

    constructor(address usdc_, address stock_, address merchant_, address executor_, uint32 holdSeconds_,uint64 expiresAt_)
        Ownable(msg.sender) {
        require(block.chainid==8453,"BASE_MAINNET_ONLY");
        require(usdc_==0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,"NATIVE_USDC_ONLY");
        require(stock_==0xb200000000000000000000C2e324d24d7eEcd1fb || stock_==0xb20000000000000000000078ee7ce2fE4908108C,"CANONICAL_B20_ONLY");
        require(holdSeconds_>=24 hours,"MIN_24H_REFUND_HOLD");
        require(usdc_!=address(0)&&stock_!=address(0)&&merchant_!=address(0)&&executor_!=address(0),"ZERO_ADDR");
        require(holdSeconds_<=30 days,"BAD_HOLD");
        require(expiresAt_>block.timestamp && expiresAt_<=block.timestamp+365 days,"BAD_EXPIRY");
        usdc=IERC20(usdc_); stock=IERC20(stock_); merchant=merchant_; executor=executor_;
        holdSeconds=holdSeconds_; launchedAt=uint64(block.timestamp); expiresAt=expiresAt_;
    }

    modifier onlyMerchant(){require(msg.sender==merchant,"MERCHANT_ONLY");_;}
    modifier onlyExecutor(){require(msg.sender==executor,"EXECUTOR_ONLY");_;}

    function setAdapter(address next) external onlyOwner {
        require(next!=address(0)&&IBoundShopifyInventory(next).vault()==address(this)
            &&address(IBoundShopifyInventory(next).stockToken())==address(stock)
            &&address(IBoundShopifyInventory(next).usdc())==address(usdc),"BAD_ADAPTER");
        adapter=IStockAdapter(next);
    }
    /** Set only after external eligibility screening of the real recipient wallet. */
    function setRecipientEligibility(address wallet,bool eligible) external onlyOwner {
        require(wallet!=address(0),"BAD_WALLET");
        eligibleRecipient[wallet]=eligible;
        emit RecipientEligibilitySet(wallet,eligible);
    }
    function setExecutor(address next) external onlyOwner {
        require(next!=address(0),"BAD_EXECUTOR");executor=next;
    }
    function setPaused(bool value) external onlyMerchant {paused=value;emit Paused(value);}
    function fund(uint256 amount) external onlyMerchant nonReentrant {
        require(amount>0,"ZERO_AMOUNT");deposited+=amount;
        usdc.safeTransferFrom(msg.sender,address(this),amount);
        emit Funded(msg.sender,amount);
    }
    function available() public view returns(uint256){return deposited-spent-withdrawn;}
    function quote(uint256 orderValue,bool comeback) public pure returns(uint256){
        uint256 reward=orderValue*(comeback?500:200)/10000;
        return reward>MAX_REWARD?MAX_REWARD:reward;
    }

    function deliver(
        bytes32 orderHash,bytes32 customerHash,address recipient,uint128 orderValue,
        uint64 purchasedAt,bool comeback,uint256 minOut
    ) external onlyExecutor nonReentrant returns(uint256 delivered){
        require(!paused&&block.timestamp<=expiresAt+holdSeconds+7 days,"PAUSED_OR_EXPIRED");
        require(address(adapter)!=address(0),"NO_ADAPTER");
        require(orderHash!=bytes32(0)&&customerHash!=bytes32(0)&&recipient!=address(0),"BAD_IDENTITY");
        require(eligibleRecipient[recipient],"RECIPIENT_NOT_ELIGIBLE");
        require(!paidOrder[orderHash],"DUPLICATE_ORDER");
        require(purchasedAt>=launchedAt&&purchasedAt<=expiresAt&&purchasedAt<=block.timestamp,"BAD_PURCHASE_TIME");
        require(block.timestamp>=uint256(purchasedAt)+holdSeconds,"REFUND_HOLD");
        if(comeback){
            uint64 first=firstPurchaseTime[customerHash];
            require(first!=0&&!comebackPaid[customerHash],"FIRST_REQUIRED_OR_REPEAT_USED");
            require(purchasedAt>first && purchasedAt<=uint256(first)+RETURN_WINDOW,"RETURN_WINDOW");
        }else{
            require(firstPurchaseTime[customerHash]==0,"FIRST_ALREADY_DELIVERED");
        }
        uint256 reward=quote(orderValue,comeback);
        require(reward>0&&reward<=available()&&minOut>0,"BAD_REWARD_OR_BUDGET");
        paidOrder[orderHash]=true;spent+=reward;
        if(comeback)comebackPaid[customerHash]=true;
        else firstPurchaseTime[customerHash]=purchasedAt;
        uint256 beforeBalance=stock.balanceOf(recipient);
        usdc.forceApprove(address(adapter),reward);
        adapter.execute(address(stock),recipient,reward,minOut);
        usdc.forceApprove(address(adapter),0);
        uint256 afterBalance=stock.balanceOf(recipient);
        require(afterBalance>=beforeBalance,"INVALID_STOCK_BALANCE");
        delivered=afterBalance-beforeBalance;
        require(delivered>=minOut,"STOCK_NOT_DELIVERED");
        emit RewardDelivered(orderHash,customerHash,recipient,reward,delivered,comeback);
    }

    // Only after all potential Shopify reward holds and settlement grace periods.
    function withdraw(uint256 amount) external onlyMerchant nonReentrant {
        require(block.timestamp>uint256(expiresAt)+holdSeconds+7 days,"CAMPAIGN_OPEN");
        require(amount>0&&amount<=available(),"BAD_AMOUNT");
        withdrawn+=amount;usdc.safeTransfer(merchant,amount);emit Withdrawn(amount);
    }
}
