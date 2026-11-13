import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('local proof capture only interrogates real chain receipts', () => {
  const script = read('scripts/capture-anvil-path.mjs');
  assert.match(script, /rpcCall\(url,'eth_getLogs'/);
  assert.match(script, /matchingProof\(\)/);
  assert.match(script, /capture-chain-proof\.mjs/);
  assert.match(script, /chain 31337|31337/);
  assert.doesNotMatch(script, /fakeHash|simulateReceipt|Math\.random/);
});
test('strict proof gate requires captured receipt and RPC, plus one contract and matching environment', () => {
  const script = read('scripts/verify-proofs.mjs');
  assert.match(script, /local captured receipt file missing/);
  assert.match(script, /Saved receipt is not the current canonical receipt/);
  assert.match(script, /different Ownback contract addresses/);
  assert.match(script, /Preference replay proof environment does not match/);
});
test('tag assertion fails closed outside a git tag', () => {
  const script = read('scripts/assert-tagged-sha.mjs');
  assert.match(script, /--points-at/);
  assert.match(script, /GITHUB_SHA/);
  assert.match(script, /Dirty worktree/);
  assert.match(script, /tag ref, not a branch/);
});
test('proof manifest has exactly four release slots, each fail-closed until captured', () => {
  const doc = JSON.parse(read('evidence/proofs.json'));
  const required = ['campaign_funding', 'order_payment', 'settlement_refusal', 'preference_replay'];
  assert.deepEqual(doc.proofs.map((x) => x.id).sort(), required.sort());
  for (const row of doc.proofs) {
    assert.ok(['MISSING', 'VERIFIED'].includes(row.status));
    if (row.status === 'MISSING') assert.equal(row.transactionHash, null);
    else assert.ok(row.evidenceFile?.startsWith('evidence/'));
  }
});
