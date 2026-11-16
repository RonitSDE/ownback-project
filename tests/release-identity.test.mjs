import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expectedRelease, assertReleaseIdentity } from '../scripts/release-identity.mjs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const proof = JSON.parse(readFileSync(new URL('../evidence/proofs.json', import.meta.url)));
test('source package and proof register have one exact release identity', () => {
  assert.equal(assertReleaseIdentity(pkg.version, proof.release), expectedRelease(pkg.version));
});
test('mismatched source or tag must fail closed', () => {
  assert.throws(() => assertReleaseIdentity('3.10.5', 'v3.10.4'), /Release mismatch/);
  assert.throws(() => assertReleaseIdentity('3.10.5', 'v3.10.5', 'v3.10.3'), /Tagged SHA mismatch/);
});
test('invalid release version is never treated as a tag', () => {
  for (const bad of ['3.11.0', '3.10.x', '', null])
    assert.throws(() => expectedRelease(bad), /Invalid candidate version/);
});
test('judge-facing proof receipt is captured, not independently certified in static UI', () => {
  const page = readFileSync(new URL('../src/app/judge/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /CAPTURED · RPC PENDING/);
  assert.match(page, /source artifacts are not proof that a tagged CI gate passed/);
});
