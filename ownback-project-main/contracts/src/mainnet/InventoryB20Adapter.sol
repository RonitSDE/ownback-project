// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStockAdapter} from "../IStockAdapter.sol";

interface IStockTotalReturnFeed {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title InventoryB20Adapter — gated Base mainnet pilot inventory dealer
 * @notice Delivers actual pre-acquired, externally verified B20 tokens, NOT newly minted stock.
 *         Vault pays real Base USDC; dealer provides real B20 inventory at a fresh total-return
 *         reference feed price. This is an inventory-priced pilot, NOT a DEX swap or guaranteed
 *         external executable quote. Operational inventory, legal/eligibility, feed and pricing
 *         risks remain with the dealer. Never deploy without legal/security sign-off.
 *
 * @dev Two independent instances MUST be used for Ownback and Shopify vaults: vault is immutable.
 *      Token transfer policies (e.g. sanctions restrictions) are enforced by the B20 token itself;
 *      an offchain eligibility check is still required before presenting rewards to recipients.
 */
contract InventoryB20Adapter is IStockAdapter, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable stockToken;
    address public immutable vault;
    IStockTotalReturnFeed public immutable feed;
    uint8 public immutable stockDecimals;
    uint8 public immutable feedDecimals;
    uint256 public immutable maxPriceAge;
    bool public paused;

    event Paused(bool value);
    event InventoryDelivered(address indexed recipient, uint256 usdcIn, uint256 stockOut);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);
    event InventoryWithdrawn(address indexed recipient, uint256 amount);

    error WrongChain();
    error InvalidConfig();
    error NotVault();
    error WrongStock();
    error PriceUnavailable();
    error AdapterPaused();
    error Slippage();
    error InsufficientInventory();

    address internal constant AAPL_STOCK = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    address internal constant NVDA_STOCK = 0xb20000000000000000000078ee7ce2fE4908108C;
    address internal constant AAPL_FEED = 0x787f13dEa48Db0897CbCDD985de77809D837F988;
    address internal constant NVDA_FEED = 0x04689a41629776563E6822F76f2e57D148d28513;
    address internal constant NATIVE_BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    constructor(address usdc_, address stock_, address vault_, address feed_, uint256 maxAge_)
        Ownable(msg.sender)
    {
        if (block.chainid != 8453) revert WrongChain();
        bool canonicalPair = (stock_ == AAPL_STOCK && feed_ == AAPL_FEED) ||
            (stock_ == NVDA_STOCK && feed_ == NVDA_FEED);
        if (usdc_ != NATIVE_BASE_USDC || !canonicalPair || vault_ == address(0) ||
            maxAge_ == 0 || maxAge_ > 2 hours) revert InvalidConfig();
        // The Coinbase B20 asset address and oracle proxy must be verified from Base's
        // canonical listings, independently, before deployment.
        usdc = IERC20(usdc_);
        stockToken = IERC20(stock_);
        vault = vault_;
        feed = IStockTotalReturnFeed(feed_);
        stockDecimals = IERC20Metadata(stock_).decimals();
        feedDecimals = IStockTotalReturnFeed(feed_).decimals();
        if (stockDecimals > 18 || feedDecimals > 18 || IERC20Metadata(usdc_).decimals() != 6)
            revert InvalidConfig();
        maxPriceAge = maxAge_;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }

    function _readPrice() internal view returns (uint256 price, uint256 timestamp) {
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp ||
            answeredInRound < roundId || block.timestamp - updatedAt > maxPriceAge)
            revert PriceUnavailable();
        price = uint256(answer);
        timestamp = updatedAt;
    }

    /** Compatible with the existing frontend's adapter read ABI; normalized to USDC 6dp. */
    function priceUsdc(address stock) external view returns (uint256) {
        if (stock != address(stockToken)) revert WrongStock();
        (uint256 price,) = _readPrice();
        return Math.mulDiv(price, 1e6, 10 ** feedDecimals);
    }

    function priceUpdatedAt(address stock) external view returns (uint256) {
        if (stock != address(stockToken)) revert WrongStock();
        (,uint256 updatedAt) = _readPrice();
        return updatedAt;
    }

    function quote(address stock, uint256 usdcIn) public view returns (uint256 out) {
        if (paused) revert AdapterPaused();
        if (stock != address(stockToken)) revert WrongStock();
        (uint256 price,) = _readPrice();
        // Source is USD/token including the B20 multiplier (Chainlink total-return feed).
        // USDC has 6 decimals. Both steps round down; no float arithmetic.
        uint256 scaled = Math.mulDiv(usdcIn, 10 ** stockDecimals, 1e6);
        out = Math.mulDiv(scaled, 10 ** feedDecimals, price);
        if (out == 0) revert Slippage();
    }

    function execute(address stock, address recipient, uint256 usdcIn, uint256 minOut)
        external nonReentrant returns (uint256 stockOut)
    {
        if (msg.sender != vault) revert NotVault();
        if (recipient == address(0) || usdcIn == 0 || minOut == 0) revert InvalidConfig();
        stockOut = quote(stock, usdcIn);
        if (stockOut < minOut) revert Slippage();
        if (stockToken.balanceOf(address(this)) < stockOut) revert InsufficientInventory();
        // Atomic: any B20 compliance-policy rejection reverts both payment and delivery.
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        uint256 balanceBefore = stockToken.balanceOf(recipient);
        stockToken.safeTransfer(recipient, stockOut);
        if (stockToken.balanceOf(recipient) - balanceBefore < minOut) revert Slippage();
        emit InventoryDelivered(recipient, usdcIn, stockOut);
    }

    /** Dealer proceeds only; rewards cannot be promised if inventory is not actually present. */
    function withdrawProceeds(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0) || amount == 0) revert InvalidConfig();
        usdc.safeTransfer(recipient, amount);
        emit ProceedsWithdrawn(recipient, amount);
    }

    /** Emergency inventory retrieval is restricted to the explicitly paused state. */
    function withdrawInventory(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (!paused || recipient == address(0) || amount == 0) revert InvalidConfig();
        stockToken.safeTransfer(recipient, amount);
        emit InventoryWithdrawn(recipient, amount);
    }
}
