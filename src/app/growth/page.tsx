'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  ChartNoAxesCombined,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { calculateEconomics, loopTemplates, type EconomicsInput } from '@/lib/retention/economics';
import { proposeRetentionPolicy } from '@/lib/retention/agent';
import '../retention.css';

type Channel = { purchases: number; buyers: number; returning: number; paid_usdc: string };
type CohortRow = {
  shop_domain: string;
  eligible_orders: number;
  identifiable_customers: number;
  repeat_orders: number;
  repeat_customers: number;
  returned_in_7d: number;
  returned_in_30d: number;
  first_revenue_micro_usdc: string;
  repeat_revenue_micro_usdc: string;
};
type CohortReport = { source: string; stores: CohortRow[]; limitations: string[] };
type LiveData = {
  mode: 'observed_live';
  shopify: Channel & {
    reserved: number;
    eligible: number;
    settling: number;
    delivered: number;
    refunded: number;
    post_settlement_refunds: number;
    rewards_disbursed_usdc: string;
  };
  native: Channel;
  experimentalLift: null;
  experimentalLiftReason: string;
  crossChannelDeduplication: false;
};
const currency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const initial: EconomicsInput = {
  orderValue: 50,
  grossMarginPercent: 35,
  firstRewardPercent: 2,
  comebackRewardPercent: 5,
  controlReturnPercent: 9,
  rewardedReturnPercent: 22,
  buyers: 100,
};
const clamp = (n: number, min: number, max: number, previous: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : previous;
export default function Growth() {
  const [inputs, setInputs] = useState(initial);
  const [budgetUsd, setBudgetUsd] = useState(200);
  const [template, setTemplate] = useState<keyof typeof loopTemplates>('retail');
  const [live, setLive] = useState<LiveData | null>(null);
  const [liveStatus, setLiveStatus] = useState('Merchant sign-in required to see live purchase evidence.');
  const [copied, setCopied] = useState(false);
  const [cohorts, setCohorts] = useState<CohortReport | null>(null);
  const [cohortStatus, setCohortStatus] = useState('Merchant sign-in required.');
  const model = useMemo(() => calculateEconomics(inputs), [inputs]);
  const merchantAdvice = useMemo(
    () =>
      proposeRetentionPolicy({
        firstOrders: inputs.buyers,
        expectedRepeatOrders: Math.round((inputs.buyers * inputs.rewardedReturnPercent) / 100),
        averageOrderUsd: inputs.orderValue,
        firstRewardPercent: inputs.firstRewardPercent,
        desiredComebackPercent: inputs.comebackRewardPercent,
        grossMarginPercent: inputs.grossMarginPercent,
        merchantBudgetUsd: budgetUsd,
      }),
    [inputs, budgetUsd],
  );
  const set = (key: keyof EconomicsInput, n: number, min: number, max: number) =>
    setInputs((v) => ({ ...v, [key]: clamp(n, min, max, v[key]) }));
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/retention/cohorts', { cache: 'no-store' });
      if (response.ok) {
        setCohorts((await response.json()) as CohortReport);
        setCohortStatus('Authenticated, non-refunded order evidence');
      } else {
        setCohorts(null);
        setCohortStatus(
          response.status === 401 ? 'Merchant sign-in required.' : 'Cohort evidence unavailable.',
        );
      }
    } catch {
      setCohorts(null);
      setCohortStatus('Cohort evidence unavailable.');
    }
    try {
      const response = await fetch('/api/retention/overview', { cache: 'no-store' });
      if (!response.ok) {
        setLive(null);
        setLiveStatus(
          response.status === 401
            ? 'Merchant sign-in required to see live purchase evidence.'
            : 'Live analytics temporarily unavailable. No sample data is substituted.',
        );
        return;
      }
      const data = (await response.json()) as LiveData;
      setLive(data);
      setLiveStatus('Authenticated merchant records · observed only');
    } catch {
      setLive(null);
      setLiveStatus('Live analytics unavailable. No sample data is substituted.');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  function selectTemplate(key: keyof typeof loopTemplates) {
    const proposal = loopTemplates[key];
    setTemplate(key);
    setInputs((v) => ({
      ...v,
      firstRewardPercent: proposal.firstRewardPercent,
      comebackRewardPercent: proposal.comebackRewardPercent,
    }));
  }
  async function copy() {
    const text = `OWNBACK merchant scenario (illustrative)\nAOV ${currency(inputs.orderValue)}, gross margin ${inputs.grossMarginPercent}%, ${inputs.buyers} first buyers.\nFirst reward ${inputs.firstRewardPercent}%, return reward ${inputs.comebackRewardPercent}%.\nAssumed control repeat ${inputs.controlReturnPercent}%, rewarded repeat ${inputs.rewardedReturnPercent}%.\nProjected incremental gross profit ${currency(model.incrementalGrossProfit)}, reward cost ${currency(model.totalRewardCost)}, net contribution ${currency(model.netContribution)}.\nNo causal inference or real campaign terms implied.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <main className="v37-shell v37-page" id="main">
      <div className="v37-topline">
        <span>
          <span className="v37-signal" /> MERCHANT GROWTH STUDIO
        </span>
        <span>Base · economics before distribution</span>
      </div>
      <header className="v37-nav v37-width">
        <Link href="/" className="v37-logo">
          <span>↗</span> OWNBACK<b>.</b>
        </Link>
        <nav>
          <Link href="/agentic">Discover</Link>
          <Link href="/ownership">My ownership</Link>
          <Link href="/growth" aria-current="page">
            Merchant growth
          </Link>
          <Link href="/allocation">Allocation agent</Link>
          <Link href="/protocol">Evidence</Link>
        </nav>
        <Link className="v37-nav-cta" href="/commerce/admin">
          Merchant sign-in <ArrowUpRight size={15} />
        </Link>
      </header>
      <div className="v37-width">
        <section className="v37-page-head">
          <div className="v37-kicker">PROOF OF RETENTION · MERCHANT ECONOMICS</div>
          <h1>
            Make every comeback
            <br />
            worth the investment.
          </h1>
          <p>
            Understand the business behind your loyalty Loop. Model reward costs and break-even repeat
            purchases, then compare against authenticated merchant activity—not fabricated growth metrics.
          </p>
        </section>
        <div className="v37-econ-grid">
          <section className="v37-card">
            <div className="v37-kicker">
              <SlidersHorizontal size={14} /> EXPLORE A SCENARIO
            </div>
            <h2 style={{ marginTop: 16 }}>Design your Loop.</h2>
            <p>
              Presets are editable, illustrative starting points. They do not change deployed contracts or
              merchant offers.
            </p>
            <div className="v37-page-tabs" style={{ marginTop: 20 }}>
              {(Object.keys(loopTemplates) as (keyof typeof loopTemplates)[]).map((k) => (
                <button key={k} onClick={() => selectTemplate(k)} aria-pressed={template === k}>
                  {loopTemplates[k].label}
                </button>
              ))}
            </div>
            <div className="v37-control-grid">
              <div className="v37-field">
                <label htmlFor="ob-aov">Average order value ($)</label>
                <input
                  id="ob-aov"
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={inputs.orderValue}
                  onChange={(e) => set('orderValue', Number(e.target.value), 0.01, 1e6)}
                />
              </div>
              <div className="v37-field">
                <label htmlFor="ob-margin">Gross margin (%)</label>
                <input
                  id="ob-margin"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={inputs.grossMarginPercent}
                  onChange={(e) => set('grossMarginPercent', Number(e.target.value), 0, 100)}
                />
              </div>
              <div className="v37-field">
                <label htmlFor="ob-audience">First-purchase buyers</label>
                <input
                  id="ob-audience"
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={inputs.buyers}
                  onChange={(e) => set('buyers', Number(e.target.value), 1, 1e6)}
                />
              </div>
              <div className="v37-field">
                <label htmlFor="ob-window">Comeback window</label>
                <input
                  id="ob-window"
                  value={`${loopTemplates[template].windowDays} days (template)`}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>
            {(
              [
                ['firstRewardPercent', 'First-purchase reward', 10],
                ['comebackRewardPercent', 'Comeback reward', 15],
                ['controlReturnPercent', 'Assumed control repeat rate', 70],
                ['rewardedReturnPercent', 'Assumed rewarded repeat rate', 70],
              ] as const
            ).map(([key, label, max]) => (
              <div key={key}>
                <div className="v37-slider-row">
                  <label htmlFor={`ob-${key}`}>{label}</label>
                  <strong>{inputs[key]}%</strong>
                </div>
                <input
                  className="v37-range"
                  id={`ob-${key}`}
                  type="range"
                  min="0"
                  max={max}
                  step=".5"
                  value={inputs[key]}
                  onChange={(e) => set(key, Number(e.target.value), 0, max)}
                />
              </div>
            ))}
            <div className="v37-model-note" style={{ marginTop: 25 }}>
              Scenario inputs are hypothetical. A merchant's actual first/comeback rates and refund holds are
              enforced by its deployed reward contract, not these sliders.
            </div>
          </section>
          <section className="v37-card">
            <div className="v37-kicker">
              <Calculator size={15} /> REWARD ECONOMICS · MODEL ONLY
            </div>
            <h2 style={{ marginTop: 15 }}>Does your campaign pay back?</h2>
            <p>
              Compare projected incremental gross profit with all initial and return rewards. Assumes one
              repeat order and a matched, unrewarded baseline.
            </p>
            <div className="v37-metrics-grid">
              <div className="v37-metric">
                <small>Additional repeat revenue</small>
                <strong>{currency(model.incrementalRevenue)}</strong>
                <b>{model.incrementalReturns.toFixed(1)} incremental orders</b>
              </div>
              <div className="v37-metric">
                <small>Total reward commitment</small>
                <strong>{currency(model.totalRewardCost)}</strong>
                <b>Includes first + comeback payouts</b>
              </div>
              <div className="v37-metric">
                <small>Incremental gross contribution</small>
                <strong>{currency(model.incrementalGrossProfit)}</strong>
                <b>Margin on projected extra revenue</b>
              </div>
              <div className={'v37-metric ' + (model.netContribution < 0 ? 'v37-metric-negative' : '')}>
                <small>Projected net contribution</small>
                <strong>{currency(model.netContribution)}</strong>
                <b>{model.netContribution >= 0 ? 'Positive in this model' : 'Loss-making in this model'}</b>
              </div>
            </div>
            <div className="v37-data-box">
              <strong>
                Break-even rewarded repeat rate:{' '}
                {model.breakevenRewardedReturnPercent === null
                  ? 'Not achievable under these assumptions'
                  : `${model.breakevenRewardedReturnPercent.toFixed(1)}%`}
              </strong>
              <div>
                Cost per incremental returning customer:{' '}
                {model.costPerIncrementalReturn === null
                  ? 'Not meaningful without positive incremental returns'
                  : currency(model.costPerIncrementalReturn)}
              </div>
            </div>
            <div className="v37-kicker" style={{ marginTop: 26 }}>
              REPEAT PURCHASE · ASSUMED RATES
            </div>
            <div className="v37-compact-chart">
              <div className="v37-bar-wrap">
                <strong>{inputs.controlReturnPercent}%</strong>
                <div
                  className="v37-bar v37-bar-control"
                  style={{ height: Math.max(7, (inputs.controlReturnPercent / 70) * 147) + 'px' }}
                />
                <small>Control (assumed)</small>
              </div>
              <div className="v37-bar-wrap">
                <strong>{inputs.rewardedReturnPercent}%</strong>
                <div
                  className="v37-bar v37-bar-rewarded"
                  style={{ height: Math.max(7, (inputs.rewardedReturnPercent / 70) * 147) + 'px' }}
                />
                <small>Rewarded (assumed)</small>
              </div>
            </div>
            <p className="v37-hint">
              This visual is a calculator scenario, not live pilot lift. It excludes taxes, stock execution
              fees, returns after payout, fulfillment and campaign administration costs.
            </p>
            <div className="v37-inline-actions">
              <button onClick={copy}>
                <ArrowUpRight size={16} /> Copy scenario summary
              </button>
              {copied && <span className="v37-saved-msg">Copied</span>}
            </div>
          </section>
        </div>
        <section className="v37-card" style={{ marginTop: 20, marginBottom: 20 }}>
          <div className="v37-kicker">BOUNDED RETENTION AGENT · SIMULATION</div>
          <h2 style={{ marginTop: 14 }}>The agent must respect the merchant's budget.</h2>
          <p>
            This deterministic planner uses the scenario above to refuse or reduce a proposed cashback
            campaign when projected commitments breach your stated limit. It does not change contract terms or
            estimate actual causality.
          </p>
          <div className="v37-control-grid" style={{ maxWidth: 420 }}>
            <div className="v37-field">
              <label htmlFor="merchant-budget">Maximum assumed campaign budget (USD)</label>
              <input
                id="merchant-budget"
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={budgetUsd}
                onChange={(e) => setBudgetUsd(clamp(Number(e.target.value), 0, 1e6, budgetUsd))}
              />
            </div>
            <div className="v37-field">
              <label>Expected return orders (scenario)</label>
              <input
                readOnly
                value={Math.round((inputs.buyers * inputs.rewardedReturnPercent) / 100)}
                aria-label="Projected repeat orders"
              />
            </div>
          </div>
          <div className="v37-data-box">
            <strong>
              {merchantAdvice.verdict === 'REFUSED'
                ? 'REFUSED — campaign violates a guardrail'
                : `PROPOSED — ${merchantAdvice.proposedComebackPercent?.toFixed(2)}% max comeback reward`}
            </strong>
            <div>{merchantAdvice.reasons.join(' ')}</div>
            <div>
              Forecast first-order commitment: {currency(merchantAdvice.firstRewardCommitmentUsd)} · Forecast
              total:{' '}
              {merchantAdvice.projectedTotalCommitmentUsd === null
                ? 'not approved'
                : currency(merchantAdvice.projectedTotalCommitmentUsd)}{' '}
              · Unused budget:{' '}
              {merchantAdvice.unusedBudgetUsd === null ? '—' : currency(merchantAdvice.unusedBudgetUsd)}
            </div>
          </div>
          <p className="v37-hint">
            {merchantAdvice.safeguards.join(' ')} Approval and onchain changes remain separate merchant
            actions.
          </p>
        </section>
        <section className="v37-card" style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 18,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div className="v37-kicker">PROOF OF RETENTION · AUTHENTICATED</div>
              <h2 style={{ marginTop: 12 }}>What actually happened.</h2>
              <p>
                Real paid order records are shown only after merchant authentication. Shopify and native-USDC
                customers are not merged.
              </p>
            </div>
            <button className="v37-button v37-button-plain" onClick={load}>
              <RefreshCw size={15} /> Refresh evidence
            </button>
          </div>
          {!live ? (
            <div className="v37-empty">
              <ShieldAlert size={27} />
              {liveStatus}
              <div className="v37-inline-actions" style={{ justifyContent: 'center' }}>
                <Link href="/commerce/admin">
                  Sign in to merchant console <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="v37-reward-grid" style={{ marginTop: 22 }}>
                {[
                  { name: 'Shopify · signed paid orders', data: live.shopify },
                  { name: 'Native Base · USDC receipts', data: live.native },
                ].map(({ name, data }) => (
                  <div className="v37-card" key={name} style={{ background: '#fafbfc' }}>
                    <div className="v37-kicker">{name}</div>
                    <div className="v37-metrics-grid">
                      <div className="v37-metric">
                        <small>Verified purchases</small>
                        <strong>{data.purchases}</strong>
                      </div>
                      <div className="v37-metric">
                        <small>Observed repeat rate</small>
                        <strong>
                          {data.buyers ? `${((data.returning / data.buyers) * 100).toFixed(1)}%` : '—'}
                        </strong>
                      </div>
                    </div>
                    <p className="v37-hint">
                      {data.buyers} distinct identities in this channel · {data.returning} observed returners
                    </p>
                  </div>
                ))}
              </div>
              <div
                className="v37-metrics-grid"
                style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}
              >
                {[
                  { label: 'Shopify held', value: live.shopify.reserved },
                  { label: 'Eligible / claim', value: live.shopify.eligible },
                  { label: 'Onchain settling', value: live.shopify.settling },
                  { label: 'Delivered', value: live.shopify.delivered },
                  { label: 'Refunded', value: live.shopify.refunded },
                  { label: 'Refund after delivery', value: live.shopify.post_settlement_refunds },
                ].map((x) => (
                  <div className="v37-metric" key={x.label}>
                    <small>{x.label}</small>
                    <strong>{x.value}</strong>
                  </div>
                ))}
              </div>
              <div className="v37-data-box">
                <strong>Lift is not yet measured.</strong> {live.experimentalLiftReason} A before-exposure
                assignment and clean exposure audit are needed before a control-group comparison is
                meaningful.
              </div>
            </>
          )}
        </section>
        <section className="v37-card" style={{ marginTop: 20 }}>
          <div className="v37-kicker">SHOPIFY COHORTS · ACTUAL REPEAT ORDERS</div>
          <h2 style={{ marginTop: 14 }}>The return purchase is the proof.</h2>
          <p>
            Authenticated Shopify records, grouped separately per merchant. First-order revenue and
            repeat-order revenue are measured in USDC-denominated checkout amounts, not stock appreciation. No
            control-group lift is claimed.
          </p>
          {!cohorts ? (
            <div className="v37-empty">{cohortStatus}</div>
          ) : cohorts.stores.length === 0 ? (
            <div className="v37-empty">
              No qualifying paid Shopify reward orders yet. The pilot has no live customer outcome to claim.
            </div>
          ) : (
            <div className="v37-reward-grid">
              {cohorts.stores.map((store) => (
                <div className="v37-card" key={store.shop_domain} style={{ background: '#f8fafc' }}>
                  <div className="v37-kicker">{store.shop_domain}</div>
                  <div className="v37-metrics-grid">
                    <div className="v37-metric">
                      <small>Tracked customers</small>
                      <strong>{store.identifiable_customers}</strong>
                    </div>
                    <div className="v37-metric">
                      <small>Returned at least once</small>
                      <strong>{store.repeat_customers}</strong>
                    </div>
                    <div className="v37-metric">
                      <small>First-order revenue</small>
                      <strong>{currency(Number(store.first_revenue_micro_usdc) / 1e6)}</strong>
                    </div>
                    <div className="v37-metric">
                      <small>Repeat-order revenue</small>
                      <strong>{currency(Number(store.repeat_revenue_micro_usdc) / 1e6)}</strong>
                    </div>
                  </div>
                  <p className="v37-hint">
                    {store.eligible_orders} eligible tracked orders · {store.repeat_orders} additional orders
                    · {store.returned_in_7d} returned within 7d · {store.returned_in_30d} returned within 30d.
                    Recent cohorts are not fully matured.
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="v37-data-box">
            {cohorts?.limitations.join(' ') ||
              'Observed purchase records are never evidence of causal retention lift without an assigned control.'}
          </div>
          <Link href="/allocation" className="v37-text-link">
            Explore policy-constrained stock reward allocation <ArrowUpRight size={15} />
          </Link>
        </section>
        <div className="v37-reward-grid" style={{ margin: '20px 0 75px' }}>
          <section className="v37-card">
            <div className="v37-kicker">
              <ShieldCheck size={14} /> THE FINALITY GUARANTEE
            </div>
            <h2 style={{ marginTop: 14 }}>Budget reserved. Settlement earned.</h2>
            <p>
              Reserve → Hold → Verify → Settle. Refunded or cancelled orders cannot freely proceed to
              delivery. After actual token delivery, a late refund creates a merchant liability; it cannot
              magically reverse the stock transfer.
            </p>
            <Link href="/protocol" className="v37-text-link">
              Review protocol evidence <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="v37-card">
            <div className="v37-kicker">
              <Wallet size={14} /> THE CUSTOMER SIDE
            </div>
            <h2 style={{ marginTop: 14 }}>Every reward stays understandable.</h2>
            <p>
              A simple wallet displays reservations, claims, settlement and delivered mock token balances.
              Future real equity claims require compliant issuance and jurisdiction screening.
            </p>
            <Link href="/ownership" className="v37-text-link">
              See ownership portfolio <ArrowUpRight size={15} />
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
