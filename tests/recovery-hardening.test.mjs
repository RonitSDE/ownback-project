import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encryptToken,decryptToken,issueToken,tokenDigest,orderHash} from '../src/lib/shopify/security.ts';
const src=path=>readFileSync(path,'utf8');
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY='a'.repeat(64);

test('queued buyer link can be stored encrypted and verified without plaintext in reward ledger',()=>{
 const {token,digest}=issueToken();
 const ciphertext=encryptToken(token);
 assert.notEqual(ciphertext,token);
 assert.equal(tokenDigest(decryptToken(ciphertext)),digest);
 assert.match(orderHash('example.myshopify.com','100'),/^0x[0-9a-f]{64}$/);
});

test('outbox row and redeemable claim token are saved in the same DB transaction',()=>{
 const code=src('src/lib/shopify/claim-outbox.ts');
 assert.match(code,/UPDATE shopify_reward_orders[\s\S]*?claim_token_hash=[\s\S]*?INSERT INTO shopify_claim_outbox/);
 assert.match(code,/encryptToken\(token\)/);
 assert.match(code,/encryptToken\(email\)/);
 const worker=src('scripts/shopify-claims.ts');
 assert.match(worker,/await withTx\(async c=>/);
 assert.match(worker,/await queueShopifyClaim\(c,/);
 assert.match(worker,/await fetch\('https:\/\/api\.resend\.com\/emails'/);
 assert.match(worker,/Idempotency-Key/);
});

test('merchant-triggered claims also use the durable outbox, not direct email calls',()=>{
 const route=src('src/app/api/shopify/admin/claims/route.ts');
 assert.match(route,/await withTx\(async db=>/);
 assert.match(route,/queueShopifyClaim\(db,/);
 assert.doesNotMatch(route,/fetch\('https:\/\/api\.resend\.com\/emails'/);
});

test('refund webhook revokes pending queued email delivery and claim token',()=>{
 const webhook=src('src/app/api/shopify/webhook/route.ts');
 assert.match(webhook,/claim_token_hash=NULL,claim_expires_at=NULL/);
 assert.match(webhook,/UPDATE shopify_claim_outbox SET status='CANCELLED'/);
});

test('uncertain tx submission is never returned to the automatic pay queue',()=>{
 const settle=src('scripts/shopify-settle.ts');
 assert.match(settle,/if\(await confirm\(order\)\)return/);
 assert.match(settle,/Preserve SETTLING even when the transaction hash is absent/);
 assert.doesNotMatch(settle,/SET status='CLAIMED',processing_started_at=NULL/);
 assert.match(settle,/status='SETTLING' OR \(status='REFUNDED' AND processing_started_at IS NOT NULL\)/);
 assert.match(settle,/parsed\.args\.customerHash/);
 assert.match(settle,/parsed\.args\.wallet/);
 assert.match(settle,/UPDATE shopify_reward_orders AS o[\s\S]*?EXISTS\(SELECT 1 FROM shopify_refund_markers/);
});

test('new outbox migration has a stable order idempotency key and worker lease',()=>{
 const schema=src('commerce/shopify.sql');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS shopify_claim_outbox/);
 assert.match(schema,/idempotency_key TEXT NOT NULL UNIQUE/);
 assert.match(schema,/lease_expires_at TIMESTAMPTZ/);
 assert.match(schema,/FOREIGN KEY\(shop_domain,order_id\)/);
});
