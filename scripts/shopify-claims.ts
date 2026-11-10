/**
 * Durable Shopify claim email dispatcher. Operates only on a testnet pilot.
 * Run on a private scheduled worker, not in a webhook or customer request.
 * Each email is queued with a redeemable token BEFORE talking to Resend.
 * Resend idempotency keys reduce duplicate deliveries after a worker crash,
 * but provider idempotency has a finite window: exactly-once email is not
 * guaranteed across unbounded outages.
 */
import 'dotenv/config';
import {withTx,pool} from '../src/lib/commerce/db';
import {getLiveOrder,isLiveOrderPaid} from '../src/lib/shopify/admin';
import {classify} from '../src/lib/shopify/rules';
import {decryptToken,usdToBaseUnits} from '../src/lib/shopify/security';
import {queueShopifyClaim} from '../src/lib/shopify/claim-outbox';

if(process.env.SHOPIFY_AUTO_EMAIL_CLAIMS!=='true')throw Error('Set SHOPIFY_AUTO_EMAIL_CLAIMS=true');
if(!process.env.RESEND_API_KEY||!process.env.SHOPIFY_CLAIM_FROM_EMAIL||!process.env.APP_ORIGIN)throw Error('Missing email or origin configuration');
if(process.env.SHOPIFY_LIVE_STOCK_ENABLED==='true')throw Error('Live equities disabled');
if(!['31337','84532'].includes(process.env.SHOPIFY_REWARD_CHAIN_ID||'84532'))throw Error('Testnet only');
const origin=new URL(process.env.APP_ORIGIN);
if(!['https:','http:'].includes(origin.protocol)||
 (origin.protocol==='http:'&&!['localhost','127.0.0.1'].includes(origin.hostname)))throw Error('Secure APP_ORIGIN required');
const limit=Number(process.env.SHOPIFY_CLAIM_BATCH_SIZE||10);
if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid claim batch size');

type Row={shop_domain:string;order_id:string;price_usdc:string;customer_hash:string;status:string;};
type Outbox={shop_domain:string;order_id:string;recipient_ciphertext:string;token_ciphertext:string;
 order_label:string;reward_kind:string;idempotency_key:string;attempts:number;created_at:Date|string;};

async function stage(shop:string,orderId:string){
 // Live Shopify check before taking the short database row lock.
 const live=await getLiveOrder(shop,orderId);
 if(!isLiveOrderPaid(live)||!live.email||live.totalPriceSet.shopMoney.currencyCode!=='USD')return;
 await withTx(async c=>{
  const {rows}=await c.query(`SELECT * FROM shopify_reward_orders
    WHERE shop_domain=$1 AND order_id=$2 AND status IN ('HOLD','READY')
    AND reward_eligible_at<=now() FOR UPDATE SKIP LOCKED`,[shop,orderId]);
  const order=rows[0] as Row|undefined;if(!order)return;
  if(usdToBaseUnits(live.totalPriceSet.shopMoney.amount)!==BigInt(order.price_usdc))return;
  const refunded=await c.query('SELECT 1 FROM shopify_refund_markers WHERE shop_domain=$1 AND order_id=$2',[shop,orderId]);
  if(refunded.rowCount){await c.query("UPDATE shopify_reward_orders SET status='REFUNDED' WHERE shop_domain=$1 AND order_id=$2",[shop,orderId]);return;}
  const history=await c.query(`SELECT order_id AS id,extract(epoch FROM paid_at)*1000 AS paid_at,status
   FROM shopify_reward_orders WHERE shop_domain=$1 AND customer_hash=$2 ORDER BY paid_at,order_id`,[shop,order.customer_hash]);
  const kind=classify(history.rows.map((r:{id:string;paid_at:number;status:string})=>({id:r.id,paidAt:Number(r.paid_at),refunded:r.status==='REFUNDED',delivered:['DELIVERED','REFUNDED_AFTER_DELIVERY'].includes(r.status)})),orderId);
  if(kind==='NONE'){
   await c.query("UPDATE shopify_reward_orders SET status='BLOCKED',failure_reason='Not first or first comeback purchase' WHERE shop_domain=$1 AND order_id=$2",[shop,orderId]);return;
  }
  await queueShopifyClaim(c,{shop,orderId,email:live.email??"",orderLabel:live.name,kind});
 });
}

async function postpone(row:Outbox,message:string,permanent=false){
 await pool.query(`UPDATE shopify_claim_outbox SET status=$3,lease_expires_at=NULL,
   next_attempt_at=now()+interval '5 minutes',last_error=$4,updated_at=now()
   WHERE shop_domain=$1 AND order_id=$2 AND status='SENDING'`,
   [row.shop_domain,row.order_id,permanent?'REVIEW':'RETRY',message.slice(0,200)]);
}

async function dispatch(shop:string,orderId:string){
 // The lease is claimed atomically; no DB transaction is open during fetch().
 const claimed=await pool.query(`UPDATE shopify_claim_outbox
   SET status='SENDING',attempts=attempts+1,lease_expires_at=now()+interval '2 minutes',updated_at=now()
   WHERE shop_domain=$1 AND order_id=$2
   AND ((status IN ('PENDING','RETRY') AND next_attempt_at<=now())
     OR (status='SENDING' AND lease_expires_at<now()))
   RETURNING *`,[shop,orderId]);
 const row=claimed.rows[0] as Outbox|undefined;if(!row)return;
 // Resend keeps idempotency keys for 24 hours. Never auto-retry an
 // uncertain old send beyond a conservative 20-hour window.
 if(row.attempts>1 && Date.now()-new Date(row.created_at).getTime()>20*3600_000){
  await postpone(row,'Idempotency window nearing expiry; operator review required',true);
  return;
 }
 try{
  const order=await pool.query(`SELECT status,price_usdc,claim_token_hash,claim_expires_at
    FROM shopify_reward_orders WHERE shop_domain=$1 AND order_id=$2`,[shop,orderId]);
  const refund=await pool.query('SELECT 1 FROM shopify_refund_markers WHERE shop_domain=$1 AND order_id=$2',[shop,orderId]);
  if(!order.rows[0]||order.rows[0].status!=='CLAIM_SENT'||!order.rows[0].claim_token_hash||
    new Date(order.rows[0].claim_expires_at).getTime()<=Date.now()||refund.rowCount){
   await postpone(row,'Order or claim is no longer eligible',true);return;
  }
  const live=await getLiveOrder(shop,orderId);
  const recipient=decryptToken(row.recipient_ciphertext);
  if(!isLiveOrderPaid(live)||!live.email||live.email.toLowerCase()!==recipient.toLowerCase()||
    live.totalPriceSet.shopMoney.currencyCode!=='USD'||
    usdToBaseUnits(live.totalPriceSet.shopMoney.amount)!==BigInt(order.rows[0].price_usdc)){
   await postpone(row,'Live order verification changed; manual review required',true);return;
  }
  const token=decryptToken(row.token_ciphertext);
  const url=new URL('/claim',origin);url.searchParams.set('token',token);
  // Never put URLs or tokens into logs or a database error field.
  const resp=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json',
    'Idempotency-Key':row.idempotency_key},
   body:JSON.stringify({from:process.env.SHOPIFY_CLAIM_FROM_EMAIL,to:[recipient],
    subject:'Your OWNBACK purchase reward is ready',
    text:`Your paid order ${row.order_label} qualifies for a ${row.reward_kind==='FIRST'?'first-purchase':'comeback'} stock-linked testnet reward claim.\nConnect your wallet: ${url.toString()}\n\nNo additional payment is required. Delivery is subject to eligibility and funded campaign availability. This testnet asset has no equity value.`}),
   signal:AbortSignal.timeout(12000)
  });
  if(!resp.ok)throw Error(`Email provider returned HTTP ${resp.status}`);
  const provider=await resp.json().catch(()=>({}));
  // If this DB update fails, the existing token remains valid. Retrying with
  // the same provider idempotency key will not generate a broken link.
  await pool.query(`UPDATE shopify_claim_outbox SET status='SENT',sent_at=now(),
    provider_message_id=$3,lease_expires_at=NULL,last_error=NULL,updated_at=now()
    WHERE shop_domain=$1 AND order_id=$2 AND status='SENDING'`,
    [shop,orderId,typeof provider?.id==='string'?provider.id.slice(0,200):null]);
 }catch(e){
  await postpone(row,e instanceof Error?e.message:'Email dispatch failure');
  throw e;
 }
}

async function main(){
 const eligible=await pool.query(`SELECT shop_domain,order_id FROM shopify_reward_orders
  WHERE status IN ('HOLD','READY') AND reward_eligible_at<=now() ORDER BY paid_at LIMIT $1`,[limit]);
 for(const item of eligible.rows){try{await stage(item.shop_domain,item.order_id)}catch(e){console.error('Claim staging failed for order',item.order_id,e)}}
 const pending=await pool.query(`SELECT shop_domain,order_id FROM shopify_claim_outbox
  WHERE (status IN ('PENDING','RETRY') AND next_attempt_at<=now())
  OR (status='SENDING' AND lease_expires_at<now()) ORDER BY created_at LIMIT $1`,[limit]);
 for(const item of pending.rows){try{await dispatch(item.shop_domain,item.order_id)}catch(e){console.error('Claim email needs retry for order',item.order_id,e)}}
}
main().then(()=>pool.end()).catch(async e=>{console.error(e);await pool.end();process.exitCode=1});
