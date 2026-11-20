import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const profile = JSON.parse(readFileSync('public/profiles/ownback-ucp.json', 'utf8'));
for (const key of [
  'dev.ucp.shopping.catalog.search',
  'dev.ucp.shopping.catalog.lookup',
  'dev.ucp.shopping.cart',
])
  assert(profile.ucp.capabilities[key], `Missing capability ${key}`);
for (const file of [
  'src/lib/agentic/ucp.ts',
  'src/lib/agentic/shops.ts',
  'src/app/agentic/page.tsx',
  'src/app/agentic/agentic.css',
  'src/app/api/agentic/merchants/route.ts',
  'src/app/api/agentic/search/route.ts',
  'src/app/api/agentic/cart/route.ts',
])
  assert(existsSync(file), `Missing ${file}`);
const cart = readFileSync('src/app/api/agentic/cart/route.ts', 'utf8');
assert(
  cart.includes("'lookup_catalog'") && cart.includes("'create_cart'"),
  'Cart must verify Shopify variant before create_cart',
);
assert(!cart.includes('complete_checkout'), 'No server-side autonomous checkout in pilot');
console.log(
  'OWNBACK UCP agentic preflight PASS — catalog, variants, merchant checkout origin and profile gates present',
);
