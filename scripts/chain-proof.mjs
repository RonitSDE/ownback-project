/** Chain evidence checks are read-only. No private keys, no transaction broadcasts. */
export const CHAIN_IDS = Object.freeze({ANVIL: 31337, BASE_SEPOLIA: 84532, BASE_MAINNET: 8453});
export const EVENTS = Object.freeze({
 campaign_funding: '0x318daf69d77e946364e804495b2184222324b99fddeb42ab5fd25a919f596e8c', // CampaignFunded(uint256,uint256)
 order_payment: '0xa1fb21cd47e4eb0e5b563434af4b441d77f8b51a585cfc0184e86e818d65fcfe', // Purchased(uint256,uint256,address,uint256,uint8,uint256,bytes32)
 settlement_refusal: '0xe7aaaf1c995654db9e57796f8688aded9e7c77d0faaf214b4428a7b800248c60', // RewardDelivered(uint256,uint256,address,address,uint256,uint256,uint8)
});
const isHash = x => /^0x[a-fA-F0-9]{64}$/.test(x||'');
const isAddr = x => /^0x[a-fA-F0-9]{40}$/.test(x||'');
const eq = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

export async function rpcCall(url, method, params=[], fetchImpl=fetch) {
 const ctrl = new AbortController(); const timer = setTimeout(()=>ctrl.abort(), 8000);
 try {
  const response = await fetchImpl(url, {method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:ctrl.signal});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reply=await response.json();
  if(reply.error) throw new Error(JSON.stringify(reply.error));
  if(reply.result===undefined) throw new Error('Missing JSON-RPC result');
  return reply.result;
 } finally {clearTimeout(timer)}
}

/** Throws unless a confirmed receipt on the claimed chain contains the expected OWNBACK event. */
export async function verifyChainReceipt(row, rpc) {
 if(!Object.hasOwn(EVENTS,row.id)) throw new Error('Unknown onchain proof kind');
 if(!isHash(row.transactionHash)) throw new Error('Missing or invalid transaction hash');
 if(!isAddr(row.contractAddress)) throw new Error('Missing or invalid OWNBACK contractAddress');
 if(row.id==='order_payment'&&!isHash(row.orderRef)) throw new Error('Paid order missing 32-byte orderRef');
 const chainId=await rpc('eth_chainId',[]);
 if(Number(BigInt(chainId))!==CHAIN_IDS[row.environment]) throw new Error(`Wrong chain ID (${chainId}) for ${row.environment}`);
 const receipt=await rpc('eth_getTransactionReceipt',[row.transactionHash]);
 if(!receipt) throw new Error('Transaction receipt not found on declared chain');
 if(!eq(receipt.transactionHash,row.transactionHash)) throw new Error('Receipt transaction hash mismatch');
 if(receipt.status!=='0x1') throw new Error('Transaction did not succeed; reverts do not establish stock settlement');
 if(!isHash(receipt.blockHash)||!receipt.blockNumber) throw new Error('Receipt has no confirmed block');
 if(!eq(receipt.to,row.contractAddress)) throw new Error('Transaction destination does not match OWNBACK contract');
 const block=await rpc('eth_getBlockByHash',[receipt.blockHash,false]);
 if(!block||!eq(block.hash,receipt.blockHash)||BigInt(block.number)!==BigInt(receipt.blockNumber)) throw new Error('Canonical block confirmation mismatch');
 const match=(receipt.logs||[]).find(log=>eq(log.address,row.contractAddress)&&eq(log.topics?.[0],EVENTS[row.id]));
 if(!match) throw new Error(`Expected ${row.id} contract event missing from receipt`);
 if(row.id==='order_payment'&&!String(match.data||'').toLowerCase().endsWith(row.orderRef.slice(2).toLowerCase())){
  throw new Error('Paid orderRef not found in Purchased event data');
 }
 // Inspect the event's actual indexed fields, not merely topic0.
 // CampaignFunded: campaignId; Purchased/RewardDelivered: purchaseId, campaignId, customer.
 const expectedTopics=row.id==='campaign_funding'?2:4;
 if(match.topics?.length!==expectedTopics||!match.topics.slice(1).every(x=>isHash(x)))
  throw new Error('Expected event is missing its indexed campaign/purchase/customer fields');
 const campaignId=BigInt(match.topics[row.id==='campaign_funding'?1:2]).toString();
 const purchaseId=row.id==='campaign_funding'?null:BigInt(match.topics[1]).toString();
 const customer=row.id==='campaign_funding'?null:'0x'+match.topics[3].slice(-40).toLowerCase();
 return {chainId:Number(BigInt(chainId)),transactionHash:receipt.transactionHash,blockHash:receipt.blockHash,blockNumber:Number(BigInt(receipt.blockNumber)),eventTopic:EVENTS[row.id],campaignId,purchaseId,customer};
}

/** Reject a collage of unrelated but individually successful transactions. */
export function verifyProofLifecycle(chainProofs) {
 const funding=chainProofs.find(p=>p.id==='campaign_funding');
 const payment=chainProofs.find(p=>p.id==='order_payment');
 const settlement=chainProofs.find(p=>p.id==='settlement_refusal');
 if(!funding||!payment||!settlement)throw new Error('Need all three contract event receipts');
 if(funding.campaignId!==payment.campaignId||payment.campaignId!==settlement.campaignId)
  throw new Error('Funding, order payment and settlement do not belong to the same campaign');
 if(payment.purchaseId!==settlement.purchaseId||payment.customer!==settlement.customer)
  throw new Error('Settlement is not for the paid order/customer');
 if(!(funding.blockNumber<=payment.blockNumber && payment.blockNumber<=settlement.blockNumber))
  throw new Error('Proof events have invalid fund → pay → settlement block order');
 return {campaignId:payment.campaignId,purchaseId:payment.purchaseId,customer:payment.customer};
}

