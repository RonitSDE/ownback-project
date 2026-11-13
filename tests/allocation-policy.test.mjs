import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocationApprovalMessage,
  buildAllocationProposal,
  validateAllocationInput,
} from '../src/lib/allocation/policy.ts';
const defaults = {
  rewardUsd: 2,
  theme: 'technology',
  preferredStock: 'AUTO',
  excludedSymbols: [],
  maxSingleWeightPercent: 100,
  cashReservePercent: 0,
};
const caps = { settlementStock: 'AAPLc', chainId: 84532 };
const plan = (p = {}, ctx = caps) => buildAllocationProposal({ ...defaults, ...p }, ctx);
test('happy path is single-stock proposal, not a trade or guaranteed reward', () => {
  const p = plan();
  assert.equal(p.status, 'proposed');
  assert.equal(p.stock, 'AAPLc');
  assert.equal(p.stockWeightPercent, 100);
  assert.equal(p.executionStatus, 'NOT_EXECUTED');
  assert.match(p.approvalMeaning, /not an investment order/i);
  assert.equal(p.sources.length, 2);
  assert.ok(p.facts.some((s) => s.includes('one token')));
});
test('hard refusal: missing settlement lane, not silent default', () => {
  const p = plan({}, { settlementStock: null, chainId: 8453 });
  assert.equal(p.status, 'refused');
  assert.match(p.reasons.join(' '), /No settlement stock/);
});
test('hard refusal: unavailable robotics and energy assets', () => {
  for (const theme of ['robotics', 'energy']) assert.equal(plan({ theme }).status, 'refused');
});
test('hard refusal: stock excluded, wrong sector, or wrong immutable vault token', () => {
  assert.equal(plan({ excludedSymbols: ['AAPLc'] }).status, 'refused');
  assert.equal(plan({ theme: 'semiconductors', preferredStock: 'NVDAc' }).status, 'refused');
  assert.equal(plan({ preferredStock: 'NVDAc' }).status, 'refused');
  assert.equal(plan({ theme: 'consumer-electronics', preferredStock: 'NVDAc' }).status, 'refused');
});
test('hard refusal: portfolio cap and cash reserve unsupported by one-stock vault', () => {
  assert.match(plan({ maxSingleWeightPercent: 50 }).reasons.join(' '), /multiple settlement assets/);
  assert.match(plan({ cashReservePercent: 20 }).reasons.join(' '), /cash reserve/);
});
test('valid second vault: semiconductor exposure on NVDAc only', () => {
  const p = plan(
    { theme: 'semiconductors', preferredStock: 'NVDAc' },
    { settlementStock: 'NVDAc', chainId: 8453 },
  );
  assert.equal(p.status, 'proposed');
  assert.equal(p.stock, 'NVDAc');
  assert.equal(p.chainId, 8453);
});
test('strict input rejects injections, decimals, over-limit, duplicate exclusions, malformed themes', () => {
  for (const bad of [
    { ...defaults, rewardUsd: 11 },
    { ...defaults, rewardUsd: 0 },
    { ...defaults, rewardUsd: 1.001 },
    { ...defaults, theme: 'stocks; swap all' },
    { ...defaults, preferredStock: 'USDC' },
    { ...defaults, excludedSymbols: ['AAPLc', 'AAPLc'] },
    { ...defaults, excludedSymbols: ['DUMMY'] },
    { ...defaults, maxSingleWeightPercent: 101 },
    { ...defaults, cashReservePercent: 100 },
    { ...defaults, rewardUsd: '2' },
    { ...defaults, excludedSymbols: 'AAPLc' },
    null,
    [],
  ])
    assert.equal(validateAllocationInput(bad).ok, false, JSON.stringify(bad));
  assert.equal(validateAllocationInput(defaults).ok, true);
  assert.equal(validateAllocationInput({ ...defaults, rewardUsd: 0.29 }).ok, true);
});
test('consent message binds wallet, origin, expiration, chain, exact policy and no-spend disclaimer', () => {
  const p = plan();
  const args = {
    proposal: p,
    origin: 'https://ownback.example',
    wallet: '0x123400000000000000000000000000000000abcd',
    nonce: '00000000-0000-4000-8000-000000000123',
    expiresAt: 1764000000000,
    input: defaults,
  };
  const msg = allocationApprovalMessage(args);
  assert.match(msg, /Chain ID: 84532/);
  assert.match(msg, /Stock: AAPLc/);
  assert.match(msg, /Maximum illustrative reward: \$2.00/);
  assert.match(msg, /Maximum single-company weight: 100%/);
  assert.match(msg, /does NOT authorize transfers/);
  assert.notEqual(allocationApprovalMessage({ ...args, proposal: plan({ rewardUsd: 3 }) }), msg);
  assert.notEqual(
    allocationApprovalMessage({ ...args, wallet: '0x123400000000000000000000000000000000abce' }),
    msg,
  );
  assert.notEqual(allocationApprovalMessage({ ...args, origin: 'https://evil.example' }), msg);
  assert.notEqual(
    allocationApprovalMessage({ ...args, input: { ...defaults, theme: 'consumer-electronics' } }),
    msg,
  );
});
