import {NextResponse} from 'next/server';
import {adminAuthorized} from '@/lib/commerce/auth';
import {pool} from '@/lib/commerce/db';
export const runtime='nodejs';
export async function GET(){if(!await adminAuthorized())return NextResponse.json({error:'Unauthorized'},{status:401});
 const {rows}=await pool.query(`SELECT o.id,o.order_number,o.wallet,o.status,o.total_usdc,o.fulfillment,o.customer_email,o.payment_tx,o.purchase_id,o.paid_at,o.fulfilled_at,o.created_at,
 COALESCE(json_agg(json_build_object('name',i.name,'quantity',i.quantity,'unit_usdc',i.unit_usdc)) FILTER (WHERE i.product_id IS NOT NULL),'[]'::json) AS items
 FROM commerce_orders o LEFT JOIN commerce_order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`);
 return NextResponse.json({orders:rows});}
