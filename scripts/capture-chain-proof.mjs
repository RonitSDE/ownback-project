/** Capture only a confirmed OWNBACK event from an existing transaction. No wallet keys required. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {CHAIN_IDS,rpcCall,verifyChainReceipt} from './chain-proof.mjs';
const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')&&x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(2,i),x.slice(i+1)]}));
const id=args.id,environment=args.environment,hash=args.hash,contractAddress=args.contract,orderRef=args.orderRef;
if(!['campaign_funding','order_payment','settlement_refusal'].includes(id)||!Object.hasOwn(CHAIN_IDS,environment)){
 console.error('Usage: node scripts/capture-chain-proof.mjs --id=campaign_funding|order_payment|settlement_refusal --environment=BASE_SEPOLIA|ANVIL|BASE_MAINNET --hash=0x... --contract=0x... [--orderRef=0x...]');process.exit(1)
}
const url=environment==='BASE_SEPOLIA'?process.env.BASE_SEPOLIA_RPC_URL:environment==='BASE_MAINNET'?process.env.BASE_MAINNET_RPC_URL:process.env.ANVIL_RPC_URL||process.env.RPC_URL;
if(!url||!/^https?:\/\//.test(url))throw new Error('RPC URL missing: set BASE_SEPOLIA_RPC_URL, BASE_MAINNET_RPC_URL or ANVIL_RPC_URL');
const row={id,environment,transactionHash:hash,contractAddress};if(id==='order_payment')row.orderRef=orderRef;
const call=(method,params)=>rpcCall(url,method,params);
const verified=await verifyChainReceipt(row,call);
const receipt=await call('eth_getTransactionReceipt',[hash]);
const file=`evidence/receipts/${id}-${hash.slice(2,10)}.json`;
mkdirSync('evidence/receipts',{recursive:true});
writeFileSync(file,JSON.stringify({disclosure: environment==='ANVIL'?'LOCAL ANVIL ONLY — NOT PUBLIC CHAIN':'PUBLIC TESTNET OR MAINNET — VERIFY ELIGIBILITY',recordedAt:new Date().toISOString(),...verified,receipt},null,2)+'\n');
const doc=JSON.parse(readFileSync('evidence/proofs.json','utf8'));const original=doc.proofs.find(x=>x.id===id);if(!original)throw new Error(`Unknown proof slot ${id}`);
Object.assign(original,{...row,url:environment==='ANVIL'?null:environment==='BASE_SEPOLIA'?`https://sepolia.basescan.org/tx/${hash}`:`https://basescan.org/tx/${hash}`,evidenceFile:file,status:'VERIFIED'});
writeFileSync('evidence/proofs.json',JSON.stringify(doc,null,2)+'\n');
console.log(`${id}: receipt and OWNBACK event confirmed on chain ${verified.chainId}; saved ${file}. Re-run strict gate and refresh manifest.`);
