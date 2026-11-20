'use client';

import { useCallback, useMemo, useState } from 'react';
import { isConfigured } from '@/lib/config';
import { readCampaign, readPurchases, type Campaign, type PurchaseRow } from '@/lib/reads';
import { explain } from '@/lib/wallet';
import { usePoll } from './usePoll';
import { requestClockResync } from './useNow';

export type MerchantStats = {
  orders: number;
  revenue: bigint;
  customers: number;
  firstTimers: number;
  returners: number;
  returnRate: number;
  rewardShareOfRevenue: number;
};

export function computeStats(purchases: PurchaseRow[]): MerchantStats {
  const live = purchases.filter((p) => p.status === 0 || p.status === 1);
  const revenue = live.reduce((a, p) => a + p.amount, 0n);
  const key = (p: PurchaseRow) => p.customer.toLowerCase();
  const customers = new Set(purchases.map(key));
  const firstTimers = new Set(purchases.filter((p) => p.kind === 1).map(key));
  const returners = new Set(purchases.filter((p) => p.kind === 2).map(key));
  const delivered = purchases
    .filter((p) => p.status === 1 || p.status === 3)
    .reduce((a, p) => a + p.reward, 0n);
  return {
    orders: purchases.length,
    revenue,
    customers: customers.size,
    firstTimers: firstTimers.size,
    returners: returners.size,
    returnRate: firstTimers.size ? returners.size / firstTimers.size : 0,
    rewardShareOfRevenue: revenue > 0n ? Number((delivered * 10_000n) / revenue) / 100 : 0,
  };
}

export function useMerchantData() {
  const [campaign, setCampaign] = useState<Campaign>();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const [c, rows] = await Promise.all([readCampaign(), readPurchases()]);
      setCampaign(c);
      setPurchases(rows);
      setError(undefined);
      requestClockResync();
    } catch (err) {
      setError(explain(err));
    }
  }, []);

  usePoll(refresh, 20_000, isConfigured);
  const stats = useMemo(() => computeStats(purchases), [purchases]);

  return { campaign, purchases, stats, error, refresh, loaded: Boolean(campaign) };
}
