/**
 * Run as a single dedicated worker (not a Next.js request/cron handler).
 * One merchant / one Shopify store / one testnet vault pilot.
 * It never considers a Bankr job or an HTTP success proof of stock delivery.
 */
import 'dotenv/config';
import {parseAbi,parseEventLogs,type Hex,type Address} from 'viem';
import {pool} from '../src/lib/commerce/db';
import {getLiveOrder,isLiveOrderPaid} from '../src/lib/shopify/admin';
import {classify,qualifiesForShopifyPayout,rewardAmount} from '../src/lib/shopify/rules';
import {orderHash,usdToBaseUnits} from '../src/lib/shopify/security';
import {shopifyClient,shopifyVaultAddress,shopifyVaultAbi,executorWallet} from '../src/lib/shopify/chain';

const mainnet=process.env.SHOPIFY_REWARD_CHAIN_ID==='8453';
if(!['31337','84532','8453'].includes(process.env.SHOPIFY_REWARD_CHAIN_ID||'84532'))throw Error('Unsupported network');
if(mainnet&&(process.env.SHOPIFY_LIVE_STOCK_ENABLED!=='true'||process.env.MAINNET_OPERATIONS_APPROVED!=='true'))throw Error('Real B20 delivery requires explicit operational authorization');
if(!mainnet&&process.env.SHOPIFY_LIVE_STOCK_ENABLED==='true')throw Error('Cannot label mock testnet stock as live B20');
const mainnetStock = process.env.BASE_STOCK_ADDRESS as Address | undefined;
const mainnetAdapter = process.env.SHOPIFY_REWARD_ADAPTER_ADDRESS as Address | undefined;
if(mainnet&&(!/^0x[a-fA-F0-9]{40}$/.test(mainnetStock||'')||!/^0x[a-fA-F0-9]{40}$/.test(mainnetAdapter||'')))throw Error('Mainnet stock and inventory adapter not configured');
const priceAbi=parseAbi(['function quote(address stock,uint256 usdcIn) view returns(uint256)']);
const vault=shopifyVaultAddress();
const wallet=executorWallet();
const deployedBlock=BigInt(process.env.SHOPIFY_REWARD_DEPLOY_BLOCK||'0');
const mockPrice=BigInt(process.env.SHOPIFY_MOCK_PRICE_USDC||'100000000');
if(!mainnet&&mockPrice<=0n)throw Error('Invalid mock price');

type Order={shop_domain:string;order_id:string;customer_hash:string;paid_at:string|Date;reward_eligible_at:string|Date;
 status:string;price_usdc:string;wallet:string;tx_hash:string|null;processing_started_at:string|Date|null;};
async function eventReceipt(order:Order){
 const hash=orderHash(order.shop_domain,order.order_id);
 const logs=await shopifyClient.getLogs({address:vault,event:{type:'event',name:'RewardDelivered',inputs:[
  {name:'orderHash',type:'bytes32',indexed:true},{name:'customerHash',type:'bytes32',indexed:true},{name:'wallet',type:'address',indexed:true},
  {name:'usdcReward',type:'uint256'},{name:'tokenOut',type:'uint256'},{name:'comeback',type:'bool'}]},args:{orderHash:hash},fromBlock:deployedBlock,toBlock:'latest'});
 return logs.at(-1)||null;
}
async function confirm(order:Order):Promise<boolean>{
 const used=await shopifyClient.readContract({address:vault,abi:shopifyVaultAbi,functionName:'paidOrder',args:[orderHash(order.shop_domain,order.order_id)]});
 if(!used){
  if(order.status==='SETTLING'||order.tx_hash){
   if(order.tx_hash){
    try{
     const receipt=await shopifyClient.getTransactionReceipt({hash:order.tx_hash as Hex});
     if(receipt.status==='reverted'){
      // Never automatically retry an ambiguous chain write. A human must
      // review nonce, receipt, refund state and last known attempt first.
      await pool.query(`UPDATE shopify_reward_orders SET status='FAILED',processing_started_at=NULL,
       failure_reason='Transaction reverted; explicit operator review required'
       WHERE shop_domain=$1 AND order_id=$2 AND status='SETTLING'`,[order.shop_domain,order.order_id]);
     }
    }catch{/* Hash may still be pending or RPC unavailable. Keep SETTLING. */}
   }
   // Missing hash is equally ambiguous: a successful broadcast may have
   // preceded a DB outage. NEVER reset to CLAIMED based on elapsed time.
   return true;
  }
  return false;
 }

 const log=await eventReceipt(order);
 if(!log)return true; // Keep the order pending until receipt and event are both visible.
 const blockReceipt=await shopifyClient.getTransactionReceipt({hash:log.transactionHash});
 if(blockReceipt.status!=='success')return true;
 const parsed=parseEventLogs({abi:shopifyVaultAbi,logs:blockReceipt.logs,eventName:'RewardDelivered',strict:true})
  .find(e=>e.address.toLowerCase()===vault.toLowerCase()&&e.args.orderHash===orderHash(order.shop_domain,order.order_id));
 if(!parsed)return true;
 // Event must match the originally authorized recipient and customer identity.
 if(parsed.args.customerHash?.toLowerCase()!==order.customer_hash.toLowerCase() ||
    parsed.args.wallet?.toLowerCase()!==order.wallet.toLowerCase() ||
    parsed.args.usdcReward<=0n || parsed.args.tokenOut<=0n)return true;
 // The refund marker and final state must be evaluated atomically, otherwise
 // a refund between SELECT and UPDATE could be overwritten as DELIVERED.
 await pool.query(`UPDATE shopify_reward_orders AS o
   SET status=CASE WHEN EXISTS(SELECT 1 FROM shopify_refund_markers m
       WHERE m.shop_domain=o.shop_domain AND m.order_id=o.order_id)
     THEN 'REFUNDED_AFTER_DELIVERY' ELSE 'DELIVERED' END,
   tx_hash=$3,reward_kind=$4,reward_usdc=$5,stock_amount=$6,
   processing_started_at=NULL,updated_at=now()
   WHERE o.shop_domain=$1 AND o.order_id=$2 AND o.status IN ('SETTLING','CLAIMED','REFUNDED')`,
  [order.shop_domain,order.order_id,log.transactionHash.toLowerCase(),
   parsed.args.comeback?'COMEBACK':'FIRST',parsed.args.usdcReward.toString(),parsed.args.tokenOut.toString()]);
 return true;
}
async function settle(order:Order){
 // A failed DB commit after writeContract must never trigger a second send.
 // Reconcile even CLAIMED rows before rechecking funds and eligibility.
 if(await confirm(order))return;
 const refund=await pool.query('SELECT 1 FROM shopify_refund_markers WHERE shop_domain=$1 AND order_id=$2',[order.shop_domain,order.order_id]);
 const live=await getLiveOrder(order.shop_domain,order.order_id);
 if(!qualifiesForShopifyPayout({status:order.status,holdAt:new Date(order.reward_eligible_at).getTime(),now:Date.now(),isPaid:isLiveOrderPaid(live),refunded:Boolean(refund.rowCount),claimed:Boolean(order.wallet)})){
  if(!isLiveOrderPaid(live)||refund.rowCount)await pool.query("UPDATE shopify_reward_orders SET status='REFUNDED',updated_at=now() WHERE shop_domain=$1 AND order_id=$2 AND status='CLAIMED'",[order.shop_domain,order.order_id]);
  return;
 }
 if(live.totalPriceSet.shopMoney.currencyCode!=='USD'||usdToBaseUnits(live.totalPriceSet.shopMoney.amount)!==BigInt(order.price_usdc)){
  await pool.query("UPDATE shopify_reward_orders SET status='BLOCKED',failure_reason='Original amount changed' WHERE shop_domain=$1 AND order_id=$2",[order.shop_domain,order.order_id]);return;
 }
 const {rows}=await pool.query(`SELECT order_id AS id,extract(epoch FROM paid_at)*1000 AS paid_at,
    status, tx_hash FROM shopify_reward_orders WHERE shop_domain=$1 AND customer_hash=$2 ORDER BY paid_at,order_id`,[order.shop_domain,order.customer_hash]);
 const kind=classify(rows.map(r=>({id:r.id,paidAt:Number(r.paid_at),refunded:r.status==='REFUNDED',delivered:['DELIVERED','REFUNDED_AFTER_DELIVERY'].includes(r.status)})),order.order_id);
 if(kind==='NONE'){
  await pool.query("UPDATE shopify_reward_orders SET status='BLOCKED',failure_reason='Only first and one seven-day comeback reward are eligible' WHERE shop_domain=$1 AND order_id=$2",[order.shop_domain,order.order_id]);return;
 }
 // Comeback is delivered only after the first customer's reward has settled.
 if(kind==='COMEBACK'&&!rows.some(r=>r.id!==order.order_id&&['DELIVERED','REFUNDED_AFTER_DELIVERY'].includes(r.status)))return;
 const amount=rewardAmount(BigInt(order.price_usdc),kind);
 const onchainAvailable=await shopifyClient.readContract({address:vault,abi:shopifyVaultAbi,functionName:'available'});
 if(amount<=0n||onchainAvailable<amount)return;
 // Mainnet quotes are read from the fresh Chainlink total-return feed through the
 // real-stock inventory adapter. A stale/paused feed or insufficient quote halts delivery.
 // Testnet retains the original fixed-price synthetic adapter.
 const quoted = mainnet
   ? await shopifyClient.readContract({address:mainnetAdapter!,abi:priceAbi,functionName:'quote',args:[mainnetStock!,amount]})
   : amount*100_000_000n/mockPrice;
 const minOut=mainnet ? quoted*995n/1000n : quoted;
 if(minOut===0n)return;
 const lock=await pool.query(`UPDATE shopify_reward_orders SET status='SETTLING',reward_kind=$3,processing_started_at=now(),processing_attempts=processing_attempts+1,updated_at=now()
 WHERE shop_domain=$1 AND order_id=$2 AND status='CLAIMED' RETURNING order_id`,[order.shop_domain,order.order_id,kind]);
 if(!lock.rowCount)return;
 try{
  const tx=await wallet.writeContract({address:vault,abi:shopifyVaultAbi,functionName:'deliver',args:[orderHash(order.shop_domain,order.order_id),order.customer_hash as Hex,order.wallet as `0x${string}`,BigInt(order.price_usdc),BigInt(Math.floor(new Date(order.paid_at).getTime()/1000)),kind==='COMEBACK',minOut]});
  await pool.query('UPDATE shopify_reward_orders SET tx_hash=$3 WHERE shop_domain=$1 AND order_id=$2 AND status=$4',[order.shop_domain,order.order_id,tx.toLowerCase(),'SETTLING']);
  await shopifyClient.waitForTransactionReceipt({hash:tx,confirmations:2});
  await confirm({...order,status:'SETTLING',tx_hash:tx});
 }catch(e){
  console.error('Settlement pending or failed',order.order_id,e);
  // A broadcast may have succeeded before the DB could store the hash.
  // Preserve SETTLING even when the transaction hash is absent; the next
  // worker pass searches paidOrder and RewardDelivered for recovery.
  await pool.query(`UPDATE shopify_reward_orders
   SET failure_reason='Submission ambiguous; reconcile onchain before retry',updated_at=now()
   WHERE shop_domain=$1 AND order_id=$2 AND status='SETTLING'`,
   [order.shop_domain,order.order_id]).catch(()=>{});
 }
}
async function main(){
 const states=await pool.query("SELECT * FROM shopify_reward_orders WHERE status='SETTLING' OR (status='REFUNDED' AND processing_started_at IS NOT NULL) ORDER BY paid_at LIMIT 100");
 for(const row of states.rows as Order[])try{await confirm(row)}catch(e){console.error('Reconcile',row.order_id,e)}
 const active=await pool.query("SELECT * FROM shopify_reward_orders WHERE status='CLAIMED' AND reward_eligible_at<=now() ORDER BY paid_at LIMIT 25");
 for(const row of active.rows as Order[])try{await settle(row)}catch(e){console.error('Settle',row.order_id,e)}
}
main().then(()=>pool.end()).catch(async e=>{console.error(e);await pool.end();process.exitCode=1});
