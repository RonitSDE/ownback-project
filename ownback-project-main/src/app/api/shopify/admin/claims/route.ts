import {NextRequest,NextResponse} from 'next/server';
import {adminAuthorized,sameOrigin} from '@/lib/commerce/auth';
import {withTx} from '@/lib/commerce/db';
import {getLiveOrder,isLiveOrderPaid} from '@/lib/shopify/admin';
import {usdToBaseUnits,validatedShop} from '@/lib/shopify/security';
import {classify} from '@/lib/shopify/rules';
import {queueShopifyClaim} from '@/lib/shopify/claim-outbox';
export const runtime='nodejs';

export async function POST(req:NextRequest){
 if(!sameOrigin(req)||!await adminAuthorized())return NextResponse.json({error:'Merchant login required'},{status:401});
 try{
  const {shop:rawShop,orderId}=await req.json();
  const shop=validatedShop(rawShop),id=String(orderId);
  if(!/^\d+$/.test(id))throw Error('Invalid order ID');
  if(!process.env.APP_ORIGIN)throw Error('APP_ORIGIN missing');
  const live=await getLiveOrder(shop,id);
  if(!isLiveOrderPaid(live)||!live.email||live.totalPriceSet.shopMoney.currencyCode!=='USD')
   throw Error('Verified paid USD order and customer email required');
  const queued=await withTx(async db=>{
   const {rows}=await db.query(`SELECT * FROM shopify_reward_orders WHERE shop_domain=$1 AND order_id=$2
     AND status IN ('HOLD','READY') AND reward_eligible_at<=now() FOR UPDATE`,[shop,id]);
   const order=rows[0];if(!order)throw Error('Order is not eligible or its claim is already queued');
   const refund=await db.query('SELECT 1 FROM shopify_refund_markers WHERE shop_domain=$1 AND order_id=$2',[shop,id]);
   if(refund.rowCount)throw Error('Refunded orders cannot receive claim emails');
   if(usdToBaseUnits(live.totalPriceSet.shopMoney.amount)!==BigInt(order.price_usdc))throw Error('Order total changed');
   const history=await db.query(`SELECT order_id AS id,paid_at,status FROM shopify_reward_orders
    WHERE shop_domain=$1 AND customer_hash=$2 ORDER BY paid_at,order_id`,[shop,order.customer_hash]);
   const kind=classify(history.rows.map((r:{id:string;paid_at:Date|string;status:string})=>({
    id:r.id,paidAt:new Date(r.paid_at).getTime(),refunded:r.status==='REFUNDED',
    delivered:['DELIVERED','REFUNDED_AFTER_DELIVERY'].includes(r.status)})),id);
   if(kind==='NONE')throw Error('Only first and one qualifying seven-day comeback purchase earn rewards');
   return queueShopifyClaim(db,{shop,orderId:id,email:live.email!,orderLabel:live.name,kind});
  });
  if(!queued.queued)throw Error('Claim was already issued');
  const demo=process.env.SHOPIFY_PILOT_DEMO==='true' &&
   /^http:\/\/localhost(?::\d+)?$/.test(process.env.APP_ORIGIN) &&
   Number(process.env.SHOPIFY_REWARD_CHAIN_ID||'84532')!==8453;
  if(demo){
   const link=new URL('/claim',process.env.APP_ORIGIN);
   link.searchParams.set('token',queued.demoToken!);
   return NextResponse.json({queued:true,demoClaimUrl:link.toString(),mode:'local-testnet'});
  }
  // The private shopify:claims worker dispatches queued emails after commit.
  return NextResponse.json({queued:true,mode:'email-outbox'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Claim failed'},{status:409});}
}
