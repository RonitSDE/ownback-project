import { NextResponse } from 'next/server';
import { adminAuthorized } from '@/lib/commerce/auth';
import { pool } from '@/lib/commerce/db';
export const runtime = 'nodejs';
export async function GET() {
  if (!(await adminAuthorized()))
    return NextResponse.json({ error: 'Merchant login required' }, { status: 401 });
  try {
    const shops = await pool.query(
      'SELECT shop_domain,active,webhook_ready,installed_at FROM shopify_installations ORDER BY installed_at DESC',
    );
    const orders =
      await pool.query(`SELECT o.shop_domain,o.order_id,o.order_label,o.paid_at,o.price_usdc,o.status,
    o.wallet,o.reward_kind,o.reward_usdc,o.tx_hash,ob.status AS email_status
    FROM shopify_reward_orders o
    LEFT JOIN shopify_claim_outbox ob ON ob.shop_domain=o.shop_domain AND ob.order_id=o.order_id
    ORDER BY o.paid_at DESC LIMIT 100`);
    const stats =
      await pool.query(`WITH paid AS (SELECT shop_domain,customer_hash,status,price_usdc FROM shopify_reward_orders
   WHERE status NOT IN ('REFUNDED','BLOCKED','FAILED')), per_customer AS (
   SELECT shop_domain,customer_hash,count(*) AS purchases FROM paid GROUP BY shop_domain,customer_hash)
   SELECT (SELECT count(*) FROM paid)::int AS purchases,
    (SELECT count(*) FROM per_customer)::int AS customers,
    (SELECT count(*) FROM per_customer WHERE purchases>1)::int AS returning,
    (SELECT coalesce(sum(price_usdc),0)::numeric FROM paid)::text AS sales,
    (SELECT count(*) FROM shopify_reward_orders WHERE status='DELIVERED')::int AS delivered`);
    return NextResponse.json(
      { shops: shops.rows, orders: orders.rows, metrics: stats.rows[0] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Shopify integration database unavailable' }, { status: 503 });
  }
}
