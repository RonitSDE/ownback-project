import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const approve = read('src/app/api/allocation/approve/route.ts');
const propose = read('src/app/api/allocation/propose/route.ts');
const sql = read('commerce/allocations.sql');
const research = read('src/app/api/allocation/research/route.ts');
const cohort = read('src/app/api/retention/cohorts/route.ts');
test('approval server recomputes proposal, verifies wallet proof, expiry and replay uniqueness', () => {
  assert.match(approve, /buildAllocationProposal\(parsed\.input,c\)/);
  assert.match(approve, /verifyMessage\(/);
  assert.match(approve, /sameOrigin\(req\)/);
  assert.match(approve, /expiresAt<Date\.now\(\)\+1000/);
  assert.match(approve, /ON CONFLICT\(wallet,nonce\) DO NOTHING/);
  assert.match(sql, /UNIQUE\(wallet,nonce\)/);
  assert.match(sql, /verified_signature TEXT NOT NULL/);
  assert.match(approve, /OWNBACK_PREFERENCE_RECEIPTS_ENABLED/);
  assert.doesNotMatch(approve, /walletClient|\.sendTransaction\(|\.writeContract\(/);
});
test('policy inputs are evaluated only after same-origin/rate limit and have no spend path', () => {
  assert.match(propose, /sameOrigin\(req\)/);
  assert.match(propose, /rateLimit\(/);
  assert.match(propose, /validateAllocationInput/);
  assert.doesNotMatch(propose, /execute\(|transfer\(|mint\(/);
});
test('optional Bankr research is read-only and explicit unverified, never policy execution', () => {
  assert.match(research, /Never trade, transact, approve, transfer, or borrow/);
  assert.match(research, /Unverified AI-generated research/);
  assert.match(research, /verifyJobToken/);
});
test('real cohort report is merchant gated, per-store only and never claims uplift', () => {
  assert.match(cohort, /adminAuthorized/);
  assert.match(cohort, /PARTITION BY shop_domain,customer_hash/);
  assert.match(cohort, /No randomized holdout or causal uplift/);
  assert.match(cohort, /WHERE status NOT IN \('REFUNDED'/);
});
