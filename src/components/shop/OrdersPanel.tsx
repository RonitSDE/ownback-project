'use client';

import { useState } from 'react';
import { adapterAbi, ownbackAbi } from '@/lib/abi';
import { addresses, isMainnet, mirroredSymbol, txUrl } from '@/lib/config';
import { duration, KIND, STATUS, stockUnits, usd } from '@/lib/format';
import type { Campaign, PurchaseRow } from '@/lib/reads';
import { explain, publicClient, send } from '@/lib/wallet';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { ExternalLink, Tag } from '@/components/ui';

type Props = {
  campaign: Campaign;
  purchases: PurchaseRow[];
  stockSymbol?: string;
  now: number;
  onChange: () => Promise<void>;
};

const KIND_TONE = ['grey', 'green', 'blue'] as const;

export function OrdersPanel({ campaign, purchases, stockSymbol, now, onChange }: Props) {
  const { account, provider, wrongNetwork } = useWallet();
  const { notify } = useToast();
  const [settling, setSettling] = useState<bigint>();

  async function settle(row: PurchaseRow) {
    if (!account || !provider) return;
    setSettling(row.id);
    try {
      const quote = await publicClient.readContract({
        address: addresses.adapter!,
        abi: adapterAbi,
        functionName: 'quote',
        args: [addresses.stock!, row.reward],
      });
      const minOut = (quote * 995n) / 1000n; // 0.5% slippage floor, chosen by the customer
      const hash = await send({
        provider,
        account,
        address: addresses.ownback!,
        abi: ownbackAbi,
        functionName: 'settle',
        args: [row.id, minOut > 0n ? minOut : 1n],
      });
      notify({ kind: 'ok', message: 'Reward delivered to your wallet as stock.', tx: hash });
      await onChange();
    } catch (err) {
      notify({ kind: 'err', message: explain(err) });
    } finally {
      setSettling(undefined);
    }
  }

  const firstPending = purchases.some((p) => p.kind === 1 && p.status === 0);

  return (
    <section className="panel" aria-labelledby="orders-title" style={{ gridColumn: '1 / -1' }}>
      <h2 id="orders-title">Your orders and rewards</h2>
      <p className="sub">Read straight from Base. Your payment transaction is the purchase proof.</p>

      {purchases.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet. Your first one earns {campaign.firstBps / 100}% back in stock.</p>
        </div>
      ) : (
        <ul className="rows">
          {purchases.map((p) => {
            const due = p.paidAt + campaign.holdSeconds;
            const pending = p.status === 0 && p.reward > 0n;
            const waiting = pending && now > 0 && now < due;
            const settleable = pending && now >= due;
            const blockedByFirst = p.kind === 2 && firstPending;
            return (
              <li className="row" key={p.id.toString()}>
                <div>
                  <div className="main">
                    Order #{p.id.toString()} · {usd(p.amount)}
                  </div>
                  <div className="meta">
                    <Tag tone={KIND_TONE[p.kind]}>{KIND[p.kind]}</Tag>
                    {p.reward > 0n && <span>Reward {usd(p.reward)}</span>}
                    {p.delivered !== undefined && (
                      <span>
                        → {stockUnits(p.delivered)} {stockSymbol}
                      </span>
                    )}
                    <ExternalLink href={txUrl(p.payTx)}>payment ↗</ExternalLink>
                    {p.settleTx && <ExternalLink href={txUrl(p.settleTx)}>delivery ↗</ExternalLink>}
                  </div>
                </div>
                <div className="actions">
                  {waiting && <Tag tone="orange">Settles in {duration(due - now)}</Tag>}
                  {settleable && (
                    <button
                      className="btn lime"
                      onClick={() => settle(p)}
                      disabled={settling !== undefined || blockedByFirst || wrongNetwork}
                      title={blockedByFirst ? 'Settle your first-purchase reward first' : undefined}
                    >
                      {settling === p.id ? 'Settling…' : 'Settle reward'}
                    </button>
                  )}
                  {!waiting && !settleable && (
                    <Tag tone={p.status === 1 ? 'green' : p.status >= 2 ? 'red' : 'grey'}>
                      {p.reward === 0n && p.status === 0 ? 'Paid' : STATUS[p.status]}
                    </Tag>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="fine" style={{ marginTop: 14 }}>
        {isMainnet ? `${stockSymbol ?? mirroredSymbol} rewards involve actual B20 tokens transferred from inventory, subject to eligibility, issuer prospectus and corporate-action multipliers. Delivery is not guaranteed until confirmed.` : `Testnet: ${stockSymbol ?? mirroredSymbol} is a mock token, with no equity rights.`}
      </p>
    </section>
  );
}
