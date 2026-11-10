'use client';

import { RefreshCw } from 'lucide-react';
import { AppNav } from '@/components/AppNav';
import { NotConfigured } from '@/components/NotConfigured';
import { CheckoutPanel } from '@/components/shop/CheckoutPanel';
import { OrdersPanel } from '@/components/shop/OrdersPanel';
import { PositionPanel } from '@/components/shop/PositionPanel';
import { FaucetButton } from '@/components/shop/FaucetButton';
import { Skeleton } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { useLiveReference, useShopData } from '@/hooks/useShopData';
import { useWallet } from '@/hooks/useWallet';
import { isConfigured } from '@/lib/config';

export default function ShopPage() {
  const { account } = useWallet();
  const { campaign, price, balances, purchases, error, refresh, loaded } = useShopData(account);
  const liveRef = useLiveReference();
  const now = useNow();

  const pendingReward = purchases
    .filter((p) => p.status === 0 && p.reward > 0n)
    .reduce((a, p) => a + p.reward, 0n);

  return (
    <main className="container app-main" id="main">
      <AppNav />

      <div className="app-title">
        <div>
          <div className="pill dark">
            <span className="led" /> DEMO STORE · BASE TESTNET
          </div>
          <h1>Pay in USDC. Get paid back in stock.</h1>
          <p>
            {campaign
              ? `${campaign.firstBps / 100}% back on your first order, ${campaign.comebackBps / 100}% when you come back within ${Math.round(campaign.returnWindow / 86400)} days. After the hold, eligible rewards settle in the paying wallet as mock tokenized stock on Base Sepolia.`
              : 'Eligible rewards may settle as mock stock tokens on Base Sepolia after the refund hold.'}
          </p>
        </div>
        {account && (
          <div className="btn-row">
            <button className="btn" onClick={refresh} aria-label="Refresh data">
              <RefreshCw size={14} aria-hidden /> Refresh
            </button>
            <FaucetButton onDone={refresh} />
          </div>
        )}
      </div>

      {!isConfigured && <NotConfigured />}
      {error && (
        <div className="banner-note" role="alert" style={{ marginBottom: 16 }}>
          Couldn&apos;t read from Base: {error}
        </div>
      )}

      {isConfigured && !loaded && !error && (
        <div className="grid cols-2">
          <div className="panel">
            <Skeleton height={22} width="40%" />
            <div style={{ height: 14 }} />
            <Skeleton height={120} />
          </div>
          <div className="panel dark">
            <Skeleton height={22} width="50%" />
            <div style={{ height: 14 }} />
            <Skeleton height={120} />
          </div>
        </div>
      )}

      {campaign && !account && (
        <div className="panel connect-cta">
          <h2>Connect a wallet to shop</h2>
          <p className="sub">
            Coinbase Wallet, MetaMask or Rabby on Base Sepolia. You&apos;ll get free test USDC for a real
            checkout.
          </p>
          <p className="fine">Use the Connect wallet button at the top of the page.</p>
        </div>
      )}

      {campaign && account && (
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <CheckoutPanel
            campaign={campaign}
            balances={balances}
            purchases={purchases}
            stockSymbol={price?.symbol}
            now={now}
            onPaid={refresh}
          />
          <PositionPanel
            balances={balances}
            price={price}
            liveRef={liveRef}
            pendingReward={pendingReward}
            now={now}
          />
          <OrdersPanel
            campaign={campaign}
            purchases={purchases}
            stockSymbol={price?.symbol}
            now={now}
            onChange={refresh}
          />
        </div>
      )}
    </main>
  );
}
