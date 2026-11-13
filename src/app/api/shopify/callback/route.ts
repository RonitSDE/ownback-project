import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/commerce/db';
import { encryptToken, timingEqual, validatedShop, verifyOAuth } from '@/lib/shopify/security';
export const runtime = 'nodejs';
const topics = ['ORDERS_PAID', 'REFUNDS_CREATE', 'ORDERS_CANCELLED', 'APP_UNINSTALLED'];
export async function GET(req: NextRequest) {
  const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
  function failure(msg: string) {
    return NextResponse.redirect(
      new URL(`/experience?connection=error&detail=${encodeURIComponent(msg)}`, origin),
    );
  }
  try {
    const p = req.nextUrl.searchParams;
    if (!verifyOAuth(p)) throw Error('Invalid Shopify HMAC');
    const shop = validatedShop(p.get('shop') || '');
    const state = p.get('state') || '',
      expected = req.cookies.get('ob_shopify_state')?.value || '';
    const expectedShop = req.cookies.get('ob_shopify_shop')?.value || '';
    if (!state || !expected || !timingEqual(state, expected) || shop !== expectedShop)
      throw Error('Invalid OAuth state');
    const timestamp = Number(p.get('timestamp'));
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 600)
      throw Error('Expired Shopify authorization');
    const code = p.get('code');
    if (!code || !process.env.SHOPIFY_CLIENT_ID) throw Error('Missing installation code');
    const exchange = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!exchange.ok) throw Error('Shopify authorization exchange failed');
    const data = await exchange.json();
    if (typeof data.access_token !== 'string' || !String(data.scope).split(',').includes('read_orders'))
      throw Error('Missing Shopify order scope');
    const encrypted = encryptToken(data.access_token);
    await pool.query(
      `INSERT INTO shopify_installations(shop_domain,token_ciphertext,scopes,active,webhook_ready)
    VALUES($1,$2,$3,true,false) ON CONFLICT(shop_domain) DO UPDATE SET
    token_ciphertext=EXCLUDED.token_ciphertext,scopes=EXCLUDED.scopes,active=true,webhook_ready=false,updated_at=now()`,
      [shop, encrypted, data.scope],
    );
    const mutation = `mutation OWNBACKWebhook($topic:WebhookSubscriptionTopic!,$uri:URL!) {
    webhookSubscriptionCreate(topic:$topic,webhookSubscription:{uri:$uri,format:JSON}) {
      webhookSubscription {id} userErrors {field message}
    }
  }`;
    let good = 0;
    for (const topic of topics) {
      const res = await fetch(`https://${shop}/admin/api/2026-10/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': data.access_token },
        body: JSON.stringify({
          query: mutation,
          variables: { topic, uri: new URL('/api/shopify/webhook', origin).toString() },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && !result.errors?.length && !result.data?.webhookSubscriptionCreate?.userErrors?.length)
        good++;
    }
    await pool.query(
      'UPDATE shopify_installations SET webhook_ready=$2,updated_at=now() WHERE shop_domain=$1',
      [shop, good === topics.length],
    );
    const reply = NextResponse.redirect(
      new URL(`/experience?connection=${good === topics.length ? 'connected' : 'webhooks-pending'}`, origin),
    );
    reply.cookies.delete('ob_shopify_state');
    reply.cookies.delete('ob_shopify_shop');
    return reply;
  } catch (e) {
    console.error('Shopify connection:', e instanceof Error ? e.message : 'Unknown error');
    return failure(e instanceof Error ? e.message : 'Connection failed');
  }
}
