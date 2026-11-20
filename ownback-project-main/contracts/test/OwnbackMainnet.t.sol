// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {OwnbackMainnet} from "../src/mainnet/OwnbackMainnet.sol";
import {InventoryB20Adapter} from "../src/mainnet/InventoryB20Adapter.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";

/// Chainlink-style total-return feed mock for the adapter.
contract MockFeed {
    uint8 public decimals = 8;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public round = 1;

    constructor(int256 a) {
        answer = a;
        updatedAt = block.timestamp;
    }

    function set(int256 a, uint256 t) external {
        answer = a;
        updatedAt = t;
        round++;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (round, answer, updatedAt, updatedAt, round);
    }
}

/// Covers the mainnet-specific surface: the canonical-address/chain guards, the recipient
/// eligibility (KYC) gate on pay and settle, bound-inventory delivery via the total-return
/// adapter, stale-feed fail-closed, and inventory exhaustion. Core campaign/comeback/refund
/// logic is shared with Ownback.sol (covered by Ownback.t.sol).
contract OwnbackMainnetTest is Test {
    // Canonical Base addresses hardcoded in the contracts under test.
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant AAPL = 0xb200000000000000000000C2e324d24d7eEcd1fb;
    address constant AAPL_FEED = 0x787f13dEa48Db0897CbCDD985de77809D837F988;

    OwnbackMainnet ob;
    InventoryB20Adapter adapter;
    MockUSDC usdc;
    MockB20Stock stock;
    MockFeed feed;

    address merchant = makeAddr("merchant");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 cid;
    uint32 constant WINDOW = 7 days;
    uint32 constant HOLD = 24 hours; // mainnet enforces a 24h minimum refund hold

    function setUp() public {
        vm.chainId(8453);

        // Etch mocks at the canonical addresses the contracts require.
        deployCodeTo("MockUSDC.sol:MockUSDC", USDC);
        deployCodeTo("MockB20Stock.sol:MockB20Stock", abi.encode("AAPLc", "AAPLc"), AAPL);
        // AAPL total-return reference ~ $230, 8-decimal feed. deployCodeTo runs the
        // constructor at the target address so storage (decimals, answer) is initialized
        // — vm.etch copies code only and would leave decimals() reading zero.
        deployCodeTo("OwnbackMainnet.t.sol:MockFeed", abi.encode(int256(230e8)), AAPL_FEED);

        usdc = MockUSDC(USDC);
        stock = MockB20Stock(AAPL);
        feed = MockFeed(AAPL_FEED);

        ob = new OwnbackMainnet(USDC, keeper, AAPL);
        adapter = new InventoryB20Adapter(USDC, AAPL, address(ob), AAPL_FEED, 1 hours);

        ob.setAdapter(address(adapter));
        ob.setStock(AAPL, true);

        // Pre-fund the dealer adapter with real B20 inventory.
        stock.setMinter(address(this), true);
        stock.mint(address(adapter), 1_000e8);

        // Merchant funds a campaign (2% first, 5% comeback, $10 cap, $5 min, 10m hold, 7d window).
        usdc.faucet(merchant, 10_000e6);
        vm.startPrank(merchant);
        usdc.approve(address(ob), type(uint256).max);
        cid = ob.createCampaign(AAPL, 10e6, 5e6, 200, 500, uint64(block.timestamp + 60 days), HOLD, WINDOW);
        ob.fund(cid, 5_000e6);
        vm.stopPrank();

        // Fund customers and set allowances.
        usdc.faucet(alice, 1_000e6);
        usdc.faucet(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(ob), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(ob), type(uint256).max);
    }

    function _pay(address who, uint128 amount) internal returns (uint256 id) {
        vm.prank(who);
        id = ob.pay(cid, amount, keccak256(abi.encode(who, amount, block.timestamp, gasleft())), 1, uint64(block.timestamp + 15 minutes));
    }

    /// Warp past the refund hold and keep the oracle fresh, as a live keeper would.
    function _afterHoldFreshFeed() internal {
        vm.warp(block.timestamp + HOLD + 1);
        feed.set(230e8, block.timestamp);
    }

    // --------------------------------------------------- constructor guards

    function testConstructorRejectsWrongChain() public {
        vm.chainId(1);
        vm.expectRevert(OwnbackMainnet.BadParams.selector);
        new OwnbackMainnet(USDC, keeper, AAPL);
    }

    function testConstructorRejectsNonCanonicalStock() public {
        vm.expectRevert(OwnbackMainnet.BadParams.selector);
        new OwnbackMainnet(USDC, keeper, address(0xdead));
    }

    function testAdapterRejectsWrongChain() public {
        vm.chainId(1);
        vm.expectRevert(InventoryB20Adapter.WrongChain.selector);
        new InventoryB20Adapter(USDC, AAPL, address(ob), AAPL_FEED, 1 hours);
    }

    // --------------------------------------------------- eligibility gate

    function testPayRequiresEligibleRecipient() public {
        // alice is not on the allowlist.
        vm.prank(alice);
        vm.expectRevert(OwnbackMainnet.RecipientNotEligible.selector);
        ob.pay(cid, 48e6, keccak256("x"), 1, uint64(block.timestamp + 15 minutes));
    }

    function testEligibilityCanBeRevokedBeforeSettlement() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        ob.setRecipientEligibility(alice, false);
        vm.warp(block.timestamp + HOLD + 1);
        vm.prank(alice);
        vm.expectRevert(OwnbackMainnet.RecipientNotEligible.selector);
        ob.settle(pid, 1);
    }

    function testOnlyOwnerSetsEligibility() public {
        vm.prank(alice);
        vm.expectRevert();
        ob.setRecipientEligibility(alice, true);
    }

    // --------------------------------------------------- happy path delivery

    function testFirstPurchaseDeliversRealInventory() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6); // 2% => $0.96 reserved
        assertEq(ob.getPurchase(pid).reward, 0.96e6);

        _afterHoldFreshFeed();
        uint256 adapterInvBefore = stock.balanceOf(address(adapter));

        vm.prank(alice);
        uint256 delivered = ob.settle(pid, 1);

        // Delivery measured from the customer balance.
        assertEq(stock.balanceOf(alice), delivered);
        assertGt(delivered, 0);
        // Inventory left the dealer; the vault paid USDC for it.
        assertEq(stock.balanceOf(address(adapter)), adapterInvBefore - delivered);
        assertEq(usdc.balanceOf(address(adapter)), 0.96e6);
    }

    function testComebackAfterFirstSettlesHigherReward() public {
        ob.setRecipientEligibility(alice, true);
        uint256 first = _pay(alice, 48e6);
        _afterHoldFreshFeed();
        vm.prank(alice);
        ob.settle(first, 1);

        vm.warp(block.timestamp + 1 days);
        uint256 back = _pay(alice, 48e6); // 5% => $2.40
        assertEq(ob.getPurchase(back).reward, 2.40e6);
        _afterHoldFreshFeed();
        vm.prank(alice);
        uint256 delivered = ob.settle(back, 1);
        assertGt(delivered, 0);
    }

    // --------------------------------------------------- adapter safety

    function testSettleFailsClosedOnStaleFeed() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        vm.warp(block.timestamp + HOLD + 1);
        // Let the feed age past maxPriceAge (1 hour).
        vm.warp(block.timestamp + 2 hours);
        vm.prank(alice);
        vm.expectRevert(InventoryB20Adapter.PriceUnavailable.selector);
        ob.settle(pid, 1);
    }

    function testSettleRevertsWhenInventoryExhausted() public {
        ob.setRecipientEligibility(alice, true);
        // Drain the dealer inventory (emergency withdraw requires the paused state), then resume.
        adapter.setPaused(true);
        adapter.withdrawInventory(address(this), stock.balanceOf(address(adapter)));
        adapter.setPaused(false);
        uint256 pid = _pay(alice, 48e6);
        _afterHoldFreshFeed();
        vm.prank(alice);
        vm.expectRevert(InventoryB20Adapter.InsufficientInventory.selector);
        ob.settle(pid, 1);
    }

    function testSlippageFloorHonored() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        _afterHoldFreshFeed();
        // Demand far more stock than $0.96 can buy.
        vm.prank(alice);
        vm.expectRevert(InventoryB20Adapter.Slippage.selector);
        ob.settle(pid, 1_000e8);
    }

    // --------------------------------------------------- adversarial accounting / authorization

    function testAttackerCannotSettleAnotherCustomersReward() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        _afterHoldFreshFeed();
        vm.prank(bob);
        vm.expectRevert(OwnbackMainnet.NotAuthorized.selector);
        ob.settle(pid, 1);
    }

    function testDuplicateSettlementCannotSpendBudgetAgain() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        _afterHoldFreshFeed();
        vm.prank(alice);
        ob.settle(pid, 1);
        uint256 customerStock = stock.balanceOf(alice);
        OwnbackMainnet.Campaign memory c = ob.getCampaign(cid);
        vm.prank(alice);
        vm.expectRevert(OwnbackMainnet.WrongStatus.selector);
        ob.settle(pid, 1);
        OwnbackMainnet.Campaign memory afterAttempt = ob.getCampaign(cid);
        assertEq(stock.balanceOf(alice), customerStock);
        assertEq(afterAttempt.spent, c.spent);
        assertEq(afterAttempt.reserved, c.reserved);
    }

    function testRefundReleasesReservationAndCannotBeReplayed() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(merchant);
        ob.refund(pid);
        OwnbackMainnet.Campaign memory c = ob.getCampaign(cid);
        assertEq(c.reserved, 0);
        assertEq(c.spent, 0);
        assertEq(usdc.balanceOf(alice), before + 48e6);
        vm.prank(merchant);
        vm.expectRevert(OwnbackMainnet.WrongStatus.selector);
        ob.refund(pid);
    }

    function testBudgetExhaustionCannotSilentlyDowngradeReward() public {
        ob.setRecipientEligibility(alice, true);
        vm.prank(merchant);
        ob.withdraw(cid, 4_999e6);
        uint256 before = usdc.balanceOf(alice);
        bytes32 ref = keccak256("insufficient-budget");
        vm.prank(alice);
        vm.expectRevert(OwnbackMainnet.RewardBelowMinimum.selector);
        ob.pay(cid, 100e6, ref, 2e6, uint64(block.timestamp + 15 minutes));
        assertEq(usdc.balanceOf(alice), before);
        assertFalse(ob.orderRefUsed(cid, alice, ref));
    }

    function testMerchantCannotWithdrawPromisedReservation() public {
        ob.setRecipientEligibility(alice, true);
        _pay(alice, 48e6);
        uint256 freeBudget = ob.available(cid);
        vm.prank(merchant);
        vm.expectRevert(OwnbackMainnet.BadParams.selector);
        ob.withdraw(cid, uint128(freeBudget + 1));
    }

    function testRefundingFirstVoidsPendingComebackReservation() public {
        ob.setRecipientEligibility(alice, true);
        uint256 first = _pay(alice, 48e6);
        vm.warp(block.timestamp + 1);
        uint256 comeback = _pay(alice, 48e6);
        assertEq(ob.getPurchase(comeback).reward, 2.40e6);
        vm.prank(merchant);
        ob.refund(first);
        OwnbackMainnet.Campaign memory c = ob.getCampaign(cid);
        assertEq(c.reserved, 0);
        assertEq(ob.getPurchase(comeback).reward, 0);
        assertEq(uint256(ob.getPurchase(comeback).kind), uint256(OwnbackMainnet.Kind.NONE));
        vm.warp(block.timestamp + HOLD + 1);
        vm.prank(alice);
        vm.expectRevert(OwnbackMainnet.NoReward.selector);
        ob.settle(comeback, 1);
    }

    function testOracleFutureTimestampFailsClosed() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        vm.warp(block.timestamp + HOLD + 1);
        feed.set(230e8, block.timestamp + 60);
        vm.prank(alice);
        vm.expectRevert(InventoryB20Adapter.PriceUnavailable.selector);
        ob.settle(pid, 1);
    }

    // --------------------------------------------------- orderRef per payer

    function testOrderRefIsPerPayer() public {
        ob.setRecipientEligibility(alice, true);
        ob.setRecipientEligibility(bob, true);
        bytes32 ref = keccak256("shared");
        vm.prank(alice);
        ob.pay(cid, 10e6, ref, 1, uint64(block.timestamp + 15 minutes));
        // bob can reuse the same ref string; namespaced by payer.
        vm.prank(bob);
        ob.pay(cid, 10e6, ref, 1, uint64(block.timestamp + 15 minutes));
        // alice cannot reuse her own.
        vm.prank(alice);
        vm.expectRevert(OwnbackMainnet.OrderRefUsed.selector);
        ob.pay(cid, 10e6, ref, 0, uint64(block.timestamp + 15 minutes));
    }

    function testKeeperCanSettleForEligibleCustomer() public {
        ob.setRecipientEligibility(alice, true);
        uint256 pid = _pay(alice, 48e6);
        _afterHoldFreshFeed();
        vm.prank(keeper);
        uint256 delivered = ob.settle(pid, 1);
        assertEq(stock.balanceOf(alice), delivered);
    }
}
