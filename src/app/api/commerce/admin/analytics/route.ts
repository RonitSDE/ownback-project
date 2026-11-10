import { NextResponse } from 'next/server';
import { adminAuthorized } from '@/lib/commerce/auth';
import { pool } from '@/lib/commerce/db';
export const runtime='nodejs';
/** Observed repeat activity only. No causal retention lift is claimed. */
export async function GET(){
 if(!await adminAuthorized())return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const {rows}=await pool.query(`WITH paid AS (
   SELECT wallet,total_usdc,paid_at FROM commerce_orders
   WHERE status IN ('PAID','FULFILLED','REFUND_PENDING') AND paid_at IS NOT NULL
  ), per_customer AS (
   SELECT wallet,COUNT(*) AS purchases FROM paid GROUP BY wallet
  )
  SELECT (SELECT COUNT(*) FROM paid)::int AS verified_purchases,
   (SELECT COUNT(*) FROM per_customer)::int AS customers,
   (SELECT COUNT(*) FROM per_customer WHERE purchases>=2)::int AS returning_customers,
   (SELECT COALESCE(SUM(total_usdc),0)::numeric FROM paid)::text AS gross_paid_usdc
  `);
  const x=rows[0];return NextResponse.json({metrics:{...x,observedRepeatRate:x.customers?x.returning_customers/x.customers:0},disclaimer:'Observed customer repeat rate is not proven incremental retention; refunded orders are excluded.'},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'Metrics unavailable'},{status:503})}
}
