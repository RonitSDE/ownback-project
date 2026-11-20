/** Capture a genuine three-transaction lifecycle from the running, previously-deployed Anvil chain.
 * Must run AFTER npm run e2e:local, while the SAME Anvil process remains alive.
 * Chain 31337 and mock USDC/stock only: zero publicly verifiable mainnet traction.
 * This script NEVER invents hashes, logs, orders or receipts.
 */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {EVENTS,rpcCall} from './chain-proof.mjs';
const url=process.env.ANVIL_RPC_URL||'http://127.0.0.1:8545';
const deployment=JSON.parse(readFileSync(process.env.DEPLOYMENT_FILE||'contracts/deployments/31337.json','utf8'));
if(deployment.chainId!==31337)throw Error('Capture is ANVIL ONLY; expected chain 31337 deployment');
const chain=await rpcCall(url,'eth_chainId');
if(Number(BigInt(chain))!==31337)throw Error('RPC is not an Anvil chain ID 31337');
const contract=deployment.ownback;
if(!/^0x[0-9a-fA-F]{40}$/.test(contract||''))throw Error('Invalid deployed Ownback contract address');
const eventLogs=async id=>await rpcCall(url,'eth_getLogs',[{address:contract,topics:[EVENTS[id]],fromBlock:'0x0',toBlock:'latest'}]);
const [funded,paid,delivered]=await Promise.all(['campaign_funding','order_payment','settlement_refusal'].map(eventLogs));
const value=x=>BigInt(x||'0x0');
function matchingProof(){
 for(const p of paid){
  if(p.topics?.length!==4||p.data?.length<2+64*4)continue;
  const purchaseId=value(p.topics[1]),campaignId=value(p.topics[2]),customer=p.topics[3]?.slice(-40)?.toLowerCase();
  const f=funded.find(x=>x.topics?.length===2&&value(x.topics[1])===campaignId);
  const s=delivered.find(x=>x.topics?.length===4&&value(x.topics[1])===purchaseId&&value(x.topics[2])===campaignId&&x.topics[3]?.slice(-40)?.toLowerCase()===customer);
  if(f&&s&&f.transactionHash!==p.transactionHash&&s.transactionHash!==p.transactionHash){
   return {f,p,s,orderRef:'0x'+p.data.slice(-64),purchaseId:purchaseId.toString(),campaignId:campaignId.toString()};
  }
 }
 throw Error('No coherent funded → paid → delivered lifecycle found on the running chain');
}
const r=matchingProof();
const proofs=[['campaign_funding',r.f],['order_payment',r.p],['settlement_refusal',r.s]];
for(const [id,log] of proofs){
 const args=[`--id=${id}`,'--environment=ANVIL',`--hash=${log.transactionHash}`,`--contract=${contract}`];
 if(id==='order_payment')args.push(`--orderRef=${r.orderRef}`);
 execFileSync(process.execPath,['scripts/capture-chain-proof.mjs',...args],{stdio:'inherit',env:{...process.env,ANVIL_RPC_URL:url}});
}
console.log(`ANVIL ONLY / MOCK STOCK / NOT PUBLIC: campaign ${r.campaignId}, purchase ${r.purchaseId}. Three real LOCAL receipts captured.`);
console.log('Preference HTTP 200→409 remains a fourth, separate API proof. Strict gate should remain red until captured.');
