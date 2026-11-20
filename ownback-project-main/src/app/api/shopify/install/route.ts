import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { adminAuthorized } from '@/lib/commerce/auth';
import { validatedShop } from '@/lib/shopify/security';
export const runtime = 'nodejs';
/** Only OWNBACK's logged-in merchant can start an installation. */
export async function GET(req: NextRequest) {
  if (!(await adminAuthorized()))
    return NextResponse.json({ error: 'Merchant login required' }, { status: 401 });
  try {
    const shop = validatedShop(req.nextUrl.searchParams.get('shop') || '');
    if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET || !process.env.APP_ORIGIN)
      throw Error('Shopify app not configured');
    if (process.env.NODE_ENV === 'production' && !process.env.SHOPIFY_ALLOWED_SHOP)
      throw Error('SHOPIFY_ALLOWED_SHOP required in production pilot');
    if (process.env.SHOPIFY_ALLOWED_SHOP && shop !== validatedShop(process.env.SHOPIFY_ALLOWED_SHOP))
      throw Error('Shop not allowlisted for pilot');
    const state = randomBytes(24).toString('hex');
    const returnTo = new URL('/api/shopify/callback', process.env.APP_ORIGIN).toString();
    if (!returnTo.startsWith('https://') && process.env.NODE_ENV === 'production')
      throw Error('HTTPS required');
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set('client_id', process.env.SHOPIFY_CLIENT_ID);
    url.searchParams.set('scope', 'read_orders');
    url.searchParams.set('redirect_uri', returnTo);
    url.searchParams.set('state', state);
    const response = NextResponse.redirect(url);
    const options = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    };
    response.cookies.set('ob_shopify_state', state, options);
    response.cookies.set('ob_shopify_shop', shop, options);
    return response;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid installation request' },
      { status: 400 },
    );
  }
}
