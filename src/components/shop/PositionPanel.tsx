'use client';

import { ArrowUpRight } from 'lucide-react';
import type { Balances, LiveReference, PriceInfo } from '@/hooks/useShopData';
import { mirroredSymbol } from '@/lib/config';
import { duration, stockUnits, usd, STOCK_DECIMALS } from '@/lib/format';
import { AAVE_COLLATERAL, LENDING_LINKS, LENDING_NOTE, MORPHO_LLTV, SUGGESTED_MAX_LTV } from '@/lib/lending';
import { classifyPrice, PRICE_STATUS_COPY } from '@/lib/price-status';
import { KV, Tag } from '@/components/ui';

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
        On Base mainnet this reward is {mirroredSymbol}, a Coinbase tokenized stock accepted as collateral for
        USDC loans. A loyalty balance that isn&apos;t dead points.
      </p>
      {lltv && <KV label="Morpho liquidation LTV">{(lltv * 100).toFixed(1)}%</KV>}
      <KV label="Aave V4 Equities Hub collateral">{AAVE_COLLATERAL.has(mirroredSymbol) ? 'Yes' : 'No'}</KV>
      <KV label={`Borrow headroom at ${SUGGESTED_MAX_LTV * 100}% LTV`}>
        ${(positionUsd * SUGGESTED_MAX_LTV).toFixed(2)}
      </KV>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <a className="btn lime" href={LENDING_LINKS.morpho} target="_blank" rel="noopener noreferrer">
          Morpho <ArrowUpRight size={14} aria-hidden />
        </a>
        <a className="btn" href={LENDING_LINKS.aave} target="_blank" rel="noopener noreferrer">
          Aave <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
      <p className="fine" style={{ marginTop: 12 }}>
        {LENDING_NOTE} OWNBACK suggests staying at or under {SUGGESTED_MAX_LTV * 100}% LTV: the token trades
        24/7, the underlying market doesn&apos;t.
      </p>
    </section>
  );
}
