import { NextRequest, NextResponse } from 'next/server';
import { isAddress, isHex, type Address, type Hex } from 'viem';
import { pool } from '@/lib/commerce/db';
import { sameOrigin } from '@/lib/commerce/auth';
import { enforceLimit } from '@/lib/commerce/limits';
import { shopifyClient } from '@/lib/shopify/chain';
import { tokenDigest } from '@/lib/shopify/security';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    await enforceLimit('shopify-claim', ip, 8, 15);
    const { token, wallet, signature } = await req.json();
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !isAddress(wallet) || !isHex(signature))
      throw Error('Invalid claim input');
    const message = `OWNBACK Shopify Reward\nOrigin: ${process.env.APP_ORIGIN}\nWallet: ${wallet.toLowerCase()}\nClaim: ${token}`;
    const valid = await shopifyClient.verifyMessage({
      address: wallet as Address,
      message,
      signature: signature as Hex,
    });
    if (!valid) throw Error('Wallet signature not valid');
    const digest = tokenDigest(token);
    const result = await pool.query(
      `UPDATE shopify_reward_orders SET status='CLAIMED',wallet=$2,claim_token_hash=NULL,claim_expires_at=NULL,updated_at=now()
    WHERE claim_token_hash=$1 AND status='CLAIM_SENT' AND claim_expires_at>now() RETURNING shop_domain,order_id`,
      [digest, wallet.toLowerCase()],
    );
    if (!result.rowCount)
      return NextResponse.json({ error: 'Claim expired, refunded, or already redeemed' }, { status: 409 });
    return NextResponse.json({
      claimed: true,
      orderId: result.rows[0].order_id,
      status: 'AWAITING_ELIGIBILITY_AND_SETTLEMENT',
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Claim failed' }, { status: 400 });
  }
}
