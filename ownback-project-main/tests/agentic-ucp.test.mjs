import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  merchantDomain,
  validateVariant,
  validateBuyerLink,
  rewardPreview,
  normaliseCatalog,
  parseCart,
  callShopifyUcp,
  unwrapMcp,
  permittedCheckoutHosts,
  ucpProfile,
} from '../src/lib/agentic/ucp.ts';
const goodProduct = {
  id: 'gid://shopify/Product/1001',
  title: 'Fair Trade Coffee',
  description: { html: '<p>Organic beans</p>' },
  price_range: { min: { amount: 1899, currency: 'USD' } },
  media: [{ type: 'image', url: 'https://cdn.shopify.com/item.jpg' }],
  variants: [
    {
      id: 'gid://shopify/ProductVariant/2001',
      title: '12 oz',
      price: { amount: 1899, currency: 'USD' },
      availability: { available: true },
    },
  ],
};
test('merchant domains block SSRF and untrusted URLs', () => {
  assert.equal(merchantDomain('DEMO.MYSHOPIFY.COM'), 'demo.myshopify.com');
  for (const s of [
    'http://127.0.0.1',
    'localhost',
    'internal.svc',
    'demo.myshopify.com.evil.com',
    'demo.myshopify.com/path',
    '127.0.0.1.myshopify.com:80',
  ])
    assert.throws(() => merchantDomain(s));
});
test('variant ids allow Shopify product variants only', () => {
  assert.equal(validateVariant('gid://shopify/ProductVariant/2001'), 'gid://shopify/ProductVariant/2001');
  for (const s of ['gid://shopify/Product/2001', 'javascript:alert(1)', 'demo:1'])
    assert.throws(() => validateVariant(s));
});
test('checkout origin limited to approved merchant and explicit domain', () => {
  assert.equal(
    validateBuyerLink('https://demo.myshopify.com/cart/c/abc', 'demo.myshopify.com'),
    'https://demo.myshopify.com/cart/c/abc',
  );
  assert.throws(() => validateBuyerLink('https://evil.example/steal', 'demo.myshopify.com'));
  assert.throws(() => validateBuyerLink('http://demo.myshopify.com/cart', 'demo.myshopify.com'));
  assert.equal(
    validateBuyerLink('https://shop.example.com/cart', 'demo.myshopify.com', ['shop.example.com']),
    'https://shop.example.com/cart',
  );
});
test('UCP catalog money uses minor units and sanitizes HTML', () => {
  const p = normaliseCatalog({ products: [goodProduct] });
  assert.equal(p.length, 1);
  assert.equal(p[0].priceMinor, 1899);
  assert.equal(p[0].variants[0].priceMinor, 1899);
  assert.ok(!p[0].description.includes('<p>'));
  assert.ok(p[0].image.startsWith('https:'));
});
test('catalog ignores malformed variants and prices', () => {
  const p = normaliseCatalog({
    products: [
      {
        ...goodProduct,
        variants: [
          { id: 'bad', price: { amount: 50 } },
          { id: 'gid://shopify/ProductVariant/1', price: { amount: 1200 } },
        ],
      },
      { ...goodProduct, price_range: { min: { amount: 'evil' } } },
    ],
  });
  assert.equal(p.length, 1);
  assert.equal(p[0].variants.length, 1);
});
test('reward previews use cents, one capped bonus, and not fractional cents', () => {
  assert.deepEqual(rewardPreview(4800, false), { minor: 96, rate: 2 });
  assert.deepEqual(rewardPreview(4800, true), { minor: 240, rate: 5 });
  assert.equal(rewardPreview(50000, true).minor, 1000);
  assert.equal(rewardPreview(1, false).minor, 0);
});
test('cart parser blocks incorrect checkout domain', () => {
  const result = {
    cart: {
      id: 'gid://shopify/Cart/55',
      continue_url: 'https://demo.myshopify.com/cart/c/55',
      totals: { total: { amount: 1899, currency: 'USD' } },
    },
  };
  assert.equal(parseCart(result, 'demo.myshopify.com').totalMinor, 1899);
  assert.throws(() =>
    parseCart(
      { ...result, cart: { ...result.cart, continue_url: 'https://attacker.org/steal' } },
      'demo.myshopify.com',
    ),
  );
});
test('agent profile is HTTPS public and feature declared', () => {
  assert.equal(
    ucpProfile('https://ownback.example.com/profiles/ownback-ucp.json'),
    'https://ownback.example.com/profiles/ownback-ucp.json',
  );
  assert.throws(() => ucpProfile('http://localhost:3000/profile'));
  assert.throws(() => ucpProfile(''));
});
test('shopify UCP emits documented JSON-RPC and parses structuredContent', async () => {
  let url, body;
  const fetcher = async (u, init) => {
    url = u;
    body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ result: { structuredContent: { products: [goodProduct] } } }) };
  };
  const out = await callShopifyUcp(
    'demo.myshopify.com',
    'search_catalog',
    { catalog: { query: 'coffee' } },
    'https://ownback.example.com/profiles/ownback-ucp.json',
    fetcher,
  );
  assert.equal(url, 'https://demo.myshopify.com/api/ucp/mcp');
  assert.equal(body.params.name, 'search_catalog');
  assert.equal(body.params.arguments.catalog.query, 'coffee');
  assert.equal(out.products[0].id, goodProduct.id);
});
test('UCP errors are never presented as success', () => {
  assert.throws(() => unwrapMcp({ error: { message: 'Forbidden' } }));
  assert.throws(() => unwrapMcp({ result: { isError: true, structuredContent: { cart: {} } } }));
  assert.deepEqual(permittedCheckoutHosts('shop.example.com,evil..com'), ['shop.example.com']);
});
test('complete mocked buyer journey: catalog -> verify variant -> cart handoff, no payment execution', async () => {
  const calls = [];
  const mock = async (url, init) => {
    const req = JSON.parse(init.body);
    calls.push(req.params.name);
    const data =
      req.params.name === 'search_catalog'
        ? { products: [goodProduct] }
        : req.params.name === 'lookup_catalog'
          ? { products: [goodProduct] }
          : {
              cart: {
                id: 'gid://shopify/Cart/order-01',
                continue_url: 'https://demo.myshopify.com/cart/c/order-01',
              },
            };
    return { ok: true, json: async () => ({ result: { structuredContent: data } }) };
  };
  const profile = 'https://ownback.example.com/profiles/ownback-ucp.json';
  const product = normaliseCatalog(
    await callShopifyUcp(
      'demo.myshopify.com',
      'search_catalog',
      { catalog: { query: 'coffee' } },
      profile,
      mock,
    ),
  )[0];
  const available = normaliseCatalog(
    await callShopifyUcp(
      'demo.myshopify.com',
      'lookup_catalog',
      { catalog: { ids: [product.variants[0].id] } },
      profile,
      mock,
    ),
  );
  assert.equal(available[0].variants[0].available, true);
  const cart = await callShopifyUcp(
    'demo.myshopify.com',
    'create_cart',
    { cart: { line_items: [{ quantity: 1, item: { id: product.variants[0].id } }] } },
    profile,
    mock,
  );
  assert.equal(
    parseCart(cart, 'demo.myshopify.com').continueUrl,
    'https://demo.myshopify.com/cart/c/order-01',
  );
  assert.deepEqual(calls, ['search_catalog', 'lookup_catalog', 'create_cart']);
});
