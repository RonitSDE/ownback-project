/** Admin-only observed retention. Never reports causal lift without pre-exposure assignment. */
import {NextResponse} from 'next/server';
import {adminAuthorized} from '@/lib/commerce/auth';
import {pool} from '@/lib/commerce/db';
export const runtime='nodejs';
export async function GET(){
 if(!await adminAuthorized())return NextResponse.json({error:'Merchant authentication required'},{status:401});
 try {
  const [shopify,native]=await Promise.all([
   pool.query(`WITH eligible AS (
     SELECT shop_domain,customer_hash,price_usdc,status,reward_usdc,paid_at
     FROM shopify_reward_orders WHERE status NOT IN ('REFUNDED','REFUNDED_AFTER_DELIVERY','BLOCKED','FAILED')
   ), customers AS (
     SELECT shop_domain,customer_hash,COUNT(*) AS n FROM eligible GROUP BY shop_domain,customer_hash
   )
   SELECT (SELECT COUNT(*) FROM eligible)::int AS purchases,
    (SELECT COUNT(*) FROM customers)::int AS buyers,
    (SELECT COUNT(*) FROM customers WHERE n>=2)::int AS returning,
    (SELECT COALESCE(SUM(price_usdc),0) FROM eligible)::text AS paid_usdc,
    (SELECT COUNT(*) FROM shopify_reward_orders WHERE status='HOLD')::int AS reserved,
    (SELECT COUNT(*) FROM shopify_reward_orders WHERE status IN ('READY','CLAIM_SENT','CLAIMED'))::int AS eligible,
    (SELECT COUNT(*) FROM shopify_reward_orders WHERE status='SETTLING')::int AS settling,
    (SELECT COUNT(*) FROM shopify_reward_orders WHERE status='DELIVERED')::int AS delivered,
    (SELECT COUNT(*) FROM shopify_reward_orders WHERE status IN ('REFUNDED','REFUNDED_AFTER_DELIVERY'))::int AS refunded,
    (SELECT COUNT(*) FROM shopify_reward_orders WHERE status='REFUNDED_AFTER_DELIVERY')::int AS post_settlement_refunds,
    (SELECT COALESCE(SUM(reward_usdc),0) FROM shopify_reward_orders WHERE status IN ('DELIVERED','REFUNDED_AFTER_DELIVERY'))::text AS rewards_disbursed_usdc`),
   pool.query(`WITH paid AS (
      SELECT wallet,total_usdc FROM commerce_orders WHERE status IN ('PAID','FULFILLED','REFUND_PENDING') AND paid_at IS NOT NULL
     ), customers AS (SELECT wallet,COUNT(*) AS n FROM paid GROUP BY wallet)
     SELECT (SELECT COUNT(*) FROM paid)::int AS purchases,
       (SELECT COUNT(*) FROM customers)::int AS buyers,
       (SELECT COUNT(*) FROM customers WHERE n>=2)::int AS returning,
       (SELECT COALESCE(SUM(total_usdc),0) FROM paid)::text AS paid_usdc`)
  ]);
  return NextResponse.json({mode:'observed_live',shopify:shopify.rows[0],native:native.rows[0],
   experimentalLift:null,
   experimentalLiftReason:'No pre-exposure assigned holdout pilot is configured. These are observed return rates, not causal lift.',
   crossChannelDeduplication:false,asset:process.env.SHOPIFY_REWARD_CHAIN_ID==='8453'?'Verified-recipient B20 on Base mainnet':'Mock stock, Base Sepolia',
   note:'Refunded orders excluded from observed purchases. Shopify and native customer populations are not deduplicated.'},
   {headers:{'Cache-Control':'no-store, private'}});
 }catch(e){console.error('Retention overview unavailable',e);return NextResponse.json({error:'Live analytics unavailable. No synthetic metrics substituted.'},{status:503});}
}
