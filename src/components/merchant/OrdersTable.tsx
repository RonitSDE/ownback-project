'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { txUrl } from '@/lib/config';
import { KIND, shortAddress, STATUS, usd } from '@/lib/format';
import { refundOrder } from '@/lib/merchant-actions';
import type { PurchaseRow } from '@/lib/reads';
import { explain } from '@/lib/wallet';
import { ExternalLink, Tag } from '@/components/ui';

const KIND_TONE = ['grey', 'green', 'blue'] as const;

export function OrdersTable({
  purchases,
  isMerchant,
  onChange,
}: {
  purchases: PurchaseRow[];
  isMerchant: boolean;
  onChange: () => Promise<void>;
}) {
  const { account, provider, wrongNetwork } = useWallet();
  const { notify } = useToast();
  const [refunding, setRefunding] = useState<bigint>();
  const [confirming, setConfirming] = useState<bigint>();

  async function refund(row: PurchaseRow) {
    if (!account || !provider) return;
    setConfirming(undefined);
    setRefunding(row.id);
    try {
      const tx = await refundOrder({ account, provider }, row.id, row.amount);
      notify({
        kind: 'ok',
        tx,
        message:
          row.status === 1
            ? 'Refunded. Stock already delivered is recorded, not clawed back.'
            : 'Refunded and the reserved reward released.',
      });
      await onChange();
    } catch (err) {
      notify({ kind: 'err', message: explain(err) });
    } finally {
      setRefunding(undefined);
    }
  }

  return (
    <section className="panel" aria-labelledby="orders-title">
      <h2 id="orders-title">Orders</h2>
      <p className="sub">
        Each row is a USDC payment on Base. Refunds return the customer&apos;s USDC from your wallet.
      </p>
      {purchases.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet. Open the Shop page in another wallet to place one.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Orders placed through OWNBACK checkout</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Customer</th>
                <th scope="col">Amount</th>
                <th scope="col">Type</th>
                <th scope="col">Reward</th>
                <th scope="col">Status</th>
                <th scope="col">Tx</th>
                {isMerchant && <th scope="col">Action</th>}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id.toString()}>
                  <td>{p.id.toString()}</td>
                  <td className="mono">{shortAddress(p.customer)}</td>
                  <td>{usd(p.amount)}</td>
                  <td>
                    <Tag tone={KIND_TONE[p.kind]}>{KIND[p.kind]}</Tag>
                  </td>
                  <td>{p.reward > 0n ? usd(p.reward) : '—'}</td>
                  <td>
                    <Tag tone={p.status === 1 ? 'green' : p.status >= 2 ? 'red' : 'grey'}>
                      {STATUS[p.status]}
                    </Tag>
                  </td>
                  <td>
                    <ExternalLink href={txUrl(p.payTx)}>pay ↗</ExternalLink>
                    {p.settleTx && (
                      <>
                        {' · '}
                        <ExternalLink href={txUrl(p.settleTx)}>reward ↗</ExternalLink>
                      </>
                    )}
                  </td>
                  {isMerchant && (
                    <td>
                      {(p.status === 0 || p.status === 1) &&
                        (confirming === p.id ? (
                          <span className="btn-row">
                            <button
                              className="btn danger sm"
                              onClick={() => refund(p)}
                              disabled={wrongNetwork}
                            >
                              Confirm {usd(p.amount)}
                            </button>
                            <button className="btn sm" onClick={() => setConfirming(undefined)}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="btn sm"
                            onClick={() => setConfirming(p.id)}
                            disabled={refunding !== undefined || wrongNetwork}
                          >
                            {refunding === p.id ? 'Refunding…' : 'Refund'}
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
