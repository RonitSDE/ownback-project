// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OwnbackMainnet} from "../src/mainnet/OwnbackMainnet.sol";
import {InventoryB20Adapter} from "../src/mainnet/InventoryB20Adapter.sol";
import {ShopifyRewardVaultMainnet} from "../src/mainnet/ShopifyRewardVaultMainnet.sol";

/**
 * Mainnet pilot deployment, deliberately NOT a one-click go-live.
 * 1. Verify BASE_STOCK_ADDRESS and BASE_STOCK_FEED against base.org/stocks and docs.base.org.
 * 2. Sign off legal eligibility, pricing, custody, audit and deployment ownership.
 * 3. Set MAINNET_DEPLOY_APPROVED=true explicitly and fund the deployer with ETH only.
 * 4. Campaign creation, USDC funding, B20 inventory acquisition and adapter deposits are
 *    separate, manually approved transactions. NO funds or stock are minted in this script.
 * 5. KEEP the public checkout/settlement services disabled until post-deploy reconciliation.
 */
contract DeployMainnet is Script {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        require(block.chainid == 8453, "BASE_MAINNET_ONLY");
        require(vm.envBool("MAINNET_DEPLOY_APPROVED"), "LAUNCH_NOT_APPROVED");
        uint256 deployerPK = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address keeper = vm.envAddress("KEEPER_ADDRESS");
        address merchant = vm.envAddress("MERCHANT_ADDRESS");
        address executor = vm.envAddress("SHOPIFY_EXECUTOR_ADDRESS");
        address b20 = vm.envAddress("BASE_STOCK_ADDRESS");
        address feed = vm.envAddress("BASE_STOCK_FEED");
        uint256 maxAge = vm.envOr("MAINNET_MAX_PRICE_AGE_SECONDS", uint256(5400));
        uint32 refundHold = uint32(vm.envOr("MAINNET_SHOPIFY_HOLD_SECONDS", uint256(86400)));
        uint64 expiresAt = uint64(block.timestamp + vm.envOr("MAINNET_CAMPAIGN_DURATION_SECONDS", uint256(30 days)));
        require(keeper != address(0) && merchant != address(0) && executor != address(0)
            && b20 != address(0) && feed != address(0), "MISSING_PARTIES_OR_ASSETS");
        require(expiresAt > block.timestamp && expiresAt <= block.timestamp + 365 days, "BAD_EXPIRY");

        vm.startBroadcast(deployerPK);
        OwnbackMainnet ownback = new OwnbackMainnet(USDC, keeper, b20);
        ShopifyRewardVaultMainnet shopify = new ShopifyRewardVaultMainnet(
            USDC, b20, merchant, executor, refundHold, expiresAt
        );
        InventoryB20Adapter nativeAdapter = new InventoryB20Adapter(USDC, b20, address(ownback), feed, maxAge);
        InventoryB20Adapter shopifyAdapter = new InventoryB20Adapter(USDC, b20, address(shopify), feed, maxAge);
        ownback.setAdapter(address(nativeAdapter));
        ownback.setStock(b20, true);
        shopify.setAdapter(address(shopifyAdapter));
        // Ownership MUST be moved to production multisigs after deployment.
        vm.stopBroadcast();

        console2.log("CHAIN 8453: BASE MAINNET; NO STOCK OR USDC AUTOMATICALLY FUNDED");
        console2.log("Ownback native checkout", address(ownback));
        console2.log("Native B20 adapter", address(nativeAdapter));
        console2.log("Shopify reward vault", address(shopify));
        console2.log("Shopify B20 adapter", address(shopifyAdapter));
        console2.log("USDC", USDC);
        console2.log("Verified B20 (operator-supplied)", b20);
        console2.log("Verified feed (operator-supplied)", feed);
        console2.log("Merchant must create/fund campaign, acquire real B20 and stock BOTH adapters separately");
    }
}
