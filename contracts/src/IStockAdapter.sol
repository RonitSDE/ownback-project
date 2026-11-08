// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Converts a USDC reward into a tokenized stock delivered to a recipient.
/// @dev Testnet uses PricedMockStockAdapter. A mainnet adapter would route USDC to a
///      B20 tokenized-stock pool (e.g. Aerodrome / Uniswap) with an oracle-bounded minOut.
interface IStockAdapter {
    /// @return stockOut Expected stock units for `usdcIn` at the adapter's current price.
    function quote(address stock, uint256 usdcIn) external view returns (uint256 stockOut);

    /// @dev Pulls `usdcIn` from msg.sender and delivers stock to `recipient`. Must revert below `minOut`.
    function execute(address stock, address recipient, uint256 usdcIn, uint256 minOut)
        external
        returns (uint256 stockOut);
}
