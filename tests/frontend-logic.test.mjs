import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsdcInput, sanitizeUsdcTyping } from '../src/lib/amount.ts';
import { classifyPrice } from '../src/lib/price-status.ts';
import {
  decideIntent,
  newIntent,
  parseStoredIntent,
  INTENT_TTL_SECONDS,
} from '../src/lib/checkout-intent.ts';

const NOW = 1_800_000_000;
const RAND = new Uint8Array(32).fill(7);
const HASH = `0x${'ab'.repeat(32)}`;

test('amount parsing is strict', () => {
  assert.deepEqual(parseUsdcInput('48'), { ok: true, units: 48_000_000n });
  assert.deepEqual(parseUsdcInput('12.5'), { ok: true, units: 12_500_000n });
  for (const bad of ['', ' ', 'abc', '1.2.3', '-5', '1e6', '0', '0.0000001', '100001']) {
    assert.equal(parseUsdcInput(bad).ok, false, bad);
  }
});

test('typing sanitizer keeps partial input and caps decimals', () => {
  assert.equal(sanitizeUsdcTyping('12.'), '12.');
  assert.equal(sanitizeUsdcTyping('$1,2a3.4567891'), '123.456789');
  assert.equal(sanitizeUsdcTyping('1.2.3'), '1.23');
});

test('price status distinguishes a closed market from a broken feed', () => {
  const day = 86_400;
  assert.equal(classifyPrice(60, 5 * day, true), 'fresh');
  assert.equal(classifyPrice(2 * day, 5 * day, true), 'market-closed');
  assert.equal(classifyPrice(6 * day, 5 * day, true), 'stale');
  assert.equal(classifyPrice(0, 5 * day, false), 'missing');
});

test('intent: nothing stored -> create', () => {
  assert.deepEqual(decideIntent(null, null, NOW, 1n), { action: 'create' });
});

test('intent: unsubmitted and valid -> reuse the same orderRef', () => {
  const i = newIntent(NOW, 960_000n, RAND);
  assert.equal(decideIntent(i, null, NOW + 10, 960_000n).action, 'reuse');
});

test('intent: promised reward changed -> fresh intent', () => {
  const i = newIntent(NOW, 960_000n, RAND);
  assert.equal(decideIntent(i, null, NOW + 10, 2_400_000n).action, 'create');
});

test('intent: submitted and confirmed -> never pay again', () => {
  const i = { ...newIntent(NOW, 1n, RAND), hash: HASH };
  assert.deepEqual(decideIntent(i, 'success', NOW, 1n), { action: 'already-paid', hash: HASH });
});

test('intent: submitted, no receipt, before deadline -> wait', () => {
  const i = { ...newIntent(NOW, 1n, RAND), hash: HASH };
  assert.equal(decideIntent(i, 'not-found', NOW + 60, 1n).action, 'wait');
});

test('intent: submitted, no receipt, past deadline -> safe to discard', () => {
  const i = { ...newIntent(NOW, 1n, RAND), hash: HASH };
  assert.equal(decideIntent(i, 'not-found', NOW + INTENT_TTL_SECONDS + 1, 1n).action, 'create');
});

test('intent: reverted -> create', () => {
  const i = { ...newIntent(NOW, 1n, RAND), hash: HASH };
  assert.equal(decideIntent(i, 'reverted', NOW, 1n).action, 'create');
});

test('stored intent parsing rejects tampered data', () => {
  const i = newIntent(NOW, 1n, RAND);
  assert.deepEqual(parseStoredIntent(JSON.stringify(i)), i);
  assert.equal(parseStoredIntent('{not json'), null);
  assert.equal(parseStoredIntent(JSON.stringify({ ...i, orderRef: '0x1234' })), null);
  assert.equal(parseStoredIntent(JSON.stringify({ ...i, hash: 'javascript:alert(1)' })), null);
});
