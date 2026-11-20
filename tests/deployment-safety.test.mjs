import test from 'node:test';
import assert from 'node:assert/strict';
import {assertShopifyClaimMode} from '../scripts/shopify-claim-mode.mjs';
import {inspectStagingConfig} from '../scripts/staging-release-guard.mjs';
const base = {
  NEXT_PUBLIC_CHAIN_ID: '84532', SHOPIFY_REWARD_CHAIN_ID: '84532', COMMERCE_CHAIN_ID: '84532',
  BUILDER_CODE: 'ownback', NEXT_PUBLIC_BUILDER_CODE: 'ownback',
  OWNBACK_REQUIRE_BUILDER_CODE: 'true', NEXT_PUBLIC_REQUIRE_BUILDER_CODE: 'true',
  NEXT_PUBLIC_OWNBACK_ADDRESS: '0x1111111111111111111111111111111111111111',
  NEXT_PUBLIC_ADAPTER_ADDRESS: '0x2222222222222222222222222222222222222222',
};
test('testnet email claim can only advertise mock stock', () => {
  assert.deepEqual(assertShopifyClaimMode(base), {chainId:84532,asset:'TESTNET / MOCK STOCK',mainnetClaimsAllowed:false});
});
test('mainnet email claims cannot be enabled by any flag combination', () => {
  for (const approved of ['true','false']) for (const live of ['true','false']) {
    assert.throws(()=>assertShopifyClaimMode({...base,SHOPIFY_REWARD_CHAIN_ID:'8453',SHOPIFY_LIVE_STOCK_ENABLED:live,MAINNET_OPERATIONS_APPROVED:approved}), /MAINNET_SHOPIFY_CLAIMS_DISABLED/);
  }
});
test('testnet claim worker rejects live-stock advertising and unsupported chains', () => {
  assert.throws(()=>assertShopifyClaimMode({...base,SHOPIFY_LIVE_STOCK_ENABLED:'true'}),/MOCK_STOCK_ONLY/);
  assert.throws(()=>assertShopifyClaimMode({...base,SHOPIFY_REWARD_CHAIN_ID:'1'}),/Unsupported/);
});
test('valid Sepolia pilot configuration passes static guard',()=>{
  assert.equal(inspectStagingConfig(base).ok,true);
});
test('wrong chain or live-money switches are blocked',()=>{
  for(const altered of [
    {NEXT_PUBLIC_CHAIN_ID:'8453'}, {COMMERCE_CHAIN_ID:'8453'}, {SHOPIFY_REWARD_CHAIN_ID:'8453'},
    {MAINNET_OPERATIONS_APPROVED:'true'}, {SHOPIFY_LIVE_STOCK_ENABLED:'true'},
    {COMMERCE_LIVE_STOCK_ENABLED:'true'}, {NEXT_PUBLIC_LIVE_STOCK_ENABLED:'true'}
  ]) assert.equal(inspectStagingConfig({...base,...altered}).ok,false);
});
test('missing or inconsistent attribution configuration blocks release',()=>{
  for(const altered of [{BUILDER_CODE:'different'}, {NEXT_PUBLIC_BUILDER_CODE:''}, {OWNBACK_REQUIRE_BUILDER_CODE:'false'}])
    assert.equal(inspectStagingConfig({...base,...altered}).ok,false);
});
test('empty or zero address blocks release',()=>{
  for(const address of ['', '0x'+'0'.repeat(40),'abc'])
    assert.equal(inspectStagingConfig({...base,NEXT_PUBLIC_OWNBACK_ADDRESS:address}).ok,false);
});
