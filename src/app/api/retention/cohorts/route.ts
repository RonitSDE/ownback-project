/** Merchant-authenticated repeat purchase evidence. Channel-specific and non-causal. */
import { NextResponse } from 'next/server';
import { adminAuthorized } from '@/lib/commerce/auth';
import { pool } from '@/lib/commerce/db';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(){
 if(!await adminAuthorized())return NextResponse.json({error:'Merchant sign-in required.'},{status:401});
 try{
  const {rows}=await pool.query(`WITH paid AS (
    SELECT shop_domain,customer_hash,order_id,paid_at,price_usdc,
      ROW_NUMBER() OVER(PARTITION BY shop_domain,customer_hash ORDER BY paid_at,order_id) AS visit,
      MIN(paid_at) OVER(PARTITION BY shop_domain,customer_hash) AS first_paid_at
    FROM shopify_reward_orders
    WHERE status NOT IN ('REFUNDED','REFUNDED_AFTER_DELIVERY','BLOCKED','FAILED')
  ), grouped AS (
    SELECT shop_domain,COUNT(*)::int AS eligible_orders,
      COUNT(DISTINCT customer_hash)::int AS identifiable_customers,
      COUNT(*) FILTER(WHERE visit > 1)::int AS repeat_orders,
      COUNT(DISTINCT customer_hash) FILTER(WHERE visit>1)::int AS repeat_customers,
      COUNT(DISTINCT customer_hash) FILTER(WHERE visit>1 AND paid_at<=first_paid_at+INTERVAL '7 days')::int AS returned_in_7d,
      COUNT(DISTINCT customer_hash) FILTER(WHERE visit>1 AND paid_at<=first_paid_at+INTERVAL '30 days')::int AS returned_in_30d,
      COALESCE(SUM(price_usdc) FILTER(WHERE visit=1),0)::text AS first_revenue_micro_usdc,
      COALESCE(SUM(price_usdc) FILTER(WHERE visit>1),0)::text AS repeat_revenue_micro_usdc
    FROM paid GROUP BY shop_domain
  )
  SELECT * FROM grouped ORDER BY eligible_orders DESC,shop_domain ASC LIMIT 100`);
  return NextResponse.json({source:'signed_shopify_paid_orders',currencyDecimals:6,stores:rows,
    limitations:[
      'Only eligible, non-refunded Shopify reward-order records are counted; this is not all merchant sales.',
      'Customers are deduplicated within each shop only. Cross-store identities are not merged.',
      'Repeat counts are descriptive. No randomized holdout or causal uplift is demonstrated.',
      'Recent first orders have incomplete 7-day and 30-day observation windows; results are not matured cohort lift.'
    ]}, {headers:{'Cache-Control':'no-store, private'}});
 }catch(e){console.error('cohort report unavailable',e);return NextResponse.json({error:'Evidence database unavailable.'},{status:503});}
}
