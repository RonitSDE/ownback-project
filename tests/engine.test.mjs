import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialDemoState,
  evaluatePurchase,
  metrics,
  DAY_MS,
  refundPurchase,
  MOCK_STOCK_PRICE_CENTS,
} from '../src/lib/engine.ts';
const now = initialDemoState.now;
const first = (s, customer = 'customerA', order = 'order001', at = now - 2 * DAY_MS) =>
  evaluatePurchase(s, { customerId: customer, orderId: order, orderCents: 4800, timestamp: at });
test('first 2% and returning 5% yield $0.96 and $2.40', () => {
  const a = first(initialDemoState);
  const b = evaluatePurchase(a.next, {
    customerId: 'customerA',
    orderId: 'order002',
    orderCents: 4800,
    timestamp: now,
  });
  assert.equal(a.receipt.rewardCents, 96);
  assert.equal(b.receipt.rewardCents, 240);
  assert.equal(b.next.spentCents, 336);
  assert.equal(metrics(b.next).returningCustomers, 1);
});
test('comeback requires same customer and first reward', () => {
  const a = first(initialDemoState);
  const b = evaluatePurchase(a.next, {
    customerId: 'customerB',
    orderId: 'order002',
    orderCents: 4800,
    timestamp: now,
  });
  assert.equal(b.receipt.kind, 'FIRST');
  assert.equal(b.receipt.rewardCents, 96);
  assert.equal(metrics(b.next).returningCustomers, 0);
});
test('one comeback per customer', () => {
  const a = first(initialDemoState);
  const b = evaluatePurchase(a.next, {
    customerId: 'customerA',
    orderId: 'order002',
    orderCents: 4800,
    timestamp: now - 1 * DAY_MS,
  });
  const c = evaluatePurchase(b.next, {
    customerId: 'customerA',
    orderId: 'order003',
    orderCents: 4800,
    timestamp: now,
  });
  assert.equal(c.receipt.status, 'BLOCKED');
  assert.equal(c.receipt.reason, 'Comeback bonus already claimed');
});
test('seven-day window enforced', () => {
  const a = first(initialDemoState, 'customerA', 'order001', now - 8 * DAY_MS);
  const b = evaluatePurchase(a.next, {
    customerId: 'customerA',
    orderId: 'order002',
    orderCents: 4800,
    timestamp: now,
  });
  assert.equal(b.receipt.status, 'BLOCKED');
  assert.match(b.receipt.reason, /seven-day/);
});
test('duplicate order blocked', () => {
  const a = first(initialDemoState);
  const b = first(a.next);
  assert.equal(b.receipt.status, 'BLOCKED');
  assert.match(b.receipt.reason, /Duplicate/);
});
test('budget and pause enforced', () => {
  const a = first({ ...initialDemoState, budgetCents: 50 });
  assert.equal(a.receipt.status, 'BLOCKED');
  const b = first({ ...initialDemoState, paused: true });
  assert.equal(b.receipt.status, 'BLOCKED');
});
test('mock stock price quantity consistent', () => {
  const a = first(initialDemoState);
  assert.equal(MOCK_STOCK_PRICE_CENTS, 20000);
  assert.equal(a.receipt.stockUnits, 480000);
  assert.equal(a.receipt.stockUnits / 1e8, 0.0048);
});
test('refund flagged without falsely reversing onchain delivery', () => {
  const a = first(initialDemoState);
  const b = refundPurchase(a.next, 'order001');
  assert.equal(b.next.orders[0].status, 'REFUNDED');
  assert.equal(b.next.spentCents, 96);
});
test('max reward cap and invalid amount', () => {
  const a = evaluatePurchase(initialDemoState, {
    customerId: 'customerA',
    orderId: 'order002',
    orderCents: 999999,
    timestamp: now,
  });
  assert.equal(a.receipt.rewardCents, 1000);
  const b = evaluatePurchase(initialDemoState, {
    customerId: 'customerA',
    orderId: 'order003',
    orderCents: -1,
    timestamp: now,
  });
  assert.equal(b.receipt.status, 'BLOCKED');
});

test('requested comeback without any first purchase is explicitly blocked', () => {
  const r = evaluatePurchase(initialDemoState, {
    customerId: 'customerA',
    orderId: 'order001',
    orderCents: 4800,
    attemptKind: 'COMEBACK',
  });
  assert.equal(r.receipt.status, 'BLOCKED');
  assert.match(r.receipt.reason, /First purchase required/);
});

test('historical baseline reward spend counts against merchant budget', () => {
  const s = { ...initialDemoState, budgetCents: 100, initialSpentCents: 50 };
  const r = first(s);
  assert.equal(r.receipt.status, 'BLOCKED');
  assert.equal(metrics(s).remainingCents, 50);
});
test('post-payout refund does not permit another first reward', () => {
  const a = first(initialDemoState);
  const b = refundPurchase(a.next, 'order001');
  const c = evaluatePurchase(b.next, {
    customerId: 'customerA',
    orderId: 'order002',
    orderCents: 4800,
    attemptKind: 'FIRST',
  });
  assert.equal(c.receipt.status, 'BLOCKED');
});
