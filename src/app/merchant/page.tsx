'use client';

import { RefreshCw, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { AppNav } from '@/components/AppNav';
import { NotConfigured } from '@/components/NotConfigured';
import { BudgetControls } from '@/components/merchant/BudgetControls';
import { OrdersTable } from '@/components/merchant/OrdersTable';
import { ExternalLink, KV, Skeleton, Stat, Tag } from '@/components/ui';
import { useMerchantData } from '@/hooks/useMerchantData';
import { useWallet } from '@/hooks/useWallet';
import { addresses, addressUrl, campaignId, isConfigured } from '@/lib/config';
import { duration, usd } from '@/lib/format';

export default function MerchantPage() {
  const { account } = useWallet();
  const { campaign, purchases, stats, error, refresh, loaded } = useMerchantData();
  const isMerchant = Boolean(
    account && campaign && account.toLowerCase() === campaign.merchant.toLowerCase(),
  );

  return (
    <main className="container app-main" id="main">
      <AppNav />

      <div className="app-title">
        <div>
          <div className="pill dark">
            <span className="led" /> MERCHANT CONSOLE · CAMPAIGN #{campaignId.toString()}
          </div>
          <h1>Your stock-back campaign</h1>
          <p>
            Every number here is read from Base. Rewards are reserved at checkout, so a customer&apos;s
            promised reward can&apos;t be withdrawn from under them.
          </p>
        </div>
        <div className="btn-row">
          <Link href="/growth" className="btn primary">Merchant Growth Studio <ArrowUpRight size={15} /></Link>
          {account && (
            <Tag tone={isMerchant ? 'green' : 'grey'}>{isMerchant ? 'Merchant wallet' : 'View only'}</Tag>
          )}
          <button className="btn" onClick={refresh} aria-label="Refresh data">
            <RefreshCw size={14} aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {!isConfigured && <NotConfigured />}
      {error && (
        <div className="banner-note" role="alert" style={{ marginBottom: 16 }}>
          Couldn&apos;t read from Base: {error}
        </div>
      )}
      {isConfigured && !loaded && !error && (
        <div className="grid cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div className="panel" key={i}>
              <Skeleton width="60%" />
              <div style={{ height: 10 }} />
              <Skeleton height={28} />
            </div>
          ))}
        </div>
      )}

      {campaign && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <Stat
              label="Checkout revenue"
              value={usd(stats.revenue)}
              note={`${stats.orders} orders · refunds excluded`}
            />
            <Stat
              label="Free budget"
              value={usd(campaign.available)}
              note={`of ${usd(campaign.funded - campaign.withdrawn)} funded`}
            />
            <Stat
              label="Reserved for customers"
              value={usd(campaign.reserved)}
              note="Waiting out the refund hold"
            />
            <Stat
              label="Rewards delivered"
              value={usd(campaign.spent)}
              note={`${stats.rewardShareOfRevenue.toFixed(2)}% of revenue`}
            />
          </div>

          <div className="grid cols-2" style={{ alignItems: 'start', marginBottom: 16 }}>
            <section className="panel" aria-labelledby="customers-title">
              <h2 id="customers-title">Customers</h2>
              <p className="sub">
                Observed behaviour, not proven lift. Measuring incrementality needs a holdout group.
              </p>
              <KV label="Unique paying wallets">{stats.customers}</KV>
              <KV label="Earned a first-purchase reward">{stats.firstTimers}</KV>
              <KV label="Came back inside the window">
                {stats.returners} ({(stats.returnRate * 100).toFixed(0)}%)
              </KV>
            </section>

            <section className="panel" aria-labelledby="rules-title">
              <h2 id="rules-title">Campaign rules</h2>
              <p className="sub">
                Enforced by the contract.{' '}
                <ExternalLink href={addressUrl(addresses.ownback!)}>View on explorer ↗</ExternalLink>
              </p>
              <KV label="First order / comeback">
                {campaign.firstBps / 100}% / {campaign.comebackBps / 100}%
              </KV>
              <KV label="Max reward · min order">
                {usd(campaign.maxReward)} · {usd(campaign.minOrder)}
              </KV>
              <KV label="Refund hold · return window">
                {duration(campaign.holdSeconds)} · {duration(campaign.returnWindow)}
              </KV>
              <KV label="Status">
                <Tag tone={campaign.paused ? 'orange' : 'green'}>
                  {campaign.paused ? 'Rewards paused' : 'Live'}
                </Tag>
              </KV>
            </section>
          </div>

          {isMerchant && <BudgetControls campaign={campaign} onChange={refresh} />}
          <OrdersTable purchases={purchases} isMerchant={isMerchant} onChange={refresh} />
        </>
      )}
    </main>
  );
}
