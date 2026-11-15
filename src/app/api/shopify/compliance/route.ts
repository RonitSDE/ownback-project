import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { withTx } from '@/lib/commerce/db';
import { customerHash, validatedShop, verifyWebhook } from '@/lib/shopify/security';
export const runtime = 'nodejs';

// Mandatory Shopify privacy (GDPR/CCPA) compliance webhooks. Configure this URL as the
// compliance webhook endpoint in the app's Partner Dashboard / shopify.app.toml.
// OWNBACK stores no raw customer data: customers are keyed by an HMAC pseudonym and
// claim-email recipients are encrypted at rest. Redaction removes both.
type CompliancePayload = {
  shop_domain?: string;
  customer?: { id?: string | number; email?: string } | null;
  orders_to_redact?: (string | number)[];
  orders_requested?: (string | number)[];
};
const topics = new Set(['customers/data_request', 'customers/redact', 'shop/redact']);

function customerHashes(shop: string, customer: CompliancePayload['customer']): string[] {
  const keys: string[] = [];
  const email = typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : '';
  if (email) keys.push(`email:${email}`);
  if (customer?.id) keys.push(`id:${String(customer.id)}`);
  return keys.map((k) => customerHash(shop, k));
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 512000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  if (!verifyWebhook(raw, req.headers.get('x-shopify-hmac-sha256') || ''))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const topic = req.headers.get('x-shopify-topic') || '';
  if (!topics.has(topic)) return NextResponse.json({ received: true, ignored: true });
  try {
    const shop = validatedShop(req.headers.get('x-shopify-shop-domain') || '');
    const payload = JSON.parse(raw) as CompliancePayload;
    const outcome = await withTx(async (db) => {
      if (topic === 'customers/data_request') {
        // Only a pseudonymous hash, order ids and public on-chain rewards are held. The
        // merchant already has these orders; nothing extra needs to be exported.
        return 'no-additional-data';
      }
      if (topic === 'shop/redact') {
        await db.query('DELETE FROM shopify_claim_outbox WHERE shop_domain=$1', [shop]);
        await db.query('DELETE FROM shopify_reward_orders WHERE shop_domain=$1', [shop]);
        await db.query('DELETE FROM shopify_refund_markers WHERE shop_domain=$1', [shop]);
        await db.query('DELETE FROM shopify_webhook_events WHERE shop_domain=$1', [shop]);
        await db.query('DELETE FROM shopify_installations WHERE shop_domain=$1', [shop]);
        return 'shop-redacted';
      }
      const orders = (payload.orders_to_redact || []).map(String).filter((id) => /^\d+$/.test(id));
      const hashes = customerHashes(shop, payload.customer);
      const { rows } = await db.query(
        'SELECT order_id FROM shopify_reward_orders WHERE shop_domain=$1 AND (order_id=ANY($2) OR customer_hash=ANY($3))',
        [shop, orders, hashes],
      );
      const ids = [...new Set([...orders, ...rows.map((r: { order_id: string }) => r.order_id)])];
      await db.query('DELETE FROM shopify_claim_outbox WHERE shop_domain=$1 AND order_id=ANY($2)', [
        shop,
        ids,
      ]);
      for (const id of ids) {
        // Keep the order row for budget accounting, but break the link to the person.
        const anon = '0x' + createHash('sha256').update(`redacted:${shop}:${id}`).digest('hex');
        await db.query(
          `UPDATE shopify_reward_orders SET customer_hash=$3,wallet=NULL,order_label=NULL,
           claim_token_hash=NULL,claim_expires_at=NULL,updated_at=now() WHERE shop_domain=$1 AND order_id=$2`,
          [shop, id, anon],
        );
      }
      return 'customer-redacted';
    });
    return NextResponse.json({ received: true, outcome });
  } catch (e) {
    console.error('Shopify compliance webhook error', e);
    return NextResponse.json({ error: 'Compliance processing failed' }, { status: 503 });
  }
}
