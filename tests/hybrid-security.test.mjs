import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  validatedShop,
  verifyOAuth,
  verifyWebhook,
  customerHash,
  encryptToken,
  decryptToken,
  issueToken,
  tokenDigest,
  usdToBaseUnits,
  orderHash,
} from '../src/lib/shopify/security.ts';
import { classify, rewardAmount, qualifiesForShopifyPayout } from '../src/lib/shopify/rules.ts';
process.env.SHOPIFY_CLIENT_SECRET = 'shopify-pilot-test-secret';
process.env.SHOPIFY_CUSTOMER_SECRET = 'long-customer-privacy-secret-of-32-characters';
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
test('Shopify domain validation blocks URL injection', () => {
  assert.equal(validatedShop('Pilot-Store.myshopify.com'), 'pilot-store.myshopify.com');
  for (const shop of [
    'https://shop.myshopify.com',
    'evil.com',
    'shop.myshopify.com.evil.com',
    'myshopify.com',
    'example.myshopify.com/path',
  ])
    assert.throws(() => validatedShop(shop));
});
test('OAuth HMAC checks the exact returned Shopify parameters', () => {
  const params = new URLSearchParams({
    shop: 'test.myshopify.com',
    code: 'abc',
    state: 'teststate',
    timestamp: '1773033000',
  });
  const msg = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  params.set('hmac', createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update(msg).digest('hex'));
  assert.equal(verifyOAuth(params), true);
  params.set('code', 'tampered');
  assert.equal(verifyOAuth(params), false);
});
test('Shopify HMAC checks raw bytes, not parsed JSON', () => {
  const body = '{"id":123,"total_price":"48.00"}',
    key = process.env.SHOPIFY_CLIENT_SECRET;
  const hmac = createHmac('sha256', key).update(body).digest('base64');
  assert.equal(verifyWebhook(body, hmac), true);
  assert.equal(verifyWebhook(body + ' ', hmac), false);
});
test('Shopify token credentials encrypted and authenticated', () => {
  const secret = 'shpat_example_secret_123';
  const encrypted = encryptToken(secret);
  assert.ok(!encrypted.includes(secret));
  assert.equal(decryptToken(encrypted), secret);
  assert.throws(() => decryptToken(encrypted.slice(0, -1) + 'X'));
});
test('Customer hash is stable within shop but isolated across shops', () => {
  const a = customerHash('a.myshopify.com', '123'),
    b = customerHash('a.myshopify.com', '123'),
    c = customerHash('b.myshopify.com', '123');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^0x[a-f0-9]{64}$/);
});
test('Claim token digest is one-way and order keys are unique', () => {
  const { token, digest } = issueToken();
  assert.equal(tokenDigest(token), digest);
  assert.equal(token.length, 64);
  assert.notEqual(orderHash('a.myshopify.com', '1'), orderHash('a.myshopify.com', '2'));
});
test('USD amounts convert to USDC with no floating point drift', () => {
  assert.equal(usdToBaseUnits('48.00'), 48_000_000n);
  assert.equal(usdToBaseUnits('0.01'), 10_000n);
  for (const input of ['0.001', '-12.00', '12.123', '1e4', '0', '100000000000'])
    assert.throws(() => usdToBaseUnits(input));
});
test('Only earliest first and first 7-day comeback qualify', () => {
  const t = Date.parse('2026-11-11T08:00:00Z');
  const events = [
    { id: 'a', paidAt: t },
    { id: 'b', paidAt: t + 2 * 86400_000 },
    { id: 'c', paidAt: t + 4 * 86400_000 },
  ];
  assert.equal(classify(events, 'a'), 'FIRST');
  assert.equal(classify(events, 'b'), 'COMEBACK');
  assert.equal(classify(events, 'c'), 'NONE');
  assert.equal(classify(events, 'missing'), 'NONE');
  assert.equal(
    classify(
      [
        { id: 'a', paidAt: t },
        { id: 'b', paidAt: t + 8 * 86400_000 },
      ],
      'b',
    ),
    'NONE',
  );
});
test('Refunding an already-delivered first purchase does not rewrite history', () => {
  const t = 1000;
  assert.equal(
    classify(
      [
        { id: 'first', paidAt: t, refunded: true, delivered: true },
        { id: 'second', paidAt: t + 1000 },
      ],
      'second',
      7000,
    ),
    'COMEBACK',
  );
  assert.equal(
    classify(
      [
        { id: 'first', paidAt: t, refunded: true, delivered: false },
        { id: 'second', paidAt: t + 1000 },
      ],
      'second',
      7000,
    ),
    'FIRST',
  );
});
test('Reward math always respects $10 cap', () => {
  assert.equal(rewardAmount(48_000_000n, 'FIRST'), 960_000n);
  assert.equal(rewardAmount(48_000_000n, 'COMEBACK'), 2_400_000n);
  assert.equal(rewardAmount(1000_000_000n, 'COMEBACK'), 10_000_000n);
  assert.equal(rewardAmount(48_000_000n, 'NONE'), 0n);
});
test('Payout requires claim, hold expiry, real paid state and no refund', () => {
  const base = { status: 'CLAIMED', holdAt: 10, now: 20, isPaid: true, refunded: false, claimed: true };
  assert.equal(qualifiesForShopifyPayout(base), true);
  for (const update of [
    { status: 'HOLD' },
    { holdAt: 30 },
    { isPaid: false },
    { refunded: true },
    { claimed: false },
  ])
    assert.equal(qualifiesForShopifyPayout({ ...base, ...update }), false);
});
