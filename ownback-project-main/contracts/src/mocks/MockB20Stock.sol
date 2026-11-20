// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet stand-in for a Coinbase B20 tokenized stock. Zero value, no rights in any company.
/// @dev Mirrors the B20 multiplier model: one token unit is not permanently one share.
///      share-equivalent balance = raw balance * multiplier / 1e18 (see B20 `balanceOfUI`).
contract MockB20Stock is ERC20, Ownable {
    uint256 public multiplier = 1e18;
    mapping(address => bool) public minters;

    event MultiplierUpdated(uint256 previous, uint256 current);
    event MinterSet(address indexed minter, bool allowed);

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(msg.sender) {}

    // Match Coinbase B20 token precision: 8 decimals (multiplier stays 18dp).
    function decimals() public pure override returns (uint8) {
        return 8;
    }

    function setMinter(address m, bool allowed) external onlyOwner {
        minters[m] = allowed;
        emit MinterSet(m, allowed);
    }

    function mint(address to, uint256 amount) external {
        require(minters[msg.sender], "MINTER_ONLY");
        _mint(to, amount);
    }

    /// @notice Mirror a corporate action (dividend reinvestment / split) from the mainnet token.
    function setMultiplier(uint256 next) external onlyOwner {
        require(next > 0, "ZERO_MULTIPLIER");
        emit MultiplierUpdated(multiplier, next);
        multiplier = next;
    }

    function balanceOfUI(address account) external view returns (uint256) {
        return (balanceOf(account) * multiplier) / 1e18;
    }
}
