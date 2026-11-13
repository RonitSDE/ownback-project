/** Strict verification requires chain RPC checks, not merely plausible-looking hashes. */
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {CHAIN_IDS,EVENTS,rpcCall,verifyChainReceipt,verifyProofLifecycle} from './chain-proof.mjs';
const strict=process.argv.includes('--strict');
const doc=JSON.parse(readFileSync('evidence/proofs.json','utf8'));
const required=Object.keys(EVENTS).concat('preference_replay');
const problems=[];const verified=[];const seen=new Set();const onchainDetails=[];
const formatHash=/^0x[a-fA-F0-9]{64}$/;
function evidencePath(path){return typeof path==='string'&&/^evidence\/(receipts|logs)\/[\w./-]+$/.test(path)&&!path.includes('..')&&existsSync(resolve(path));}
function chainRpc(env){return env==='BASE_SEPOLIA'?process.env.BASE_SEPOLIA_RPC_URL:env==='BASE_MAINNET'?process.env.BASE_MAINNET_RPC_URL:process.env.ANVIL_RPC_URL||process.env.RPC_URL;}
for(const id of required){if(doc.proofs.filter(row=>row.id===id).length!==1)problems.push(`${id}: proof entry must appear exactly once`)}
for(const row of doc.proofs){
 if(!required.includes(row.id)){problems.push(`${row.id}: unexpected proof ID`);continue}
 if(row.status==='MISSING'){if(strict)problems.push(`${row.id}: proof not attached`);continue}
 if(row.status!=='VERIFIED'){problems.push(`${row.id}: invalid evidence status`);continue}
 if(!Object.hasOwn(CHAIN_IDS,row.environment)){problems.push(`${row.id}: invalid environment`);continue}
 if(row.environment==='ANVIL'&&row.url){problems.push(`${row.id}: Anvil has no public explorer URL`);continue}
 if(row.id==='preference_replay'){
  if(!evidencePath(row.evidenceFile)){problems.push('preference_replay: signed preference and HTTP 409 evidence JSON is missing');continue}
  try{
   const proof=JSON.parse(readFileSync(row.evidenceFile,'utf8'));
   if(proof.environment!==row.environment||proof.kind!=='preference_replay'||proof.first?.status!==200||proof.replay?.status!==409||proof.sameSignedPayload!==true||!formatHash.test(proof.payloadDigest)||!proof.first?.requestId||!proof.replay?.requestId||proof.first.requestId===proof.replay.requestId){
    throw new Error('needs identical signed payload, first HTTP 200, replay HTTP 409, distinct request IDs and a digest');
   }
   verified.push(row.id);
  }catch(e){problems.push(`preference_replay: ${e.message}`)}
  continue;
 }
 if(!formatHash.test(row.transactionHash)||seen.has(row.transactionHash.toLowerCase())){problems.push(`${row.id}: invalid or duplicate transaction hash`);continue}
 seen.add(row.transactionHash.toLowerCase());
 const base=row.environment==='BASE_MAINNET'?'https://basescan.org/tx/':row.environment==='BASE_SEPOLIA'?'https://sepolia.basescan.org/tx/':null;
 if(base&&row.url?.toLowerCase()!==(base+row.transactionHash).toLowerCase()){problems.push(`${row.id}: explorer URL does not match hash and chain`);continue}
 if(row.id==='order_payment'&&!formatHash.test(row.orderRef)){problems.push(`${row.id}: missing orderRef`);continue}
 if(!/^0x[0-9a-fA-F]{40}$/.test(row.contractAddress||'')){problems.push(`${row.id}: missing OWNBACK contract address`);continue}
 if(!strict){verified.push(row.id);continue}
 // The onchain snapshot is required in addition to querying the current chain.
 // A plausible transaction hash alone must never satisfy the release gate.
 if(!evidencePath(row.evidenceFile)){problems.push(`${row.id}: local captured receipt file missing`);continue}
 try {
  const saved=JSON.parse(readFileSync(row.evidenceFile,'utf8'));
  if(saved.transactionHash?.toLowerCase()!==row.transactionHash.toLowerCase() ||
     saved.receipt?.transactionHash?.toLowerCase()!==row.transactionHash.toLowerCase() ||
     saved.receipt?.to?.toLowerCase()!==row.contractAddress.toLowerCase() ||
     saved.chainId!==CHAIN_IDS[row.environment] ||
     !/^0x[0-9a-fA-F]{64}$/.test(saved.receipt?.blockHash||'')){
   throw Error('Saved receipt/contract/chain mismatch');
  }
 }catch(e){problems.push(`${row.id}: invalid captured receipt: ${e.message}`);continue}
 const url=chainRpc(row.environment);
 if(!url||!/^https?:\/\//.test(url)){problems.push(`${row.id}: provide RPC via BASE_SEPOLIA_RPC_URL, BASE_MAINNET_RPC_URL or ANVIL_RPC_URL`);continue}
 try{
  const verifiedReceipt=await verifyChainReceipt(row,(method,params)=>rpcCall(url,method,params));
  const saved=JSON.parse(readFileSync(row.evidenceFile,'utf8'));
  if(saved.receipt.blockHash.toLowerCase()!==verifiedReceipt.blockHash.toLowerCase() ||
     BigInt(saved.receipt.blockNumber)!==BigInt(verifiedReceipt.blockNumber))throw Error('Saved receipt is not the current canonical receipt');
  if(saved.campaignId!==verifiedReceipt.campaignId||saved.purchaseId!==verifiedReceipt.purchaseId||saved.customer!==verifiedReceipt.customer)
   throw Error('Saved receipt event identity does not match canonical chain event');
  console.log(`  ${row.id}: receipt OK on chain ${verifiedReceipt.chainId}, block ${verifiedReceipt.blockNumber}`);
  onchainDetails.push({id:row.id,...verifiedReceipt});
  verified.push(row.id);
 }catch(e){problems.push(`${row.id}: ${e.message}`)}
}
const environments=[...new Set(doc.proofs.filter(r=>r.status==='VERIFIED'&&r.id!=='preference_replay').map(r=>r.environment))];
if(environments.length>1)problems.push('Onchain receipts mix networks; use one declared environment for hero flow');
if(strict&&onchainDetails.length===3){
 try {const link=verifyProofLifecycle(onchainDetails);console.log(`  Coherent campaign ${link.campaignId}, purchase ${link.purchaseId}`)}
 catch(e){problems.push(`Lifecycle linkage: ${e.message}`)}
}
const rows=doc.proofs.filter(r=>Object.hasOwn(EVENTS,r.id)&&r.status==='VERIFIED');
if(rows.length===3){
 if(new Set(rows.map(r=>r.contractAddress?.toLowerCase())).size!==1)
  problems.push('Chain receipts use different Ownback contract addresses; use one deployed merchant lifecycle');
 const preference=doc.proofs.find(r=>r.id==='preference_replay');
 if(preference?.status==='VERIFIED'&&preference.environment!==rows[0].environment)
  problems.push('Preference replay proof environment does not match chain lifecycle');
}
console.log(`OWNBACK proofs: ${verified.length}/${required.length} ${strict?'checked with RPC for chain events and file validation for preference':'structurally checked'}; signed preferences are not blockchain trades.`);
if(problems.length){for(const p of problems)console.error('  - '+p);process.exitCode=1}
else if(!strict)console.log('CAUTION: structural evidence is not verified chain execution. Run verify:proofs:strict before publication.');
