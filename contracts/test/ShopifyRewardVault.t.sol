// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import "../src/ShopifyRewardVault.sol";
import "../src/testnet/ShopifyTestnetAdapter.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockB20Stock.sol";
contract ShopifyRewardVaultTest is Test {
 ShopifyRewardVault vault;
 ShopifyTestnetAdapter adapter;
 MockUSDC usdc;
 MockB20Stock stock;
 address merchant=address(0xBEEF);
 address executor=address(0xC0FFEE);
 address buyer=address(0xABCD);
 bytes32 customer=keccak256("customer");
 function setUp() public {
  usdc=new MockUSDC();stock=new MockB20Stock("Mock stock","mSTOCK");
  vault=new ShopifyRewardVault(address(usdc),address(stock),merchant,executor,0,uint64(block.timestamp+60 days));
  adapter=new ShopifyTestnetAdapter(address(usdc),address(vault),100e6);
  stock.setMinter(address(adapter),true);vault.setAdapter(address(adapter));
  usdc.faucet(merchant,1000e6);
  vm.startPrank(merchant);usdc.approve(address(vault),1000e6);vault.fund(1000e6);vm.stopPrank();
  vm.warp(block.timestamp+1);
 }
 function firstPurchase() internal {vm.prank(executor);vault.deliver(keccak256("order1"),customer,buyer,100e6,uint64(block.timestamp),false,2e6);}
 function testFirstRewardIsTwoPercentAndDeliveryIsEightDecimals() public {
  firstPurchase();assertEq(stock.balanceOf(buyer),2e6);assertEq(vault.spent(),2e6);
 }
 function testOnlyOneComeback() public {
  firstPurchase();vm.warp(block.timestamp+1 days);
  vm.prank(executor);vault.deliver(keccak256("order2"),customer,buyer,100e6,uint64(block.timestamp),true,5e6);
  assertEq(stock.balanceOf(buyer),7e6);
  vm.prank(executor);vm.expectRevert(bytes("FIRST_REQUIRED_OR_REPEAT_USED"));
  vault.deliver(keccak256("order3"),customer,buyer,100e6,uint64(block.timestamp),true,5e6);
 }
 function testNoUnauthorizedSettlement() public {
  vm.expectRevert(bytes("EXECUTOR_ONLY"));
  vault.deliver(keccak256("order1"),customer,buyer,100e6,uint64(block.timestamp),false,2e6);
 }
 function testNoComebackWithoutFirst() public {
  vm.prank(executor);vm.expectRevert(bytes("FIRST_REQUIRED_OR_REPEAT_USED"));
  vault.deliver(keccak256("order2"),customer,buyer,100e6,uint64(block.timestamp),true,5e6);
 }
 function testDuplicateOrderRejected() public {
  firstPurchase();vm.prank(executor);vm.expectRevert(bytes("DUPLICATE_ORDER"));
  vault.deliver(keccak256("order1"),customer,buyer,100e6,uint64(block.timestamp),false,2e6);
 }
 function testSlippageRevertsFundsAndHistory() public {
  bytes32 order=keccak256("order1");vm.prank(executor);vm.expectRevert(bytes("SLIPPAGE"));
  vault.deliver(order,customer,buyer,100e6,uint64(block.timestamp),false,3e6);
  assertEq(vault.spent(),0);assertEq(vault.paidOrder(order),false);
 }
 function testMerchantCannotWithdrawEarly() public {
  vm.prank(merchant);vm.expectRevert(bytes("CAMPAIGN_OPEN"));vault.withdraw(5e6);
 }
}
