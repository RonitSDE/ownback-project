import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {withTx} from '@/lib/commerce/db';
import {customerHash,usdToBaseUnits,validatedShop,verifyWebhook} from '@/lib/shopify/security';
export const runtime='nodejs';
type ShopifyWebhookPayload={
 id?:string|number;order_id?:string|number;name?:string;email?:string;
 customer?:{id?:string|number}|null;financial_status?:string;cancelled_at?:string|null;
 currency?:string;total_price?:string|number;processed_at?:string;created_at?:string;
};
const validTopics=new Set(['orders/paid','orders/cancelled','refunds/create','app/uninstalled']);
export async function POST(req:NextRequest){
 const raw=await req.text();if(raw.length>512000)return NextResponse.json({error:'Payload too large'},{status:413});
 try{
  if(!verifyWebhook(raw,req.headers.get('x-shopify-hmac-sha256')||''))return NextResponse.json({error:'Unauthorized'},{status:401});
  const topic=req.headers.get('x-shopify-topic')||'', shop=validatedShop(req.headers.get('x-shopify-shop-domain')||''),eventId=req.headers.get('x-shopify-webhook-id')||'';
  if(!validTopics.has(topic)||!eventId||eventId.length>200)return NextResponse.json({received:true,ignored:true});
  const payload=JSON.parse(raw) as ShopifyWebhookPayload;
  const result=await withTx(async db=>{
   const {rowCount}=await db.query('INSERT INTO shopify_webhook_events(shop_domain,webhook_id,topic,digest) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[shop,eventId,topic,createHash('sha256').update(raw).digest('hex')]);
   if(!rowCount)return 'duplicate';
   const installation=await db.query('SELECT shop_domain FROM shopify_installations WHERE shop_domain=$1 AND active=true',[shop]);
   if(!installation.rowCount)return 'unknown-shop';
   if(topic==='app/uninstalled'){
    await db.query('UPDATE shopify_installations SET active=false,token_ciphertext=$2,updated_at=now() WHERE shop_domain=$1',[shop,'revoked']);
    return 'uninstalled';
   }
   if(topic==='orders/paid'){
    const id=String(payload.id||'');
    // Shopify guest checkout may not have a customer object. Use a normalized email
    // as a pseudonymous fallback, never store raw email in the reward ledger.
    // Preserve v3.6 customer-hash semantics for existing claim histories.
    // A customer-ID-first migration requires linking prior email-derived hashes.
    const email=typeof payload.email==='string'?payload.email.trim().toLowerCase():'';
    const customer=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `email:${email}` : payload.customer?.id ? `id:${String(payload.customer.id)}` : null;
    if(!/^\d+$/.test(id)||!customer)return 'missing-order-or-customer';
    if(payload.financial_status!=='paid'||payload.cancelled_at)return 'not-paid';
    // Pilot accepts USD orders only, avoiding silent FX or securities price assumptions.
    if(payload.currency!=='USD')return 'unsupported-currency';
    const amount=usdToBaseUnits(String(payload.total_price));
    const paid=new Date(payload.processed_at||payload.created_at||NaN);
    if(!Number.isFinite(paid.getTime()))return 'invalid-date';
    const activeFrom=process.env.SHOPIFY_REWARD_ACTIVE_FROM;
    if(activeFrom&&paid.getTime()<new Date(activeFrom).getTime())return 'outside-campaign-period';
    const holdHours=Number(process.env.SHOPIFY_REFUND_HOLD_HOURS||'24');
    if(!Number.isFinite(holdHours)||holdHours<0||holdHours>720)throw Error('Invalid hold configuration');
    const marker=await db.query('SELECT 1 FROM shopify_refund_markers WHERE shop_domain=$1 AND order_id=$2',[shop,id]);
    const status=marker.rowCount?'REFUNDED':'HOLD';
    await db.query(`INSERT INTO shopify_reward_orders(shop_domain,order_id,order_label,customer_hash,paid_at,reward_eligible_at,price_usdc,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(shop_domain,order_id) DO NOTHING`,
    [shop,id,String(payload.name||id).slice(0,100),customerHash(shop,String(customer)),paid,new Date(paid.getTime()+holdHours*3600_000),amount.toString(),status]);
    return 'recorded';
   }
   const id=String(topic==='refunds/create'?payload.order_id:payload.id);
   if(!/^\d+$/.test(id))return 'invalid-order';
   await db.query('INSERT INTO shopify_refund_markers(shop_domain,order_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[shop,id]);
   await db.query(`UPDATE shopify_reward_orders SET status=CASE WHEN status='DELIVERED' THEN 'REFUNDED_AFTER_DELIVERY' ELSE 'REFUNDED' END,
    claim_token_hash=NULL,claim_expires_at=NULL,updated_at=now() WHERE shop_domain=$1 AND order_id=$2 AND status!='REFUNDED_AFTER_DELIVERY'`,[shop,id]);
   await db.query("UPDATE shopify_claim_outbox SET status='CANCELLED',updated_at=now() WHERE shop_domain=$1 AND order_id=$2 AND status!='SENT'",[shop,id]);
   return 'refund-marked';
  });
  return NextResponse.json({received:true,outcome:result});
 }catch(e){console.error('Shopify webhook error',e);return NextResponse.json({error:'Webhook processing failed'},{status:503});}
}
