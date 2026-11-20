// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IStockAdapter} from "../IStockAdapter.sol";
import {MockB20Stock} from "./MockB20Stock.sol";

/// @notice Testnet adapter. Sells mock stock at a price the keeper mirrors from the live
///         Coinbase Tokenized Stocks API (`nav_price`). Refuses to trade on a stale price.
contract PricedMockStockAdapter is IStockAdapter, Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable vault;
    address public priceKeeper;
    uint256 public maxPriceAge;

    /// stock => USDC (6 decimals) per one whole stock token
    mapping(address => uint256) public priceUsdc;
    mapping(address => uint256) public priceUpdatedAt;

    event PriceUpdated(address indexed stock, uint256 priceUsdc, uint256 sourceTimestamp);
    event PriceKeeperSet(address indexed keeper);
    event MaxPriceAgeSet(uint256 previous, uint256 current);

    constructor(address usdc_, address vault_, address keeper_, uint256 maxPriceAge_) Ownable(msg.sender) {
        require(usdc_ != address(0) && vault_ != address(0), "BAD_INIT");
        usdc = IERC20(usdc_);
        vault = vault_;
        priceKeeper = keeper_;
        maxPriceAge = maxPriceAge_;
    }

    /// @notice Zero is allowed: only the owner can then publish prices.
    function setPriceKeeper(address k) external onlyOwner {
        priceKeeper = k;
        emit PriceKeeperSet(k);
    }

    function setMaxPriceAge(uint256 age) external onlyOwner {
        emit MaxPriceAgeSet(maxPriceAge, age);
        maxPriceAge = age;
    }

    /// @notice Publish an upstream price while preserving its ORIGINAL observation timestamp.
    ///         It is impossible to re-stamp a stale quote as current.
    function setPrice(address stock, uint256 price, uint256 sourceTimestamp) external {
        require(msg.sender == priceKeeper || msg.sender == owner(), "KEEPER_ONLY");
        require(price > 0, "ZERO_PRICE");
        require(sourceTimestamp > 0 && sourceTimestamp <= block.timestamp, "FUTURE_OR_BAD_SOURCE_TIME");
        require(block.timestamp - sourceTimestamp <= maxPriceAge, "STALE_SOURCE_PRICE");
        require(sourceTimestamp >= priceUpdatedAt[stock], "SOURCE_TIME_REGRESSION");
        priceUsdc[stock] = price;
        priceUpdatedAt[stock] = sourceTimestamp;
        emit PriceUpdated(stock, price, sourceTimestamp);
    }

    function quote(address stock, uint256 usdcIn) public view returns (uint256) {
        uint256 price = priceUsdc[stock];
        require(price > 0, "NO_PRICE");
        require(block.timestamp - priceUpdatedAt[stock] <= maxPriceAge, "STALE_PRICE");
        return (usdcIn * 10 ** IERC20Metadata(stock).decimals()) / price;
    }

    function execute(address stock, address recipient, uint256 usdcIn, uint256 minOut) external returns (uint256 out) {
        require(msg.sender == vault, "VAULT_ONLY");
        out = quote(stock, usdcIn);
        require(out >= minOut && out > 0, "SLIPPAGE");
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        MockB20Stock(stock).mint(recipient, out);
    }

    /// @notice Testnet proceeds sweep.
    function sweep(address to) external onlyOwner {
        usdc.safeTransfer(to, usdc.balanceOf(address(this)));
    }
}
