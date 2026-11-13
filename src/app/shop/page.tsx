'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
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
import { isConfigured, isMainnet } from '@/lib/config';

export default function ShopPage() {
  const { account } = useWallet();
  const { campaign, price, balances, purchases, error, refresh, loaded } = useShopData(account);
  const liveRef = useLiveReference();
  const now = useNow();

  const pendingReward = purchases
    .filter((p) => p.status === 0 && p.reward > 0n)
    .reduce((a, p) => a + p.reward, 0n);

  // The sample goods below have no real merchant fulfillment. Never accept real money
  // against an illustrative test-store catalog. Base mainnet uses /commerce only.
  if (isMainnet) {
    return (
      <main className="container app-main" id="main">
        <AppNav />
        <section className="panel" style={{maxWidth: 740, margin: '50px auto'}}>
          <div className="pill dark">BASE MAINNET · VERIFIED MERCHANTS ONLY</div>
          <h1>Real payments belong in a real store.</h1>
          <p className="sub">The original /shop catalog contains illustrative sample products and is intentionally disabled for real-USDC checkout. Use the authenticated merchant catalog for verified goods and a recipient-eligible, inventory-backed B20 reward.</p>
          <Link href="/commerce" className="btn primary">Open merchant checkout</Link>
          <p className="fine">Stock rewards are restricted to approved wallets. B20 inventory and an up-to-date Chainlink total-return price are required for delivery.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container app-main" id="main">
      <AppNav />

      <div className="app-title">
        <div>
          <div className="pill dark">
            <span className="led" /> {isMainnet ? 'VERIFIED-RECIPIENT PILOT · BASE MAINNET' : 'DEMO STORE · BASE TESTNET'}
          </div>
          <h1>Pay in USDC. Get paid back in stock.</h1>
          <p>
            {campaign
              ? `${campaign.firstBps / 100}% back on your first order, ${campaign.comebackBps / 100}% when you come back within ${Math.round(campaign.returnWindow / 86400)} days. After the hold, eligible rewards settle in the paying wallet as ${isMainnet ? 'real, inventory-backed B20 stock subject to recipient eligibility and fresh oracle prices' : 'mock stock on Base Sepolia'}.`
              : isMainnet ? 'Real B20 rewards require an approved wallet, prefunded inventory and a fresh Chainlink feed.' : 'Eligible rewards may settle as mock stock tokens on Base Sepolia after the refund hold.'}
          </p>
        </div>
        {account && (
          <div className="btn-row">
            <button className="btn" onClick={refresh} aria-label="Refresh data">
              <RefreshCw size={14} aria-hidden /> Refresh
            </button>
            {!isMainnet && <FaucetButton onDone={refresh} />}
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
            {isMainnet ? 'Use a separately verified and approved wallet on Base mainnet. Real USDC is required and no test faucet is available.' : 'Coinbase Wallet, MetaMask or Rabby on Base Sepolia. You will get free test USDC for the demonstration checkout.'}
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
