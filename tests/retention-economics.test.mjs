import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEconomics,
  compareCohorts,
  rewardStage,
  loopTemplates,
} from '../src/lib/retention/economics.ts';
const baseline = {
  orderValue: 50,
  grossMarginPercent: 35,
  firstRewardPercent: 2,
  comebackRewardPercent: 5,
  controlReturnPercent: 9,
  rewardedReturnPercent: 22,
  buyers: 100,
};
test('margin model uses incremental returns, not total reward payouts', () => {
  const x = calculateEconomics(baseline);
  assert.equal(x.incrementalReturns, 13);
  assert.equal(x.incrementalRevenue, 650);
  assert.ok(Math.abs(x.incrementalGrossProfit - 227.5) < 1e-8);
  assert.equal(x.firstRewardCost, 100);
  assert.equal(x.comebackRewardCost, 55);
  assert.ok(Math.abs(x.netContribution - 72.5) < 1e-8);
  assert.ok(Math.abs(x.breakevenRewardedReturnPercent - 17.1666666667) < 0.00001);
});
test('break even handles no viable rate at high reward and low margin', () => {
  const x = calculateEconomics({ ...baseline, grossMarginPercent: 3, comebackRewardPercent: 8 });
  assert.equal(x.breakevenRewardedReturnPercent, null);
});
test('cost per incremental return not faked if no lift', () => {
  const x = calculateEconomics({ ...baseline, rewardedReturnPercent: 8 });
  assert.equal(x.costPerIncrementalReturn, null);
  assert.ok(x.netContribution < 0);
});
test('reject NaN, negatives, impossibly high rates', () => {
  for (const input of [
    { ...baseline, orderValue: NaN },
    { ...baseline, buyers: 0 },
    { ...baseline, firstRewardPercent: 125 },
    { ...baseline, grossMarginPercent: -1 },
  ])
    assert.throws(() => calculateEconomics(input), RangeError);
});
test('cohort comparison requires real denominators and honest exposure labelling', () => {
  assert.equal(
    compareCohorts({
      rewardedBuyers: 40,
      rewardedReturners: 9,
      controlBuyers: 0,
      controlReturners: 0,
      assignedBeforeExposure: false,
    }).available,
    false,
  );
  const r = compareCohorts({
    rewardedBuyers: 40,
    rewardedReturners: 9,
    controlBuyers: 40,
    controlReturners: 4,
    assignedBeforeExposure: false,
  });
  assert.equal(r.available, true);
  assert.ok(r.label.includes('association'));
  assert.equal(r.percentagePointDifference, 12.5);
  assert.throws(() =>
    compareCohorts({
      rewardedBuyers: 10,
      rewardedReturners: 11,
      controlBuyers: 10,
      controlReturners: 1,
      assignedBeforeExposure: true,
    }),
  );
});
test('reward states never equate reserved or email sent with stock owned', () => {
  for (const s of ['HOLD', 'READY', 'CLAIM_SENT', 'CLAIMED', 'SETTLING'])
    assert.notEqual(rewardStage(s), 'owned');
  assert.equal(rewardStage('DELIVERED'), 'owned');
  assert.equal(rewardStage('REFUNDED_AFTER_DELIVERY'), 'liability');
});
test('templates are adjustable proposals, not automatic changes to contract terms', () => {
  assert.equal(loopTemplates.cafe.windowDays, 7);
  assert.equal(loopTemplates.refill.windowDays, 30);
});
