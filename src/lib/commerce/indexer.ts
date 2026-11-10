import { parseEventLogs, type Hex } from 'viem';
import { ownbackAbi } from '@/lib/abi';
import { commercePublicClient,settings } from './chain';
import { confirmIndexedPayment,releaseOrder } from './orders';
import {pool} from './db';
const CHUNK=750n;
const confirmations=3n;
/** Replay onchain Purchased logs, including payments when the buyer closed the browser. */
export async function indexPayments(maxChunks=2){
 const s=settings();
 const from=process.env.COMMERCE_DEPLOY_BLOCK;
 if(!from || !/^\d+$/.test(from))throw Error('COMMERCE_DEPLOY_BLOCK required for safe payment recovery');
 const {rows}=await pool.query('SELECT next_block FROM commerce_chain_cursor WHERE singleton=true');
 let next=rows.length?BigInt(rows[0].next_block):BigInt(from);
 const head=await commercePublicClient.getBlockNumber();
 const safe=head>confirmations?head-confirmations:0n;
 const out:{from:string;to:string;matched:number;issues:number}[]=[];
 for(let i=0;i<maxChunks && next<=safe;i++){
  const end=next+CHUNK-1n<safe?next+CHUNK-1n:safe;
  const logs=await commercePublicClient.getLogs({address:s.vault,fromBlock:next,toBlock:end});
  const purchased=parseEventLogs({abi:ownbackAbi,logs,eventName:'Purchased',strict:true});
  let matched=0,issues=0;
  for(const log of purchased){
   if(log.args.campaignId!==BigInt(s.campaign))continue;
   const ref=log.args.orderRef.toLowerCase();
   const {rows:orders}=await pool.query('SELECT id,wallet,total_usdc,order_ref,status FROM commerce_orders WHERE order_ref=$1',[ref]);
   if(!orders.length)continue;
   if(orders[0].status!=='AWAITING_PAYMENT')continue;
   try{await confirmIndexedPayment(orders[0],log.transactionHash as Hex);matched++;}
   catch(e){issues++;console.error('Order recovery needs attention',orders[0].id,e);}
  }
  if(issues)throw Error('Onchain payment recovery incomplete; cursor not advanced');
  await pool.query(`INSERT INTO commerce_chain_cursor(singleton,next_block) VALUES(true,$1)
   ON CONFLICT(singleton) DO UPDATE SET next_block=$1,updated_at=now()`,[(end+1n).toString()]);
  out.push({from:next.toString(),to:end.toString(),matched,issues});next=end+1n;
 }
 return {head:head.toString(),safe:safe.toString(),chunks:out,more:next<=safe};
}
