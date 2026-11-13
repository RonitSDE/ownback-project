import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BASE_CHAIN_ID, BASE_USDC, STOCKS, staticCheck} from '../scripts/base-mainnet-preflight.mjs';
const read=file=>readFileSync(file,'utf8');

test('mainnet isolated contract stack rejects mocks and wrong chain',()=>{
 assert.equal(BASE_CHAIN_ID,8453);assert.equal(BASE_USDC,'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
 assert.equal(staticCheck(),true);
});
test('AAPLc and NVDAc assets are fixed by address and official Chainlink feeds',()=>{
 assert.equal(STOCKS.AAPLc.token,'0xb200000000000000000000C2e324d24d7eEcd1fb');
 assert.equal(STOCKS.AAPLc.feed,'0x787f13dEa48Db0897CbCDD985de77809D837F988');
 assert.equal(STOCKS.NVDAc.decimals,8);
});
test('real reward examples use integer math with 8-decimal B20 token and $350 total-return oracle',()=>{
 const one=48_000_000n*200n/10_000n;
 const comeback=48_000_000n*500n/10_000n;
 assert.equal(one,960_000n);assert.equal(comeback,2_400_000n);
 function quote(usdcIn, price8){const scaled=usdcIn*100_000_000n/1_000_000n;return scaled*100_000_000n/price8}
 const price=350n*100_000_000n;
 assert.equal(quote(one,price),274285n);assert.equal(quote(comeback,price),685714n);
 assert.equal(quote(one,price+1n),274285n); // rounding and high precision
});
test('mainnet native checkout prevents promises to unverified wallets',()=>{
 const s=read('contracts/src/mainnet/OwnbackMainnet.sol');
 assert.match(s,/if \(!eligibleRecipient\[msg\.sender\]\) revert RecipientNotEligible/);
 assert.match(s,/if \(!eligibleRecipient\[customer\]\) return \(Kind.NONE, 0\)/);
 assert.match(s,/if \(!eligibleRecipient\[p\.customer\]\) revert RecipientNotEligible/);
});
test('Shopify claims and settlement do not imply actual stock delivery before receipt',()=>{
 assert.match(read('scripts/shopify-settle.ts'),/parseEventLogs/);
 assert.match(read('scripts/shopify-settle.ts'),/confirm\(\{\.\.\.order,status:'SETTLING'/);
 assert.match(read('contracts/src/mainnet/ShopifyRewardVaultMainnet.sol'),/require\(eligibleRecipient\[recipient\],"RECIPIENT_NOT_ELIGIBLE"\)/);
});
test('normal testnet deploy never accepts mainnet and mainnet deploy never creates test stock',()=>{
 assert.match(read('contracts/script/DeployTestnet.s.sol'),/TESTNET_ONLY_DEPLOYMENT/);
 assert.doesNotMatch(read('contracts/script/DeployMainnet.s.sol'),/new Mock|\.faucet\(/);
});


test('mainnet checkout requires refund hold and all controllers use two-step ownership',()=>{
 const native=read('contracts/src/mainnet/OwnbackMainnet.sol');
 const shopify=read('contracts/src/mainnet/ShopifyRewardVaultMainnet.sol');
 const adapter=read('contracts/src/mainnet/InventoryB20Adapter.sol');
 assert.match(native,/holdSeconds < 24 hours/);
 assert.match(shopify,/MIN_24H_REFUND_HOLD/);
 assert.match(shopify,/is Ownable2Step, ReentrancyGuard/);
 assert.match(adapter,/is IStockAdapter, Ownable2Step, ReentrancyGuard/);
});
