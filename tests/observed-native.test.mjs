import test from 'node:test';
import assert from 'node:assert/strict';
import { observedNative } from '../src/lib/retention/observed-native.ts';
const row = (customer, paidAt, status = 0, kind = 1) => ({
  customer,
  paidAt,
  status,
  kind,
  reward: 1000000n,
  amount: 50000000n,
});
test('counts genuine campaign-local repeat purchases by wallet and first paid timestamp', () => {
  const t = 1_800_000_000;
  const result = observedNative([
    row('0xA', t),
    row('0xA', t + 3 * 86400, 1, 2),
    row('0xB', t),
    row('0xB', t + 15 * 86400, 1, 2),
    row('0xC', t),
  ]);
  assert.deepEqual(result, {
    customers: 3,
    returners: 2,
    repeat7d: 1,
    repeat30d: 2,
    paidOrders: 5,
    firstOrders: 3,
    comebackRewardOrders: 2,
  });
});
test('refunds and unconfirmed rows never boost observed return', () => {
  const t = 1_800_000_000;
  const result = observedNative([
    row('0xA', t),
    row('0xA', t + 86400, 2, 2),
    row('0xB', t, 3),
    row('0xC', 0),
  ]);
  assert.equal(result.customers, 1);
  assert.equal(result.returners, 0);
  assert.equal(result.paidOrders, 1);
});
test('repeats with zero reward still count as repeat purchases', () => {
  const t = 1_800_000_000;
  const result = observedNative([row('0xA', t), row('0xA', t + 2 * 86400, 0, 0)]);
  assert.equal(result.returners, 1);
  assert.equal(result.comebackRewardOrders, 0);
});
