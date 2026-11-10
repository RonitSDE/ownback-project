import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBorrow } from '../src/lib/bankr/validate.ts';

const MAX = 25;

test('accepts a well-formed borrow', () => {
  const r = validateBorrow({ stockSymbol: 'AAPLc', collateralUnits: '0.004800', borrowUsdc: 2 }, MAX);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { stockSymbol: 'AAPLc', collateralUnits: '0.004800', borrowUsdc: 2 });
});

test('rejects hostile or malformed symbols', () => {
  for (const s of ['', '1AAPL', 'DROP TABLE', 'A'.repeat(13), '<script>', 'AAPL;rm']) {
    assert.equal(validateBorrow({ stockSymbol: s, collateralUnits: '1', borrowUsdc: 1 }, MAX).ok, false, s);
  }
});

test('rejects bad collateral amounts', () => {
  for (const c of ['', '0', '-1', 'abc', '1e9', '1.2.3', Number(1)]) {
    assert.equal(
      validateBorrow({ stockSymbol: 'AAPLc', collateralUnits: c, borrowUsdc: 1 }, MAX).ok,
      false,
      String(c),
    );
  }
});

test('rejects non-positive, non-finite, or over-cap borrow amounts', () => {
  for (const b of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, '2', MAX + 0.01]) {
    assert.equal(
      validateBorrow({ stockSymbol: 'AAPLc', collateralUnits: '1', borrowUsdc: b }, MAX).ok,
      false,
      String(b),
    );
  }
  assert.match(
    validateBorrow({ stockSymbol: 'AAPLc', collateralUnits: '1', borrowUsdc: 1000 }, MAX).error,
    /limit/,
  );
});

test('rejects non-object bodies', () => {
  for (const x of [null, 42, 'str', undefined]) {
    assert.equal(validateBorrow(x, MAX).ok, false);
  }
});
