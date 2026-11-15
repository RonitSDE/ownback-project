import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/app/api/shopify/compliance/route.ts', import.meta.url), 'utf8');
test('compliance webhooks are HMAC-verified and handle all three mandatory topics', () => {
  assert.match(src, /verifyWebhook\(raw/);
  for (const t of ['customers/data_request', 'customers/redact', 'shop/redact'])
    assert.ok(src.includes(t), t);
});
test('redaction removes encrypted recipients and unlinks the customer pseudonym', () => {
  assert.match(src, /DELETE FROM shopify_claim_outbox WHERE shop_domain=\$1 AND order_id=ANY/);
  assert.match(src, /customer_hash=\$3,wallet=NULL/);
  assert.match(src, /DELETE FROM shopify_installations WHERE shop_domain=\$1/);
});
