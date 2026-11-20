'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { isConfigured, mirroredSymbol } from '@/lib/config';
import {
  readBalances,
  readCampaign,
  readPrice,
  readPurchases,
  type Campaign,
  type PurchaseRow,
} from '@/lib/reads';
import { explain } from '@/lib/wallet';
import { usePoll } from './usePoll';
import { requestClockResync } from './useNow';

export type PriceInfo = Awaited<ReturnType<typeof readPrice>>;
export type Balances = Awaited<ReturnType<typeof readBalances>>;
export type LiveReference = { navPrice: number; navUpdatedAt: string | null } | 'unavailable' | null;

export function useShopData(account?: Address) {
  const [campaign, setCampaign] = useState<Campaign>();
  const [price, setPrice] = useState<PriceInfo>();
  const [balances, setBalances] = useState<Balances>();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const [c, p] = await Promise.all([readCampaign(), readPrice()]);
      setCampaign(c);
      setPrice(p);
      if (account) {
        const [b, rows] = await Promise.all([readBalances(account), readPurchases(account)]);
        setBalances(b);
        setPurchases(rows);
      } else {
        setBalances(undefined);
        setPurchases([]);
      }
      setError(undefined);
      requestClockResync();
    } catch (err) {
      setError(explain(err));
    }
  }, [account]);

  usePoll(refresh, 15_000, isConfigured);

  return { campaign, price, balances, purchases, error, refresh, loaded: Boolean(campaign) };
}

/** Live Coinbase reference price for the mirrored symbol, via our server proxy. */
export function useLiveReference(): LiveReference {
  const [ref, setRef] = useState<LiveReference>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/prices', { signal: ctrl.signal })
      .then((r) => r.json())
      .then(
        (body: {
          ok: boolean;
          stocks?: { symbol: string; navPrice: number; navUpdatedAt: string | null }[];
        }) => {
          const q = body.ok ? body.stocks?.find((s) => s.symbol === mirroredSymbol) : undefined;
          setRef(q ? { navPrice: q.navPrice, navUpdatedAt: q.navUpdatedAt } : 'unavailable');
        },
      )
      .catch((err) => (err as Error).name !== 'AbortError' && setRef('unavailable'));
    return () => ctrl.abort();
  }, []);
  return ref;
}
