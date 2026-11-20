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

test('SQL regex repetition counts stay within the PostgreSQL limit of 255', async () => {
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(new URL('../commerce/', import.meta.url)).filter((x) => x.endsWith('.sql'))) {
    const sql = readFileSync(new URL('../commerce/' + f, import.meta.url), 'utf8');
    for (const m of sql.matchAll(/\{(\d+)(?:,(\d+))?\}/g))
      assert.ok(Number(m[2] ?? m[1]) <= 255, `${f}: repetition ${m[0]} exceeds 255`);
  }
});
