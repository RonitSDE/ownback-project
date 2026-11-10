// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Ownback} from "../src/Ownback.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {PricedMockStockAdapter} from "../src/mocks/PricedMockStockAdapter.sol";
import {ShopifyRewardVault} from "../src/ShopifyRewardVault.sol";
import {ShopifyTestnetAdapter} from "../src/testnet/ShopifyTestnetAdapter.sol";

/// @notice Deploys the full OWNBACK testnet stack and a funded demo campaign.
///
/// Env:
///   DEPLOYER_PRIVATE_KEY   deployer; becomes contract owner and the demo merchant
///   KEEPER_ADDRESS         keeper wallet (settles rewards, mirrors prices). Defaults to deployer.
///   INITIAL_PRICE_USDC     starting price, USDC 6dp per token. The keeper replaces it with the
///                          live Coinbase nav_price on its first run. Default 100e6.
///   DEMO_BUDGET_USDC       demo campaign budget, 6dp. Default 5,000e6.
contract DeployTestnet is Script {
    /// Covers a normal weekend and a US market holiday weekend (NAV freezes while markets are shut).
    /// Settlement still fails closed beyond this. Testnet only: the mock token has no value.
    uint256 constant PRICE_MAX_AGE = 5 days;

    function run() external {
        require(block.chainid == 31337 || block.chainid == 84532, "TESTNET_ONLY_DEPLOYMENT");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address keeper = vm.envOr("KEEPER_ADDRESS", deployer);
        uint256 price = vm.envOr("INITIAL_PRICE_USDC", uint256(100e6));
        uint128 budget = uint128(vm.envOr("DEMO_BUDGET_USDC", uint256(5_000e6)));

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        MockB20Stock stock = new MockB20Stock("Mock AAPLc (testnet, no value)", "mAAPLc");
        Ownback ob = new Ownback(address(usdc), keeper);
        PricedMockStockAdapter adapter = new PricedMockStockAdapter(address(usdc), address(ob), keeper, PRICE_MAX_AGE);

        stock.setMinter(address(adapter), true);
        ob.setAdapter(address(adapter));
        ob.setStock(address(stock), true);
        adapter.setPrice(address(stock), price, block.timestamp);

        // Demo store: 2% back on the first purchase, 5% on a comeback within 7 days,
        // $10 max reward, $5 minimum order, 10-minute refund hold so a demo can settle live.
        uint256 cid = ob.createCampaign(
            address(stock), 10e6, 5e6, 200, 500, uint64(block.timestamp + 60 days), 10 minutes, 7 days
        );
        usdc.faucet(deployer, budget);
        usdc.approve(address(ob), type(uint256).max); // funding + merchant refunds
        ob.fund(cid, budget);

        // Parallel Shopify lane: buyers pay in Shopify; merchant funds rewards in test USDC.
        // Testnet only: mock token has no equity rights. Same merchant, separate vault.
        uint32 shopifyHold = block.chainid == 31337 ? uint32(0) : uint32(24 hours);
        ShopifyRewardVault shopifyVault = new ShopifyRewardVault(
            address(usdc), address(stock), deployer, keeper, shopifyHold,
            uint64(block.timestamp + 60 days)
        );
        ShopifyTestnetAdapter shopifyAdapter = new ShopifyTestnetAdapter(
            address(usdc), address(shopifyVault), price
        );
        stock.setMinter(address(shopifyAdapter), true);
        shopifyVault.setAdapter(address(shopifyAdapter));
        usdc.faucet(deployer, 1_000e6);
        usdc.approve(address(shopifyVault), 1_000e6);
        shopifyVault.fund(1_000e6);

        vm.stopBroadcast();

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "usdc", address(usdc));
        vm.serializeAddress(key, "stock", address(stock));
        vm.serializeAddress(key, "adapter", address(adapter));
        vm.serializeAddress(key, "ownback", address(ob));
        vm.serializeAddress(key, "merchant", deployer);
        vm.serializeAddress(key, "keeper", keeper);
        vm.serializeUint(key, "campaignId", cid);
        vm.serializeAddress(key, "shopifyRewardVault", address(shopifyVault));
        vm.serializeAddress(key, "shopifyRewardAdapter", address(shopifyAdapter));
        string memory json = vm.serializeUint(key, "deployBlock", block.number);
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));

        console2.log("Ownback ", address(ob));
        console2.log("USDC    ", address(usdc));
        console2.log("Stock   ", address(stock));
        console2.log("Adapter ", address(adapter));
        console2.log("Campaign", cid);
        console2.log("Shopify reward vault", address(shopifyVault));
    }
}
