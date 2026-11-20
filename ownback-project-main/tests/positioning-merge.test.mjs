import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
test('differentiation appears on homepage and judge page', () => {
 for (const f of ['src/app/page.tsx','src/app/judge/page.tsx']) {
  const src=read(f);
  assert.match(src, /Other agents manage investment portfolios/);
  assert.match(src, /OWNBACK helps merchants turn purchases into measurable stock-linked loyalty/);
  assert.match(src, /mock.stock|mock stock/i);
 }
});
test('verification and explainable agent checks preserved',()=>{
 assert.ok(existsSync(new URL('src/app/verify/page.tsx',root)));
 assert.match(read('src/lib/allocation/policy.ts'), /constraintChecks/);
 assert.match(read('src/app/allocation/page.tsx'), /NOT_TESTED|constraintChecks/);
 assert.match(read('src/app/verify/page.tsx'), /RPC/);
});
test('branding and recovery harness are shipped',()=>{
 assert.ok(existsSync(new URL('public/miniapp/icon.png',root)));
 assert.ok(existsSync(new URL('public/ownback-social.png',root)));
 assert.match(read('src/app/layout.tsx'), /summary_large_image/);
 assert.match(read('scripts/simulate-recovery.mjs'), /shopifyBuilderDataSuffix/);
});
