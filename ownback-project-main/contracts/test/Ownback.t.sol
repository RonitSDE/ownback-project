// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownback} from "../src/Ownback.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {PricedMockStockAdapter} from "../src/mocks/PricedMockStockAdapter.sol";

contract OwnbackTest is Test {
    Ownback ob;
    MockUSDC usdc;
    MockB20Stock stock;
    PricedMockStockAdapter adapter;

    address merchant = makeAddr("merchant");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");
    uint256 cid;
    uint256 testOrderNonce;

    uint256 constant PRICE = 200e6; // $200 per stock token
    uint32 constant HOLD = 1 days;
    uint32 constant WINDOW = 7 days;

    function setUp() public {
        usdc = new MockUSDC();
        stock = new MockB20Stock("Mock AAPLc (testnet, no value)", "mAAPLc");
        ob = new Ownback(address(usdc), keeper);
        adapter = new PricedMockStockAdapter(address(usdc), address(ob), keeper, 1 days);
        stock.setMinter(address(adapter), true);
        ob.setAdapter(address(adapter));
        ob.setStock(address(stock), true);
        vm.prank(keeper);
        adapter.setPrice(address(stock), PRICE, block.timestamp);

        cid = _campaign(1_000e6);

        usdc.faucet(alice, 1_000e6);
        usdc.faucet(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(ob), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(ob), type(uint256).max);
    }

    // ---------------------------------------------------------------- helpers

    function _campaign(uint128 budget) internal returns (uint256 id) {
        vm.startPrank(merchant);
        id = ob.createCampaign(
            address(stock), 10e6, 5e6, 200, 500, uint64(vm.getBlockTimestamp() + 30 days), HOLD, WINDOW
        );
        usdc.faucet(merchant, budget);
        usdc.approve(address(ob), type(uint256).max); // funding + refunds
        if (budget > 0) ob.fund(id, budget);
        vm.stopPrank();
    }

    function _warp(uint256 secs) internal {
        vm.warp(vm.getBlockTimestamp() + secs);
        vm.prank(keeper);
        adapter.setPrice(address(stock), PRICE, block.timestamp); // keep the price fresh unless a test opts out
    }

    function _pay(address who, uint128 amount) internal returns (uint256 pid) {
        vm.prank(who);
        pid = ob.pay(
            cid, amount, keccak256(abi.encode(cid, who, ++testOrderNonce)), 1, uint64(block.timestamp + 15 minutes)
        );
    }

    function _settle(address who, uint256 pid) internal returns (uint256) {
        Ownback.Purchase memory p = ob.getPurchase(pid);
        uint256 q = adapter.quote(address(stock), p.reward);
        vm.prank(who);
        return ob.settle(pid, q);
    }

    // -------------------------------------------------------------- happy path

    function testFirstPurchasePaysMerchantAndReservesReward() public {
        uint256 before = usdc.balanceOf(merchant);
        uint256 pid = _pay(alice, 48e6);
        Ownback.Purchase memory p = ob.getPurchase(pid);
        assertEq(uint8(p.kind), uint8(Ownback.Kind.FIRST));
        assertEq(p.reward, 0.96e6); // 2% of $48
        assertEq(usdc.balanceOf(merchant) - before, 48e6, "merchant paid in full");
        assertEq(ob.getCampaign(cid).reserved, 0.96e6);
        assertEq(ob.available(cid), 1_000e6 - 0.96e6);
    }

    function testSettleAfterHoldDeliversStockToPayer() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        uint256 delivered = _settle(alice, pid);
        assertEq(delivered, 0.0048e8); // $0.96 / $200
        assertEq(stock.balanceOf(alice), 0.0048e8);
        Ownback.Campaign memory c = ob.getCampaign(cid);
        assertEq(c.spent, 0.96e6);
        assertEq(c.reserved, 0);
        assertEq(uint8(ob.getPurchase(pid).status), uint8(Ownback.Status.REWARDED));
    }

    function testComebackWithinWindowEarnsHigherRate() public {
        uint256 first = _pay(alice, 48e6);
        _warp(2 days);
        uint256 back = _pay(alice, 48e6);
        Ownback.Purchase memory p = ob.getPurchase(back);
        assertEq(uint8(p.kind), uint8(Ownback.Kind.COMEBACK));
        assertEq(p.reward, 2.4e6); // 5% of $48
        _warp(HOLD); // the comeback has its own refund hold
        _settle(alice, first);
        _settle(alice, back);
        assertEq(stock.balanceOf(alice), 0.0048e8 + 0.012e8);
    }

    function testKeeperCanSettleForCustomer() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        _settle(keeper, pid);
        assertEq(stock.balanceOf(alice), 0.0048e8, "stock goes to payer, not keeper");
        assertEq(stock.balanceOf(keeper), 0);
    }

    // ------------------------------------------------------------- eligibility

    function testSettleBeforeHoldReverts() public {
        uint256 pid = _pay(alice, 48e6);
        vm.prank(alice);
        vm.expectRevert(Ownback.RefundHold.selector);
        ob.settle(pid, 1);
    }

    function testComebackCannotSettleBeforeFirst() public {
        _pay(alice, 48e6);
        _warp(2 days);
        uint256 back = _pay(alice, 48e6);
        _warp(HOLD); // both purchases are past their hold; only ordering blocks the comeback
        vm.prank(alice);
        vm.expectRevert(Ownback.FirstNotSettled.selector);
        ob.settle(back, 1);
    }

    function testOnlyOneComeback() public {
        _pay(alice, 48e6);
        _warp(1 days);
        _pay(alice, 48e6);
        _warp(1 days);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(alice, 48e6);
    }

    function testComebackOutsideWindowEarnsNothing() public {
        _pay(alice, 48e6);
        _warp(WINDOW + 1);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(alice, 48e6);
    }

    function testSameBlockRepeatIsNotAComeback() public {
        _pay(alice, 48e6);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(alice, 48e6);
    }

    function testMinOrderAndMaxRewardCap() public {
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(alice, 4e6); // below $5 min order
        uint256 big = _pay(bob, 900e6); // 2% = $18, capped at $10
        assertEq(ob.getPurchase(big).reward, 10e6);
    }

    function testOrderRefIsUniquePerPayer() public {
        bytes32 ref = keccak256("order-1");
        vm.prank(alice);
        ob.pay(cid, 10e6, ref, 1, uint64(block.timestamp + 15 minutes));
        vm.prank(alice);
        vm.expectRevert(Ownback.OrderRefUsed.selector);
        ob.pay(cid, 10e6, ref, 0, uint64(block.timestamp + 15 minutes));
    }

    function testOrderRefCannotBeGriefedByAnotherPayer() public {
        // Bob front-runs Alice's pending checkout with her reference and a dust payment.
        bytes32 aliceRef = keccak256("alice-pending-checkout");
        vm.prank(bob);
        ob.pay(cid, 1, aliceRef, 0, uint64(block.timestamp + 15 minutes));
        // Alice's checkout still executes with her full reward.
        vm.prank(alice);
        uint256 pid = ob.pay(cid, 48e6, aliceRef, 960_000, uint64(block.timestamp + 15 minutes));
        assertEq(ob.getPurchase(pid).reward, 960_000);
    }

    function testExplicitNoRewardPaymentGoesThroughWhilePaused() public {
        vm.prank(merchant);
        ob.setPaused(cid, true);
        uint256 before = usdc.balanceOf(merchant);
        uint256 reservedBefore = ob.getCampaign(cid).reserved;
        vm.prank(alice);
        uint256 pid = ob.pay(cid, 48e6, keccak256("accepted-no-reward"), 0, uint64(block.timestamp + 15 minutes));
        Ownback.Purchase memory p = ob.getPurchase(pid);
        assertEq(uint8(p.kind), uint8(Ownback.Kind.NONE));
        assertEq(p.reward, 0);
        assertEq(usdc.balanceOf(merchant) - before, 48e6, "merchant still paid");
        assertEq(ob.getCampaign(cid).reserved, reservedBefore, "nothing reserved");
    }

    function testNoRewardOrderDoesNotConsumeFirstPurchaseSlot() public {
        vm.prank(alice);
        ob.pay(cid, 4e6, keccak256("small"), 0, uint64(block.timestamp + 15 minutes)); // under $5 minimum
        uint256 pid = _pay(alice, 48e6);
        assertEq(uint8(ob.getPurchase(pid).kind), uint8(Ownback.Kind.FIRST));
    }

    function testThirdOrderNeedsExplicitOptIn() public {
        _pay(alice, 48e6);
        _warp(1 days);
        _pay(alice, 48e6);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(alice, 48e6); // shown no reward, floor 1 -> refused
        vm.prank(alice);
        uint256 pid = ob.pay(cid, 48e6, keccak256("third-opt-in"), 0, uint64(block.timestamp + 15 minutes));
        assertEq(ob.getPurchase(pid).reward, 0);
    }

    function testNoRewardPurchaseCannotSettleButCanRefund() public {
        vm.prank(alice);
        uint256 pid = ob.pay(cid, 4e6, keccak256("tiny"), 0, uint64(block.timestamp + 15 minutes));
        _warp(HOLD);
        vm.prank(alice);
        vm.expectRevert(Ownback.NoReward.selector);
        ob.settle(pid, 1);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(merchant);
        ob.refund(pid);
        assertEq(usdc.balanceOf(alice) - before, 4e6);
    }

    function testOwnershipTransferIsTwoStep() public {
        address newOwner = makeAddr("newOwner");
        ob.transferOwnership(newOwner);
        assertEq(ob.owner(), address(this), "not transferred until accepted");
        vm.prank(newOwner);
        ob.acceptOwnership();
        assertEq(ob.owner(), newOwner);
    }

    function testPausedCampaignRevertsWithoutChargingCustomer() public {
        vm.prank(merchant);
        ob.setPaused(cid, true);
        uint256 before = usdc.balanceOf(merchant);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(alice, 48e6);
        assertEq(usdc.balanceOf(merchant), before);
    }

    function testMerchantPauseDoesNotCancelEarnedReward() public {
        uint256 pid = _pay(alice, 48e6);
        vm.prank(merchant);
        ob.setPaused(cid, true);
        _warp(HOLD);
        _settle(alice, pid); // reserved rewards stay payable
        assertEq(stock.balanceOf(alice), 0.0048e8);
    }

    function testGlobalPauseBlocksSettlement() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        ob.setGlobalPause(true);
        vm.prank(alice);
        vm.expectRevert(Ownback.Paused.selector);
        ob.settle(pid, 1);
    }

    // ------------------------------------------------------------------ budget

    function testBudgetExhaustionStopsNewRewards() public {
        cid = _campaign(1e6); // $1 budget
        uint256 a = _pay(alice, 48e6); // reserves $0.96
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        _pay(bob, 48e6); // $0.96 does not fit in $0.04
        assertEq(ob.getPurchase(a).reward, 0.96e6);
    }

    function testWithdrawCannotTouchReservedRewards() public {
        _pay(alice, 48e6);
        uint256 free = ob.available(cid);
        vm.startPrank(merchant);
        vm.expectRevert(Ownback.BadParams.selector);
        ob.withdraw(cid, uint128(free + 1));
        ob.withdraw(cid, uint128(free));
        vm.stopPrank();
        _warp(HOLD);
        _settle(alice, 1); // reserved reward still delivered after full withdrawal
        assertEq(stock.balanceOf(alice), 0.0048e8);
    }

    // ----------------------------------------------------------------- refunds

    function testRefundBeforeSettleReturnsMoneyAndVoidsComeback() public {
        uint256 first = _pay(alice, 48e6);
        _warp(1 days);
        uint256 back = _pay(alice, 48e6);
        assertEq(ob.getCampaign(cid).reserved, 0.96e6 + 2.4e6);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(merchant);
        ob.refund(first);
        assertEq(usdc.balanceOf(alice) - before, 48e6, "customer refunded");
        assertEq(ob.getCampaign(cid).reserved, 0, "both reservations released");
        assertEq(uint8(ob.getPurchase(back).kind), uint8(Ownback.Kind.NONE), "dependent comeback voided");

        vm.prank(alice);
        vm.expectRevert(Ownback.WrongStatus.selector);
        ob.settle(first, 1);
    }

    function testRefundAfterRewardIsFlaggedAndComebackStillPays() public {
        uint256 first = _pay(alice, 48e6);
        _warp(HOLD);
        _settle(alice, first);
        uint256 back = _pay(alice, 48e6);
        vm.prank(merchant);
        ob.refund(first);
        assertEq(uint8(ob.getPurchase(first).status), uint8(Ownback.Status.REFUNDED_AFTER_REWARD));
        _warp(HOLD);
        _settle(alice, back);
        assertEq(uint8(ob.getPurchase(back).status), uint8(Ownback.Status.REWARDED));
    }

    function testCannotRefundTwice() public {
        uint256 pid = _pay(alice, 48e6);
        vm.startPrank(merchant);
        ob.refund(pid);
        vm.expectRevert(Ownback.WrongStatus.selector);
        ob.refund(pid);
        vm.stopPrank();
    }

    function testReleaseStaleReservation() public {
        uint256 pid = _pay(alice, 48e6);
        vm.prank(merchant);
        vm.expectRevert(Ownback.NotStale.selector);
        ob.releaseStale(pid);
        _warp(HOLD + 30 days);
        vm.prank(merchant);
        ob.releaseStale(pid);
        assertEq(ob.getCampaign(cid).reserved, 0);
    }

    // ----------------------------------------------------------- access + safety

    function testOnlyCustomerOrKeeperCanSettle() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        vm.prank(bob);
        vm.expectRevert(Ownback.NotAuthorized.selector);
        ob.settle(pid, 1);
    }

    function testOnlyMerchantCanRefundOrWithdraw() public {
        uint256 pid = _pay(alice, 48e6);
        vm.startPrank(bob);
        vm.expectRevert(Ownback.MerchantOnly.selector);
        ob.refund(pid);
        vm.expectRevert(Ownback.MerchantOnly.selector);
        ob.withdraw(cid, 1);
        vm.stopPrank();
    }

    function testSettleTwiceReverts() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        _settle(alice, pid);
        vm.prank(alice);
        vm.expectRevert(Ownback.WrongStatus.selector);
        ob.settle(pid, 1);
    }

    function testStalePriceFailsClosed() public {
        uint256 pid = _pay(alice, 48e6);
        vm.warp(vm.getBlockTimestamp() + 2 days); // no price refresh
        vm.prank(alice);
        vm.expectRevert(bytes("STALE_PRICE"));
        ob.settle(pid, 1);
        vm.prank(keeper);
        adapter.setPrice(address(stock), PRICE, block.timestamp);
        _settle(alice, pid);
    }

    function testSlippageGuard() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        vm.prank(alice);
        vm.expectRevert(bytes("SLIPPAGE"));
        ob.settle(pid, 0.0048e8 + 1);
    }

    function testUnlistedStockCannotBeCampaigned() public {
        MockB20Stock other = new MockB20Stock("x", "x");
        vm.prank(merchant);
        vm.expectRevert(Ownback.StockDisabled.selector);
        ob.createCampaign(address(other), 10e6, 0, 200, 500, uint64(vm.getBlockTimestamp() + 1 days), 0, 1 days);
    }

    function testMultiplierShareEquivalent() public {
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        _settle(alice, pid);
        stock.setMultiplier(1.01e18); // mirrored dividend reinvestment
        assertEq(stock.balanceOfUI(alice), (0.0048e8 * 1.01e18) / 1e18);
    }

    // -------------------------------------------------------------------- fuzz

    function testFuzzRewardBoundedAndBudgetConserved(uint128 a1, uint128 a2, uint32 gap) public {
        a1 = uint128(bound(a1, 5e6, 400e6));
        a2 = uint128(bound(a2, 5e6, 400e6));
        gap = uint32(bound(gap, 1, 6 days));
        usdc.faucet(alice, 2_000e6);

        uint256 p1 = _pay(alice, a1);
        vm.warp(vm.getBlockTimestamp() + gap);
        uint256 p2 = _pay(alice, a2);

        Ownback.Purchase memory x = ob.getPurchase(p1);
        Ownback.Purchase memory y = ob.getPurchase(p2);
        assertLe(x.reward, 10e6);
        assertLe(y.reward, 10e6);
        assertLe(uint256(x.reward), (uint256(a1) * 200) / 10_000);
        assertLe(uint256(y.reward), (uint256(a2) * 500) / 10_000);

        Ownback.Campaign memory c = ob.getCampaign(cid);
        assertEq(uint256(c.funded), uint256(c.spent) + c.reserved + c.withdrawn + ob.available(cid));
        assertEq(c.reserved, uint256(x.reward) + y.reward);
    }

    function testCannotAcceptZeroCheckoutReference() public {
        uint256 before = usdc.balanceOf(merchant);
        vm.prank(alice);
        vm.expectRevert(Ownback.InvalidOrderRef.selector);
        ob.pay(cid, 48e6, bytes32(0), 960_000, uint64(block.timestamp + 15 minutes));
        assertEq(usdc.balanceOf(merchant), before);
    }

    function testQuoteDeadlineAndRewardFloor() public {
        uint256 before = usdc.balanceOf(merchant);
        vm.prank(alice);
        vm.expectRevert(Ownback.QuoteExpired.selector);
        ob.pay(cid, 48e6, keccak256("expired"), 960_000, uint64(block.timestamp - 1));
        vm.prank(alice);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        ob.pay(cid, 48e6, keccak256("min-too-high"), 960_001, uint64(block.timestamp + 15 minutes));
        assertEq(usdc.balanceOf(merchant), before);
    }

    function testPauseBetweenPreviewAndPaymentNeverChargesCustomer() public {
        (, uint128 promised) = ob.previewReward(cid, alice, 48e6);
        assertEq(promised, 960_000);
        vm.prank(merchant);
        ob.setPaused(cid, true);
        uint256 before = usdc.balanceOf(merchant);
        vm.prank(alice);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        ob.pay(cid, 48e6, keccak256("checkout-paused"), promised, uint64(block.timestamp + 15 minutes));
        assertEq(usdc.balanceOf(merchant), before);
    }

    function testWithdrawalBetweenPreviewAndPaymentNeverChargesCustomer() public {
        (, uint128 promised) = ob.previewReward(cid, alice, 48e6);
        vm.prank(merchant);
        ob.withdraw(cid, 1_000e6);
        uint256 before = usdc.balanceOf(merchant);
        vm.prank(alice);
        vm.expectRevert(Ownback.RewardBelowMinimum.selector);
        ob.pay(cid, 48e6, keccak256("checkout-withdrawn"), promised, uint64(block.timestamp + 15 minutes));
        assertEq(usdc.balanceOf(merchant), before);
    }

    function testReplayNeverChargesCustomerAgain() public {
        bytes32 order = keccak256("same-invoice");
        vm.prank(alice);
        ob.pay(cid, 48e6, order, 960_000, uint64(block.timestamp + 15 minutes));
        uint256 merchantBalance = usdc.balanceOf(merchant);
        vm.prank(alice);
        vm.expectRevert(Ownback.OrderRefUsed.selector);
        ob.pay(cid, 48e6, order, 960_000, uint64(block.timestamp + 15 minutes));
        assertEq(usdc.balanceOf(merchant), merchantBalance);
    }

    function testRejectFutureSourceTimestamp() public {
        vm.prank(keeper);
        vm.expectRevert(bytes("FUTURE_OR_BAD_SOURCE_TIME"));
        adapter.setPrice(address(stock), PRICE, vm.getBlockTimestamp() + 1);
    }

    function testKeeperCannotRestampOlderPriceAsNewer() public {
        uint256 t = vm.getBlockTimestamp();
        vm.warp(t + 1 hours);
        vm.prank(keeper);
        adapter.setPrice(address(stock), PRICE, t + 30 minutes);
        vm.prank(keeper);
        vm.expectRevert(bytes("SOURCE_TIME_REGRESSION"));
        adapter.setPrice(address(stock), PRICE + 1, t + 10 minutes);
    }

    function testRejectStaleUpstreamPriceTimestamp() public {
        vm.warp(block.timestamp + 2 days);
        vm.prank(keeper);
        vm.expectRevert(bytes("STALE_SOURCE_PRICE"));
        adapter.setPrice(address(stock), PRICE, block.timestamp - 2 days);
    }

    function testStockEightDecimalsAndMultiplier() public {
        assertEq(stock.decimals(), 8);
        uint256 pid = _pay(alice, 48e6);
        _warp(HOLD);
        _settle(alice, pid);
        assertEq(stock.balanceOf(alice), 480_000); // 0.0048 * 1e8
        stock.setMultiplier(1.02e18);
        assertEq(stock.balanceOfUI(alice), 489_600);
        stock.setMultiplier(2e18);
        assertEq(stock.balanceOfUI(alice), 960_000);
    }
}
