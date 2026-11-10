import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let ts;
try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const path=new URL('../src/lib/commerce/core.ts',import.meta.url);
const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,Buffer,require:(id)=>{
 if(id==='node:crypto')return require(id);
 if(id==='viem')return {toHex:(s)=>Buffer.from(s).toString('hex'),keccak256:(s)=>'0x'+createHash('sha256').update(s).digest('hex')};
 throw Error(`Unexpected dependency ${id}`)
}}, {filename:'src/lib/commerce/core.ts'});
const {canonicalCart,totalFor,equalSecret,hashSecret,orderReference}=mod.exports;
const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
test('rejects empty and oversized carts',()=>{assert.throws(()=>canonicalCart([]));assert.throws(()=>canonicalCart(Array(21).fill({productId:a,quantity:1})));});
test('sorts and accepts two products',()=>assert.equal(canonicalCart([{productId:b,quantity:1},{productId:a,quantity:2}])[0].productId,a));
test('rejects duplicates',()=>assert.throws(()=>canonicalCart([{productId:a,quantity:1},{productId:a,quantity:1}])));
test('rejects invalid quantities',()=>{for(const q of [0,-1,1.1,21,'3'])assert.throws(()=>canonicalCart([{productId:a,quantity:q}]))});
test('micro USDC math is exact',()=>assert.equal(totalFor([{unit_usdc:'24000000',quantity:2},{unit_usdc:'6000000',quantity:1}]),54000000n));
test('rejects zero and overflow',()=>{assert.throws(()=>totalFor([{unit_usdc:0,quantity:1}]));assert.throws(()=>totalFor([{unit_usdc:2n**128n,quantity:1}]))});
test('different receipts do not compare equal',()=>{assert.equal(equalSecret('abc',hashSecret('abc')),true);assert.equal(equalSecret('abc','abc'),false);assert.equal(equalSecret('abc','xyz'),false)});
test('unique reference changes with order, campaign or vault',()=>{const x=orderReference(a,84532,'0xabc','1');assert.notEqual(x,orderReference(b,84532,'0xabc','1'));assert.notEqual(x,orderReference(a,84532,'0xabc','2'));assert.notEqual(x,orderReference(a,84532,'0xdef','1'))});
