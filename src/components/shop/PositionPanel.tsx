'use client';

import type { Balances, LiveReference, PriceInfo } from '@/hooks/useShopData';
import { mirroredSymbol } from '@/lib/config';
import { duration, stockUnits, usd, STOCK_DECIMALS } from '@/lib/format';
import { MORPHO_LLTV, SUGGESTED_MAX_LTV } from '@/lib/lending';
import { classifyPrice, PRICE_STATUS_COPY } from '@/lib/price-status';
import { KV, Tag } from '@/components/ui';
import { BorrowAction } from './BorrowAction';

type Props = {
  balances?: Balances;
  price?: PriceInfo;
  liveRef: LiveReference;
  pendingReward: bigint;
  now: number;
};

export function PositionPanel({ balances, price, liveRef, pendingReward, now }: Props) {
  const scale = 10 ** STOCK_DECIMALS;
  const priceUsd = price ? Number(price.price) / 1e6 : 0;
  const ageSeconds = price && now > 0 ? Math.max(0, now - price.updatedAt) : 0;
  const status = classifyPrice(ageSeconds, price?.maxAge ?? 0, Boolean(price && price.price > 0n));
  const tokens = balances ? Number(balances.stockBalance) / scale : 0;
  const shares = balances ? Number(balances.stockShares) / scale : 0;
  const positionUsd = tokens * priceUsd;
  const lltv = MORPHO_LLTV[mirroredSymbol];
  const statusCopy = PRICE_STATUS_COPY[status];

  return (
    <section className="panel dark" aria-labelledby="position-title">
      <div className="metric-label" id="position-title">
        Your stock rewards
      </div>
      <div className="metric" style={{ margin: '6px 0 2px' }}>
        {stockUnits(balances?.stockBalance ?? 0n)} {price?.symbol}
      </div>
      <p className="sub">
        ≈ ${positionUsd.toFixed(2)} at the mirrored {mirroredSymbol} price
        {pendingReward > 0n && ` · ${usd(pendingReward)} more on the way`}
      </p>

      <KV label="Share-equivalent (× multiplier)">
        <span className="mono">{shares.toFixed(6)}</span>
      </KV>
      <KV label="Mirrored price (on-chain)">
        ${priceUsd.toFixed(2)}{' '}
        <Tag tone={statusCopy.tone}>
          {statusCopy.label}
          {status !== 'fresh' && status !== 'missing' && ` · ${duration(ageSeconds)} ago`}
        </Tag>
      </KV>
      <KV label={`Coinbase ${mirroredSymbol} nav_price (live API)`}>
        {liveRef === null
          ? 'Loading…'
          : liveRef === 'unavailable'
            ? 'Unavailable'
            : `$${liveRef.navPrice.toFixed(2)}`}
      </KV>
      {status === 'market-closed' && (
        <p className="fine" style={{ marginTop: 8 }}>
          US markets are closed, so the reference price is the last published NAV. Checkout works as normal;
          rewards settle at this price.
        </p>
      )}
      {status === 'stale' && (
        <p className="fine" style={{ marginTop: 8 }}>
          Settlement is paused until the price refreshes. Checkout still works and your rewards stay reserved.
        </p>
      )}

      <div className="divider" />
      <div className="metric-label">Put it to work on mainnet</div>
      <p className="sub" style={{ marginTop: 6 }}>
        This Base Sepolia asset is synthetic and cannot be used as real lending collateral. Bankr can research eligible markets, but no loan is available through this reward.
      </p>
      {lltv && <KV label="Morpho liquidation LTV">{(lltv * 100).toFixed(1)}%</KV>}
      <KV label="Testnet collateral eligibility">Not eligible</KV>
      <KV label={`Illustrative borrowing at ${SUGGESTED_MAX_LTV * 100}% LTV`}>
        ${(positionUsd * SUGGESTED_MAX_LTV).toFixed(2)}
      </KV>
      <BorrowAction
        stockSymbol={price?.symbol ?? mirroredSymbol}
        collateralUnits={tokens.toFixed(6)}
        borrowUsdc={Math.max(0, positionUsd * SUGGESTED_MAX_LTV)}
        disabled={tokens <= 0}
      />
      <p className="fine" style={{ marginTop: 12 }}>
        Illustrative LTV figures are not an offer, quotation or loan limit. Actual lending would require verified collateral and an authorized user transaction.
      </p>
    </section>
  );
}
