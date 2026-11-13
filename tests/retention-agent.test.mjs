import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeRetentionPolicy } from '../src/lib/retention/agent.ts';
const base = {
  firstOrders: 100,
  expectedRepeatOrders: 20,
  averageOrderUsd: 50,
  firstRewardPercent: 2,
  desiredComebackPercent: 5,
  grossMarginPercent: 35,
  merchantBudgetUsd: 200,
};
test('merchant agent: never exceeds merchant budget or requested cashback', () => {
  const result = proposeRetentionPolicy(base);
  assert.equal(result.verdict, 'PROPOSED');
  assert.equal(result.proposedComebackPercent, 5);
  assert.equal(result.projectedTotalCommitmentUsd, 150);
  assert.equal(result.unusedBudgetUsd, 50);
});
test('merchant agent: reduces comeback within a hard budget, never silently increases', () => {
  const result = proposeRetentionPolicy({ ...base, merchantBudgetUsd: 115 });
  assert.equal(result.verdict, 'PROPOSED');
  assert.equal(result.proposedComebackPercent, 1.5);
  assert.ok(result.projectedTotalCommitmentUsd <= 115);
});
test('merchant agent: refuses unfunded first rewards, zero returns, margin violations', () => {
  for (const scenario of [
    { merchantBudgetUsd: 99 },
    { expectedRepeatOrders: 0 },
    { grossMarginPercent: 1 },
    { firstOrders: -1 },
    { desiredComebackPercent: 101 },
    { merchantBudgetUsd: NaN },
  ])
    assert.equal(proposeRetentionPolicy({ ...base, ...scenario }).verdict, 'REFUSED');
});
test('merchant agent: caps per reward at $10 and never claims causal improvement', () => {
  const result = proposeRetentionPolicy({
    ...base,
    averageOrderUsd: 1000,
    merchantBudgetUsd: 2000,
    expectedRepeatOrders: 10,
  });
  assert.equal(result.firstRewardCommitmentUsd, 1000);
  assert.equal(result.verdict, 'PROPOSED');
  assert.ok(result.safeguards.some((t) => t.includes('do not prove incremental lift')));
});
