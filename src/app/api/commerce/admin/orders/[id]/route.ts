import { NextRequest, NextResponse } from 'next/server';
import { adminAuthorized, sameOrigin } from '@/lib/commerce/auth';
import { withTx, event } from '@/lib/commerce/db';
import { verifyPayment, settings, commercePublicClient } from '@/lib/commerce/chain';
import { ownbackAbi } from '@/lib/abi';
import { parseEventLogs, type Hex } from 'viem';
export const runtime = 'nodejs';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req) || !(await adminAuthorized()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const b = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Invalid order ID');
    if (b.action === 'fulfill') {
      const result = await withTx(async (c) => {
        const { rows } = await c.query('SELECT * FROM commerce_orders WHERE id=$1 FOR UPDATE', [id]);
        if (!rows.length || rows[0].status !== 'PAID') throw Error('Only paid orders can be fulfilled');
        await c.query(
          "UPDATE commerce_orders SET status='FULFILLED',fulfilled_at=now(),updated_at=now() WHERE id=$1",
          [id],
        );
        await event(c, id, 'FULFILLED');
        return { ok: true };
      });
      return NextResponse.json(result);
    }
    if (b.action === 'request_refund') {
      return NextResponse.json(
        await withTx(async (c) => {
          const { rows } = await c.query('SELECT * FROM commerce_orders WHERE id=$1 FOR UPDATE', [id]);
          if (!rows.length || !['PAID', 'FULFILLED'].includes(rows[0].status)) throw Error('Not refundable');
          await c.query("UPDATE commerce_orders SET status='REFUND_PENDING',updated_at=now() WHERE id=$1", [
            id,
          ]);
          await event(c, id, 'REFUND_REQUESTED');
          return { ok: true, purchaseId: rows[0].purchase_id };
        }),
      );
    }
    if (b.action === 'confirm_refund') {
      if (!/^0x[0-9a-fA-F]{64}$/.test(b.txHash)) throw Error('Invalid refund transaction');
      const s = settings();
      const receipt = await commercePublicClient.getTransactionReceipt({ hash: b.txHash as Hex });
      if (receipt.status !== 'success') throw Error('Refund transaction reverted');
      const logs = parseEventLogs({
        abi: ownbackAbi,
        logs: receipt.logs,
        eventName: 'Refunded',
        strict: true,
      });
      return NextResponse.json(
        await withTx(async (c) => {
          const { rows } = await c.query('SELECT * FROM commerce_orders WHERE id=$1 FOR UPDATE', [id]);
          const o = rows[0];
          if (!o || o.status !== 'REFUND_PENDING') throw Error('Not awaiting refund');
          const log = logs.find(
            (x) =>
              x.address.toLowerCase() === s.vault.toLowerCase() &&
              x.args.purchaseId === BigInt(o.purchase_id) &&
              x.args.amount === BigInt(o.total_usdc),
          );
          if (!log) throw Error('Refund is not linked to this order');
          await c.query('UPDATE commerce_orders SET status=$1,refund_tx=$2,updated_at=now() WHERE id=$3', [
            log.args.afterReward ? 'REFUNDED_AFTER_REWARD' : 'REFUNDED',
            b.txHash.toLowerCase(),
            id,
          ]);
          await event(c, id, 'REFUND_CONFIRMED', { txHash: b.txHash });
          return { ok: true };
        }),
      );
    }
    throw Error('Unknown action');
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Update failed' }, { status: 409 });
  }
}
