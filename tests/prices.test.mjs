import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotes, requireFreshObservation, toUsdc6 } from '../src/lib/prices.ts';

const record = {
  symbol: 'AAPLc',
  name: 'Apple tokenized stock',
  contract_address: '0xb200000000000000000000000000000000000001',
  nav_price: '231.42',
  nav_price_updated_at: '2026-11-06T14:00:00Z',
  multiplier: '1.0042',
};

test('parses a plain array', () => {
  const [q] = parseQuotes([record]);
  assert.equal(q.symbol, 'AAPLc');
  assert.equal(q.navPrice, 231.42);
  assert.equal(q.multiplier, 1.0042);
  assert.equal(q.address, record.contract_address);
});

test('finds records inside common envelopes', () => {
  for (const key of ['tokenized_stocks', 'data', 'items', 'somethingElse']) {
    assert.equal(parseQuotes({ [key]: [record], next_page_token: null }).length, 1, key);
  }
});

test('accepts numeric and {value} shaped prices', () => {
  assert.equal(parseQuotes([{ ...record, nav_price: 100 }])[0].navPrice, 100);
  assert.equal(parseQuotes([{ ...record, nav_price: { value: '99.5' } }])[0].navPrice, 99.5);
});

test('drops records without a usable price instead of inventing one', () => {
  assert.equal(parseQuotes([{ ...record, nav_price: null }]).length, 0);
  assert.equal(parseQuotes([{ ...record, nav_price: '0' }]).length, 0);
  assert.equal(parseQuotes([{ ...record, symbol: '' }]).length, 0);
  assert.equal(parseQuotes({ unexpected: 'shape' }).length, 0);
});

test('converts to adapter units (USDC 6dp)', () => {
  assert.equal(toUsdc6(231.42), 231_420_000n);
  assert.equal(toUsdc6(0.000001), 1n);
});

test('price observation cannot be absent, invalid, future or stale', () => {
  const now = Math.floor(Date.parse('2026-11-06T15:00:00Z') / 1000);
  const recent = { symbol: 'AAPLc', navUpdatedAt: '2026-11-06T14:00:00Z' };
  assert.equal(requireFreshObservation(recent, now, 7200), now - 3600);
  assert.throws(() => requireFreshObservation(recent, now, 1800), /Stale source price/);
  assert.throws(
    () => requireFreshObservation({ ...recent, navUpdatedAt: null }, now, 7200),
    /Missing source/,
  );
  assert.throws(
    () => requireFreshObservation({ ...recent, navUpdatedAt: '2020-01-01T00:00:00Z' }, now, 7200),
    /Stale source/,
  );
  assert.throws(
    () => requireFreshObservation({ ...recent, navUpdatedAt: 'invalid' }, now, 7200),
    /Invalid source/,
  );
  assert.throws(
    () => requireFreshObservation({ ...recent, navUpdatedAt: '2026-11-06T16:00:00Z' }, now, 7200),
    /Future/,
  );
});
