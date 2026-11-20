// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockB20Stock} from "../mocks/MockB20Stock.sol";
import {IStockAdapter} from "../IStockAdapter.sol";
/** Fixed-price synthetic stock for local testing. No underlying equity or real market pricing. */
contract ShopifyTestnetAdapter is IStockAdapter {
    using SafeERC20 for IERC20;
    IERC20 public immutable usdc;
    address public immutable vault;
    uint256 public immutable priceUsdc;
    constructor(address usdc_,address vault_,uint256 priceUsdc_) {
        require(usdc_!=address(0)&&vault_!=address(0)&&priceUsdc_>0,"BAD_INIT");
        usdc=IERC20(usdc_);vault=vault_;priceUsdc=priceUsdc_;
    }
    function quote(address,uint256 usdcIn) public view returns(uint256){
        return usdcIn*1e8/priceUsdc;
    }
    function execute(address stock,address recipient,uint256 usdcIn,uint256 minOut) external returns(uint256 amount){
        require(msg.sender==vault,"VAULT_ONLY");
        amount=quote(stock,usdcIn);
        require(amount>=minOut&&amount>0,"SLIPPAGE");
        usdc.safeTransferFrom(msg.sender,address(this),usdcIn);
        MockB20Stock(stock).mint(recipient,amount);
    }
}
