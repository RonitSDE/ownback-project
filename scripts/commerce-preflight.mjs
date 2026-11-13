import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const need = [
  'commerce/schema.sql',
  'commerce/seed-demo.sql',
  'src/app/commerce/page.tsx',
  'src/app/commerce/store.css',
  'src/app/commerce/admin/page.tsx',
  'src/lib/commerce/core.ts',
  'src/lib/commerce/db.ts',
  'src/lib/commerce/auth.ts',
  'src/lib/commerce/orders.ts',
  'src/lib/commerce/indexer.ts',
  'src/app/api/commerce/orders/route.ts',
  'src/app/api/commerce/orders/[id]/confirm/route.ts',
  'src/app/api/commerce/admin/reconcile/route.ts',
  'docker-compose.commerce.yml',
  'DEPLOY.md',
];
let fail = false;
for (const name of need) {
  if (!existsSync(join(process.cwd(), name))) {
    console.error('Missing:', name);
    fail = true;
  }
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const dep of ['pg', 'viem', 'next'])
  if (!pkg.dependencies[dep]) {
    console.error('Missing dependency', dep);
    fail = true;
  }
const orders = readFileSync('src/lib/commerce/orders.ts', 'utf8');
for (const pattern of ['FOR UPDATE', 'stock_reserved', 'verifyPayment', 'expectedRef', 'usedOnchain'])
  if (!orders.includes(pattern)) {
    console.error('Expected protection missing', pattern);
    fail = true;
  }
const c = readFileSync('contracts/src/Ownback.sol', 'utf8');
for (const pattern of ['OrderRefUsed', 'RewardBelowMinimum', 'QuoteExpired', 'emit Purchased'])
  if (!c.includes(pattern)) {
    console.error('Missing onchain guard', pattern);
    fail = true;
  }
console.log(fail ? 'Commerce preflight FAILED' : 'Commerce preflight PASS');
if (fail) process.exit(1);
