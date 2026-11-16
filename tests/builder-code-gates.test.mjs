import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateBuilderCode,
  validateBuilderConfig,
  codesFromTxCalldata,
} from '../scripts/builder-code-policy.mjs';
const marker = '80218021802180218021802180218021';
function encoded(codes) {
  const bytes = Buffer.from(codes.join(','), 'utf8');
  return '0xdeadbeef' + bytes.toString('hex') + bytes.length.toString(16).padStart(2, '0') + '00' + marker;
}
test('rejects missing and malformed Builder Codes', () => {
  for (const value of ['', undefined, 'a,b', 'a b', 'a\nb', 'a'.repeat(129)])
    assert.throws(() => validateBuilderCode(value));
  assert.equal(validateBuilderCode('bc_ownback2026'), 'bc_ownback2026');
});
test('web/worker release config must be identical', () => {
  assert.equal(validateBuilderConfig('bc_ownback', 'bc_ownback'), 'bc_ownback');
  assert.throws(() => validateBuilderConfig('bc_one', 'bc_two'), /do not match/);
});
test('parses ERC-8021 trailer from transaction calldata', () => {
  assert.deepEqual(codesFromTxCalldata(encoded(['bc_ownback'])), ['bc_ownback']);
});
test('supports multi-builder attributed transaction encoding', () => {
  assert.deepEqual(codesFromTxCalldata(encoded(['bc_ownback', 'bankr'])), ['bc_ownback', 'bankr']);
});
test('rejects absent, truncated or invalid-schema trailers', () => {
  assert.deepEqual(codesFromTxCalldata('0xdeadbeef'), []);
  assert.deepEqual(codesFromTxCalldata('0xabcdef00' + marker), []);
  assert.deepEqual(codesFromTxCalldata(encoded(['bc_ownback']).replace('00' + marker, '01' + marker)), []);
});
test('Shopify signing path attaches dataSuffix to contract write', () => {
  const src = readFileSync('scripts/shopify-settle.ts', 'utf8');
  assert.match(src, /shopifyBuilderDataSuffix/);
  assert.match(src, /writeContract\(\{[\s\S]*?dataSuffix\}\)/);
});
test('Keeper and customer signing paths both include dataSuffix', () => {
  assert.match(readFileSync('scripts/keeper.ts', 'utf8'), /writeContract\(\{ \.\.\.request, dataSuffix \}\)/);
  assert.match(
    readFileSync('src/lib/wallet.ts', 'utf8'),
    /writeContract\(\{ \.\.\.request, dataSuffix: builderDataSuffix \}\)/,
  );
});
test('submission workflow requires one shared builder code', () => {
  const s = readFileSync('.github/workflows/submission-gate.yml', 'utf8');
  assert.match(s, /OWNBACK_BUILDER_CODE/);
  assert.match(s, /npm run verify:builder:config/);
});
