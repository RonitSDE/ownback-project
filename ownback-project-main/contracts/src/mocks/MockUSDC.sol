// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Testnet USDC with an open faucet. Zero value. Never deploy to mainnet.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_LIMIT = 10_000e6;

    constructor() ERC20("OWNBACK Test USDC (no value)", "tUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet(address to, uint256 amount) external {
        require(amount <= FAUCET_LIMIT, "FAUCET_LIMIT");
        _mint(to, amount);
    }
}
