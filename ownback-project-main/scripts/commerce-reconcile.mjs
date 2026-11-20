import 'dotenv/config';
// TypeScript is loaded by tsx: npm run commerce:reconcile
import { reconcileOpen } from '../src/lib/commerce/orders.ts';
const results = await reconcileOpen(100);
for (const r of results) console.log(JSON.stringify(r));
