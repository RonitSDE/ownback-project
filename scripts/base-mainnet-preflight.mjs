/**
 * Base mainnet safety preflight. --offline: validates release code & canonical constants
 * with NO network / money / deployment. Default: read-only JSON-RPC probes.
 * No private keys, wallet signatures or transaction submission are ever required here.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
// The read-only preflight can run without third-party deps, even before npm ci.
// Node 22 loads the same .env file used by the app/workers.
if (!process.argv.includes('--offline') && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env'); } catch { /* Explicit process.env is also supported. */ }
}

export const BASE_CHAIN_ID = 8453;
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const STOCKS = Object.freeze({
  AAPLc: {token:'0xb200000000000000000000C2e324d24d7eEcd1fb',feed:'0x787f13dEa48Db0897CbCDD985de77809D837F988',decimals:8},
  NVDAc: {token:'0xb20000000000000000000078ee7ce2fE4908108C',feed:'0x04689a41629776563E6822F76f2e57D148d28513',decimals:8},
});
const eq = (a,b) => String(a||'').toLowerCase() === String(b||'').toLowerCase();
const check = (ok, why) => { if(!ok) throw new Error(why); };

export function staticCheck(){
  const read=f=>readFileSync(f,'utf8');
  const deployment=read('contracts/script/DeployMainnet.s.sol');
  const stock=read('contracts/src/mainnet/InventoryB20Adapter.sol');
  const buyer=read('contracts/src/mainnet/OwnbackMainnet.sol');
  const shopify=read('contracts/src/mainnet/ShopifyRewardVaultMainnet.sol');
  check(deployment.includes('MAINNET_DEPLOY_APPROVED')&&deployment.includes('block.chainid == 8453'), 'Deployment is not explicitly gated to Base mainnet');
  check(!deployment.includes('MockUSDC')&&!deployment.includes('MockB20Stock'), 'Mainnet deploy references mocks');
  check(stock.includes('NATIVE_BASE_USDC')&&stock.includes('if (block.chainid != 8453)'), 'Mainnet adapter chain/USDC guard absent');
  check(stock.includes('latestRoundData()')&&stock.includes('block.timestamp - updatedAt > maxPriceAge'), 'No source-time oracle freshness guard');
  check(stock.includes('stockToken.safeTransfer(recipient, stockOut)')&&!stock.includes('.mint('), 'Adapter must deliver existing B20 inventory');
  check(buyer.includes('eligibleRecipient[msg.sender]')&&buyer.includes('eligibleRecipient[p.customer]'), 'Native eligibility gate absent');
  check(shopify.includes('eligibleRecipient[recipient]')&&shopify.includes('NATIVE_USDC_ONLY')&&shopify.includes('MIN_24H_REFUND_HOLD'), 'Shopify recipient eligibility/refund guard absent');
  check(read('src/app/shop/page.tsx').includes('illustrative test-store catalog'), 'Mainnet fake product checkout not disabled');
  check(read('scripts/shopify-settle.ts').includes('functionName:\'quote\'')&&read('scripts/shopify-settle.ts').includes('MAINNET_OPERATIONS_APPROVED'), 'Live worker cannot quote approved inventory safely');
  return true;
}

function toWord(data,n){return BigInt('0x'+data.slice(2+64*n,2+64*(n+1)));}
async function rpc(url,method,params=[]){
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw new Error(`${method} returned HTTP ${response.status}`);
  const body=await response.json();if(body.error||!body.result)throw new Error(`${method}: ${body.error?.message||'empty result'}`);
  return body.result;
}
const call=(url,to,data)=>rpc(url,'eth_call',[{to,data},'latest']);
export async function onchainCheck(env=process.env){
  const url=env.BASE_MAINNET_RPC_URL;
  check(/^https:\/\//.test(url||''),'HTTPS BASE_MAINNET_RPC_URL is required');
  check(await rpc(url,'eth_chainId')==='0x2105','RPC does not resolve to Base mainnet chain ID 8453');
  const symbol=env.NEXT_PUBLIC_STOCK_SYMBOL||'AAPLc';
  const item=STOCKS[symbol];check(item,'Unsupported stock: verify issuer listing, then extend explicit allowlist');
  check(eq(env.BASE_STOCK_ADDRESS,item.token),'B20 stock address differs from canonical Base listing');
  check(eq(env.BASE_STOCK_FEED,item.feed),'Chainlink total-return feed differs from canonical Base docs');
  check(eq(env.NEXT_PUBLIC_USDC_ADDRESS,BASE_USDC),'Public USDC is not canonical Circle native Base USDC');
  const usdcDecimals=Number(BigInt(await call(url,BASE_USDC,'0x313ce567')));
  const stockDecimals=Number(BigInt(await call(url,item.token,'0x313ce567')));
  const feedDecimals=Number(BigInt(await call(url,item.feed,'0x313ce567')));
  check(usdcDecimals===6&&stockDecimals===item.decimals&&feedDecimals===8,'Unexpected token or feed decimals');
  const feedResult=await call(url,item.feed,'0xfeaf968c');
  check(feedResult.length>=2+64*5,'Malformed oracle response');
  const answer=toWord(feedResult,1);const updatedAt=toWord(feedResult,3);
  check(answer>0n&&updatedAt>0n,'Zero oracle answer or timestamp');
  const block=await rpc(url,'eth_getBlockByNumber',['latest',false]);
  const now=BigInt(block.timestamp);
  const age=now-updatedAt;
  const maxAge=BigInt(env.MAINNET_MAX_PRICE_AGE_SECONDS||'5400');
  check(age>=0n&&age<=maxAge,'B20 oracle is stale: refuse all settlement, even if token trades on DEX');
  // B20 precompiles may have no normal EVM bytecode: validate decimals/registry instead of code length.
  // Deployed OWNBACK/vault/adapter addresses must be checked after operator provides them.
  for (const key of ['NEXT_PUBLIC_OWNBACK_ADDRESS','NEXT_PUBLIC_ADAPTER_ADDRESS','SHOPIFY_REWARD_VAULT_ADDRESS','SHOPIFY_REWARD_ADAPTER_ADDRESS']){
    const address=env[key];check(/^0x[0-9a-fA-F]{40}$/.test(address||''),`${key} must be an actual deployed contract`);
    const code=await rpc(url,'eth_getCode',[address,'latest']);
    check(code!=='0x'&&code.length>8,`${key} has no EVM bytecode on Base mainnet`);
  }
  // This is a *pre*-launch inspection: do not require operator approval simply to inspect
  // chain state. Approval is a separate manual governance gate after canary reconciliation.
  return {chainId:8453,symbol,stock:item.token,feed:item.feed,ageSeconds:Number(age),priceReference:answer.toString(),operationsApproved:env.MAINNET_OPERATIONS_APPROVED==='true',readyForManualReview:true};
}

if(process.argv[1]?.endsWith('/base-mainnet-preflight.mjs')){
  try {
    staticCheck();
    console.log('PASS: mainnet source guards and separation from demo/mock contracts');
    if(process.argv.includes('--offline'))console.log('OFFLINE ONLY: no RPC, no deployed contracts, no funds, no real delivery verified');
    else console.log(JSON.stringify(await onchainCheck(),null,2));
  }catch(error){console.error('BASE MAINNET PREFLIGHT FAILED:',error.message);process.exitCode=1}
}
