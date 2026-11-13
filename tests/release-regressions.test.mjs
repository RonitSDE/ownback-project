import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseCatalog } from '../src/lib/agentic/ucp.ts';

const source = (p) => readFileSync(p, 'utf8');

test('unknown UCP variant availability fails closed, explicit available remains purchasable', () => {
  const base = {
    id: 'gid://shopify/Product/1',
    title: 'Item',
    price_range: { min: { amount: 1000, currency: 'USD' } },
  };
  const v = (n, availability) => ({
    id: `gid://shopify/ProductVariant/${n}`,
    title: 'Default',
    price: { amount: 1000, currency: 'USD' },
    availability,
  });
  const products = normaliseCatalog({
    products: [
      { ...base, variants: [v(1, undefined), v(2, { available: false }), v(3, { available: true })] },
    ],
  });
  assert.deepEqual(
    products[0].variants.map((x) => x.available),
    [false, false, true],
  );
});

test('commerce reconciliation includes payer in onchain order reference check', () => {
  const code = source('src/lib/commerce/chain.ts');
  assert.match(code, /orderRefUsed[^\n]*args:\[BigInt\(s\.campaign\),payer,ref\]/);
  assert.match(source('src/lib/commerce/orders.ts'), /usedOnchain\(order\.order_ref,order\.wallet/);
  const abi = source('src/lib/abi/index.ts');
  assert.match(abi, /"name": "orderRefUsed"/);
});

test('catalog browser loads merchant images and resets prior checkout on merchant change', () => {
  assert.match(source('next.config.ts'), /img-src[^\n]*https:/);
  const ui = source('src/app/agentic/page.tsx');
  assert.match(ui, /onChange=\{e=>switchMerchant\(e\.target\.value\)\}/);
  assert.match(ui, /function switchMerchant[^]*?setCart\(\[\]\);setLink\(''\);setHandoff\(false\)/);
  assert.match(ui, /referrerPolicy="no-referrer"/);
});

test('public merchant discovery requires paid-order webhooks to be ready', () => {
  assert.match(source('src/lib/agentic/shops.ts'), /active=true AND webhook_ready=true/);
});

test('UCP null, boolean or whitespace prices cannot become accidental zero-dollar offers', () => {
  for (const amount of [null, false, true, '', '   ', {}, [], '12.9']) {
    const invalid = {
      id: 'gid://shopify/Product/1',
      title: 'Invalid',
      price_range: { min: { amount, currency: 'USD' } },
      variants: [],
    };
    assert.equal(normaliseCatalog({ products: [invalid] }).length, 0, JSON.stringify(amount));
  }
});

test('Shopify claim signs through the connected provider rather than an unrelated global wallet', () => {
  const claim = source('src/app/claim/page.tsx');
  const wallet = source('src/lib/wallet.ts');
  assert.match(claim, /signWithConnectedWallet\(wallet,msg\)/);
  assert.doesNotMatch(claim, /custom\(window\.ethereum\)/);
  assert.match(wallet, /signWithConnectedWallet\([^]*?commerceProvider \?\? window\.ethereum/);
});
