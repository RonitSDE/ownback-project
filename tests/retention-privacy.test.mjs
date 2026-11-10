import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('merchant observed analytics requires server-side merchant session and never manufactures control lift',()=>{
 const src=read('src/app/api/retention/overview/route.ts');
 assert.match(src,/adminAuthorized\(\)/);assert.match(src,/experimentalLift:null/);
 assert.match(src,/crossChannelDeduplication:false/);
 assert.match(src,/no-store, private/);
 assert.doesNotMatch(src,/Math\.random\(/);
});
test('shopper Shopify history is gated behind signature, expires, same origin and rate limit',()=>{
 const src=read('src/app/api/retention/portfolio/route.ts');
 for(const part of ['sameOrigin(req)','verifyMessage','expiresAt<Date.now()','enforceLimit','wallet.toLowerCase()','no-store, private'])assert.ok(src.includes(part),part);
 assert.ok(src.includes("'DELIVERED','REFUNDED_AFTER_DELIVERY'"),'late-refund delivery evidence must remain visible');
});
test('no example is labelled as live equity and unsupported B20 execution is not claimed',()=>{
 for(const p of ['src/app/page.tsx','src/app/ownership/page.tsx','src/app/protocol/page.tsx']){
  const s=read(p);assert.match(s,/Sepolia|testnet/i,p);
 }
 const port=read('src/app/ownership/page.tsx');assert.match(port,/not real securities|no real securities|not real securities/i);
});
test('source preview permanently identifies simulations and contains the explicit four-step reward finality',()=>{
 const html=read('public/preview/v3.7.html');
 assert.match(html,/INTERACTIVE DEMO · NO REAL FUNDS/);assert.match(html,/No real securities|no live securities|not real securities|not an actual wallet|no live money or stock/i);
 for(const state of ['reserved','eligible','settling','owned'])assert.match(html,new RegExp(state));
});
