import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
test('global label states not deployed, mock asset and NOT_EXECUTED', () => {
  const strip = load('src/components/RealityStrip.tsx');
  for (const v of ['MOCK STOCK', 'NOT DEPLOYED', 'NOT_EXECUTED']) assert.match(strip, new RegExp(v));
  assert.match(load('src/app/layout.tsx'), /RealityStrip/);
});
test('homepage contains only the main judge path, not Bankr or stock-backed lending', () => {
  const home = load('src/app/page.tsx');
  assert.match(home, /href="\/judge"/);
  assert.match(home, /Proof of Retention/);
  assert.doesNotMatch(home, /href="\/agentic"|href="\/borrow"|Morpho/);
});
test('candidate judge page discloses absent real proof and has no fake hashes', () => {
  const proof = JSON.parse(load('evidence/proofs.json'));
  assert.equal(proof.proofs.length, 4);
  const explorer = {
    BASE_SEPOLIA: 'https://sepolia.basescan.org/tx/',
    BASE_MAINNET: 'https://basescan.org/tx/',
  };
  for (const row of proof.proofs) {
    if (row.status === 'MISSING') {
      // Nothing may be attached to a missing proof.
      assert.equal(row.url, null);
      assert.equal(row.transactionHash, null);
      continue;
    }
    // A captured proof must point at a saved evidence file; strict on-chain checks run in verify:proofs.
    assert.equal(row.status, 'VERIFIED', `${row.id}: unexpected status`);
    assert.match(row.evidenceFile || '', /^evidence\/(receipts|logs)\//, `${row.id}: evidence file`);
    if (row.id === 'preference_replay') continue;
    assert.match(row.transactionHash || '', /^0x[0-9a-fA-F]{64}$/, `${row.id}: transaction hash`);
    if (explorer[row.environment])
      assert.equal(row.url?.toLowerCase(), (explorer[row.environment] + row.transactionHash).toLowerCase());
  }
  assert.match(load('src/app/judge/page.tsx'), /Proofs remain missing/);
});
test('merchant home is observed-only with proof above planner', () => {
  const growth = load('src/app/growth/page.tsx');
  assert.ok(
    growth.indexOf('Onchain campaign. Observed returners.') <
      growth.indexOf('Optional: hypothetical campaign planner'),
  );
  assert.ok(
    growth.indexOf('Also in source: authenticated Shopify cohort') <
      growth.indexOf('Optional: hypothetical campaign planner'),
  );
  assert.match(growth, /Budget remaining/);
  assert.match(growth, /Not linked/);
  assert.match(growth, /Returned within 7 days/);
  assert.match(growth, /Observed, not causal lift/);
  assert.match(growth, /api\/shopify\/overview/);
});
test('allocation has one-click refused preview and cannot execute', () => {
  const allocation = load('src/app/allocation/page.tsx');
  assert.match(allocation, /previewFixture\('refused'\)/);
  assert.match(allocation, /NOT_EXECUTED/);
  assert.match(allocation, /preference only — cannot trade or claim/);
});
