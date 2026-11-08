'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  FileCheck2,
  Gift,
  Home,
  Info,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  initialDemoState,
  evaluatePurchase,
  refundPurchase,
  metrics,
  dollars,
  stockTokens,
  DAY_MS,
  MOCK_STOCK_PRICE_CENTS,
  type DemoState,
  type DemoReceipt,
} from '@/lib/engine';
type View = 'overview' | 'campaigns' | 'wallet' | 'activity' | 'proof';
const chartData = [
  { day: 'Fri', value: 34 },
  { day: 'Sat', value: 52 },
  { day: 'Sun', value: 45 },
  { day: 'Mon', value: 79 },
  { day: 'Tue', value: 61 },
  { day: 'Wed', value: 92 },
  { day: 'Thu', value: 76 },
];
const startState: DemoState = {
  ...initialDemoState,
  initialCustomers: 201,
  initialReturning: 57,
  initialSpentCents: 64680,
  initialDelivered: 124,
};
function CustomerLabel({ id }: { id: string }) {
  return <span className="mono">{id}</span>;
}
export default function DemoPage() {
  const [state, setState] = useState<DemoState>(startState);
  const [view, setView] = useState<View>('overview');
  const [modal, setModal] = useState(false);
  const [purchaseType, setPurchaseType] = useState<'first' | 'return' | 'late' | 'duplicate' | 'refund'>(
    'first',
  );
  const [customer, setCustomer] = useState('alex');
  const [amount, setAmount] = useState('48');
  const [firstRate, setFirstRate] = useState('2');
  const [repeatRate, setRepeatRate] = useState('5');
  const [budget, setBudget] = useState('2500');
  const [selected, setSelected] = useState<DemoReceipt | null>(null);
  const [toast, setToast] = useState('');
  const [sequence, setSequence] = useState(1);
  const m = useMemo(() => metrics(state), [state]);
  const history = state.orders.filter((o) => o.status === 'DELIVERED' || o.status === 'REFUNDED');
  const customerHistory = history.filter((o) => o.customerId === customer);
  const customerValue = customerHistory.reduce((a, o) => a + o.rewardCents, 0);
  const customerStock = customerHistory.reduce((a, o) => a + o.stockUnits, 0);
  const ratio = Math.min(100, m.budgetCents ? (m.spentCents / m.budgetCents) * 100 : 0);
  const demoNow = new Date(state.now).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  function notice(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 4200);
  }
  function openSim(type: 'first' | 'return' | 'late' | 'duplicate' | 'refund' = 'first') {
    setPurchaseType(type);
    setAmount('48');
    setModal(true);
  }
  function run() {
    let working = state;
    const cid = customer.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const ord = `demo-order-${String(sequence).padStart(3, '0')}`;
    const value = Math.round(Number(amount) * 100);
    if (purchaseType === 'refund') {
      const target = working.orders.find((o) => o.customerId === cid && o.status === 'DELIVERED');
      if (!target) {
        notice('Choose a customer with a delivered purchase.');
        return;
      }
      const result = refundPurchase(working, target.orderId);
      setState(result.next);
      setModal(false);
      notice(result.message);
      return;
    }
    if (purchaseType === 'return' || purchaseType === 'late') {
      if (
        !working.orders.some((o) => o.customerId === cid && o.status === 'DELIVERED' && o.kind === 'FIRST')
      ) {
        notice(
          'No first purchase: the comeback will be blocked. Use First purchase to establish eligibility.',
        );
      }
    }
    if (purchaseType === 'late') {
      const original = working.orders.find(
        (o) => o.customerId === cid && o.kind === 'FIRST' && o.status === 'DELIVERED',
      );
      if (original) {
        working = { ...working, now: original.timestamp + 9 * DAY_MS };
      }
    }
    const old = working.orders.find((o) => o.customerId === cid && o.status === 'DELIVERED');
    const orderId = purchaseType === 'duplicate' && old ? old.orderId : ord;
    const result = evaluatePurchase(working, {
      customerId: cid,
      orderId,
      orderCents: value,
      timestamp: working.now,
      attemptKind: purchaseType === 'first' ? 'FIRST' : 'COMEBACK',
    });
    const event = result.receipt;
    setState(result.next);
    setSequence((n) => n + 1);
    setModal(false);
    setSelected(event);
    setView('proof');
    notice(
      event.status === 'DELIVERED'
        ? 'Mock stock reward delivered — inspect the audit journey.'
        : 'Payout blocked — policy rule enforced.',
    );
  }
  function preset() {
    let next: DemoState = { ...startState, orders: [], spentCents: 0, now: initialDemoState.now };
    const a = evaluatePurchase(next, {
      customerId: 'alex',
      orderId: 'demo-order-001',
      orderCents: 4800,
      timestamp: next.now - 2 * DAY_MS,
    });
    const b = evaluatePurchase(a.next, {
      customerId: 'alex',
      orderId: 'demo-order-002',
      orderCents: 4800,
      timestamp: next.now,
    });
    next = b.next;
    setState(next);
    setSequence(3);
    setCustomer('alex');
    setSelected(b.receipt);
    setView('proof');
    notice('Judge journey loaded: two verified mock stock payouts.');
  }
  function saveRules() {
    const f = Number(firstRate),
      r = Number(repeatRate),
      b = Number(budget);
    if (
      !Number.isFinite(f) ||
      !Number.isFinite(r) ||
      !Number.isFinite(b) ||
      f <= 0 ||
      r < f ||
      r > 100 ||
      b * 100 < m.spentCents ||
      b > 1000000
    ) {
      notice('Invalid rules. Repeat rate must be ≥ first rate; budget must cover spent amount.');
      return;
    }
    setState((s) => ({
      ...s,
      firstBps: Math.round(f * 100),
      repeatBps: Math.round(r * 100),
      budgetCents: Math.round(b * 100),
    }));
    notice('Updated demo rules. No onchain transaction was made.');
  }
  const nav = [
    { key: 'overview' as View, label: 'Overview', icon: Home },
    { key: 'campaigns' as View, label: 'Campaigns', icon: Gift },
    { key: 'wallet' as View, label: 'Customer Wallet', icon: Wallet },
    { key: 'activity' as View, label: 'Activity Ledger', icon: ReceiptText },
    { key: 'proof' as View, label: 'Proof Journey', icon: ShieldCheck },
  ];
  const recent = state.orders.length ? state.orders : [];
  const stats = [
    {
      label: 'Merchant reward spend',
      value: dollars(m.spentCents),
      hint: 'Mock rewards, including baseline',
      icon: CircleDollarSign,
    },
    {
      label: 'Returning customers',
      value: String(m.returningCustomers),
      hint: 'Unique customers only',
      icon: Users,
    },
    { label: 'Rewards delivered', value: String(m.delivered), hint: 'Mock stock settlements', icon: Gift },
    {
      label: 'Observed repeat rate',
      value: (m.repeatRate * 100).toFixed(1) + '%',
      hint: 'Descriptive, not causal lift',
      icon: TrendingUp,
    },
  ];
  const receiptRow = (o: DemoReceipt) => (
    <button
      key={o.id}
      className="row-receipt clickable"
      style={{
        width: '100%',
        textAlign: 'left',
        borderLeft: 0,
        borderRight: 0,
        borderBottom: 0,
        background: 'transparent',
        cursor: 'pointer',
      }}
      onClick={() => {
        setSelected(o);
        setView('proof');
      }}
    >
      <div className={'receipt-icon ' + (o.kind === 'COMEBACK' ? 'return' : '')}>
        {o.status === 'BLOCKED' ? (
          <XCircle size={19} />
        ) : o.kind === 'COMEBACK' ? (
          <TrendingUp size={19} />
        ) : (
          <Gift size={19} />
        )}
      </div>
      <div className="receipt-main">
        <strong>
          {o.status === 'BLOCKED'
            ? 'Payout rejected'
            : o.kind === 'COMEBACK'
              ? 'Comeback bonus delivered'
              : 'First-purchase reward delivered'}
        </strong>
        <span>
          {o.customerId} · {o.orderId} · simulated
        </span>
      </div>
      <div className="receipt-amount">
        {o.status === 'BLOCKED' ? '$0.00' : '+' + dollars(o.rewardCents)}
        <span style={{ color: o.status === 'BLOCKED' ? '#c27c3f' : '#679b3b' }}>
          {o.status === 'BLOCKED'
            ? 'Policy blocked'
            : o.status === 'REFUNDED'
              ? 'Refund exception'
              : 'Demo settled'}
        </span>
      </div>
    </button>
  );
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link href="/" className="nav-logo">
          <div className="logo-square">↗</div>OWNBACK<span style={{ color: '#a1a8b3' }}>.</span>
        </Link>
        <div className="shop">
          <div className="shop-avatar">
            <Coffee size={19} />
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9 }}>
              DEMO WORKSPACE
            </div>
            <strong style={{ fontSize: 12 }}>Northstar Coffee</strong>
          </div>
        </div>
        <nav>
          <div className="menu-label">WORKSPACE</div>
          <div className="side-menu">
            {nav.map((i) => (
              <button
                key={i.key}
                className={'navbtn ' + (view === i.key ? 'selected' : '')}
                onClick={() => setView(i.key)}
              >
                <i.icon size={18} />
                {i.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="pill green">
            <span className="led" /> INTERACTIVE TESTNET DEMO
          </div>
          <p className="note">
            No real stocks, wallets or payments. The prototype runs locally in your browser.
          </p>
          <button
            className="btn small"
            style={{ marginTop: 9 }}
            onClick={() => {
              setState(startState);
              setSequence(1);
              setSelected(null);
              notice('Demo state reset.');
            }}
          >
            <RotateCcw size={13} /> Reset demo
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13, fontWeight: 850 }}>
            <span style={{ color: '#a3acb9' }}>Workspace</span>
            <ChevronRight size={15} color="#c5cbd4" />
            {nav.find((n) => n.key === view)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="pill green">
              <span className="led" /> Base Sepolia Preview
            </span>
            <span
              style={{
                background: '#eae0ff',
                color: '#7359b3',
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: 11,
              }}
            >
              NC
            </span>
          </div>
        </div>
        <div className="page">
          <div className="banner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={15} /> Demo-only figures and proof steps. This interface does not send real
            transactions or securities.
          </div>
          {view === 'overview' && (
            <>
              <div className="header">
                <div>
                  <h1>
                    Good morning, Northstar <span style={{ fontSize: 23 }}>✦</span>
                  </h1>
                  <p>Your stock-back campaign is ready to demonstrate.</p>
                </div>
                <button className="btn dark" onClick={() => openSim('first')}>
                  <Plus size={16} /> Simulate purchase
                </button>
              </div>
              <div className="hero">
                <div style={{ zIndex: 2 }}>
                  <div className="eyebrow">STOCK-BACK CHECKOUT SIMULATOR</div>
                  <h2>
                    Every checkout is a chance to <em>come back.</em>
                  </h2>
                  <p>
                    Reward first purchases with stock exposure, incentivize second purchases, and show exactly
                    where merchant rewards went.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn lime" onClick={preset}>
                      <Zap size={16} /> Run judge journey
                    </button>
                    <button
                      className="btn"
                      style={{ background: '#283b4b', color: 'white', border: '1px solid #4c5b69' }}
                      onClick={() => setView('campaigns')}
                    >
                      Manage campaign <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="hero-graphic">
                  <div className="orbits">
                    <div className="orbit-core">↗</div>
                  </div>
                  <div className="floatcard fc1">
                    <strong>✓ Purchase verified</strong>
                    <small>$48.00 checkout · mock</small>
                  </div>
                  <div className="floatcard fc2">
                    <strong>↗ Customer returned</strong>
                    <small>5% reward unlocked</small>
                  </div>
                  <div className="floatcard fc3">
                    <strong>+$2.40 stock-back</strong>
                    <small>Mock token allocation</small>
                  </div>
                </div>
              </div>
              <div className="stat-grid">
                {stats.map((x) => (
                  <div className="card stat" key={x.label}>
                    <div className="stat-head">
                      <span className="label">{x.label}</span>
                      <span className="stat-icon">
                        <x.icon size={16} />
                      </span>
                    </div>
                    <div className="stat-value">{x.value}</div>
                    <footer>{x.hint}</footer>
                  </div>
                ))}
              </div>
              <div className="two-col">
                <div className="card">
                  <div className="section-head">
                    <div>
                      <h3>Reward activity</h3>
                      <p>Illustrative baseline + live demo additions</p>
                    </div>
                    <div className="pill green">Last 7 days</div>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData.map((d, i) => ({
                          ...d,
                          value: d.value + (i === 6 ? state.spentCents / 100 : 0),
                        }))}
                      >
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6c7be9" stopOpacity={0.24} />
                            <stop offset="95%" stopColor="#6c7be9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#eef0f4" strokeDasharray="3 4" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: '#9fa8b4' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v) => [dollars(Math.round(Number(v) * 100)), 'Demo reward volume']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#6071eb"
                          strokeWidth={3}
                          fill="url(#areaGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <div className="section-head">
                    <h3>The Comeback Club</h3>
                    <div className={'pill ' + (state.paused ? 'orange' : 'green')}>
                      {state.paused ? 'Paused' : '● Active'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ background: '#eafad4', padding: 12, borderRadius: 13, color: '#628d27' }}>
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 13 }}>Smart stock-back campaign</strong>
                      <p className="note" style={{ margin: 0 }}>
                        7-day return window · $10 max reward
                      </p>
                    </div>
                  </div>
                  <div className="rate-box">
                    <div>
                      <span className="label">FIRST PURCHASE</span>
                      <strong>{state.firstBps / 100}%</strong>
                    </div>
                    <ArrowRight color="#aab4bf" />
                    <div style={{ textAlign: 'right' }}>
                      <span className="label">COMEBACK BONUS</span>
                      <strong style={{ color: '#5565df' }}>{state.repeatBps / 100}%</strong>
                    </div>
                  </div>
                  <div className="progress-head">
                    <span>Vault utilization</span>
                    <span>
                      {dollars(m.spentCents)} / {dollars(m.budgetCents)}
                    </span>
                  </div>
                  <div className="barbg">
                    <div className="barfill" style={{ width: ratio + '%' }} />
                  </div>
                  <button
                    className="btn"
                    style={{ width: '100%', marginTop: 19 }}
                    onClick={() => setView('campaigns')}
                  >
                    Configure campaign <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="card">
                <div className="section-head">
                  <h3>Latest verified outcomes</h3>
                  <button className="btn small" onClick={() => setView('activity')}>
                    View all <ArrowUpRight size={14} />
                  </button>
                </div>
                {recent.length ? (
                  recent.slice(0, 4).map(receiptRow)
                ) : (
                  <div className="empty">
                    No new demo transactions. Run the judge journey to generate verifiable outcomes.
                  </div>
                )}
              </div>
            </>
          )}
          {view === 'campaigns' && (
            <>
              <div className="header">
                <div>
                  <div className="eyebrow">MERCHANT OPERATIONS</div>
                  <h1>The Comeback Club</h1>
                  <p>Design a return-purchase incentive with real policy boundaries.</p>
                </div>
                <div className={'pill ' + (state.paused ? 'orange' : 'green')}>
                  {state.paused ? 'Ⅱ Paused' : '● Campaign active'}
                </div>
              </div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="section-head">
                  <div>
                    <h3>Your campaign vault</h3>
                    <p>Demo ledger values · No USDC actually deposited</p>
                  </div>
                  <span style={{ background: '#eafad6', borderRadius: 12, padding: 12, color: '#5e8729' }}>
                    <ShieldCheck size={22} />
                  </span>
                </div>
                <div
                  className="stat-grid"
                  style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', margin: '6px 0 22px' }}
                >
                  <div className="card" style={{ background: '#f8f9fc', boxShadow: 'none' }}>
                    <span className="label">Campaign budget</span>
                    <div className="stat-value">{dollars(m.budgetCents)}</div>
                  </div>
                  <div className="card" style={{ background: '#f8f9fc', boxShadow: 'none' }}>
                    <span className="label">Simulated spent</span>
                    <div className="stat-value">{dollars(m.spentCents)}</div>
                  </div>
                  <div className="card" style={{ background: '#f8f9fc', boxShadow: 'none' }}>
                    <span className="label">Demo available</span>
                    <div className="stat-value">{dollars(m.remainingCents)}</div>
                  </div>
                </div>
                <div className="progress-head">
                  <span>Budget utilized</span>
                  <span>{ratio.toFixed(1)}%</span>
                </div>
                <div className="barbg">
                  <div className="barfill" style={{ width: ratio + '%' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                  <button className="btn primary" onClick={() => openSim('first')}>
                    <Plus size={15} /> First purchase
                  </button>
                  <button className="btn" onClick={() => openSim('return')}>
                    <RefreshCw size={15} /> Comeback
                  </button>
                  <button className="btn" onClick={() => setState((s) => ({ ...s, paused: !s.paused }))}>
                    {state.paused ? <Play size={15} /> : <Pause size={15} />}{' '}
                    {state.paused ? 'Resume' : 'Pause'}
                  </button>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="section-head">
                  <div>
                    <h3>Reward policy</h3>
                    <p>Editable demo parameters. Production changes require wallet confirmation.</p>
                  </div>
                  <span className="pill green">Programmable</span>
                </div>
                <div className="form-grid">
                  <label className="field">
                    First purchase (%)
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      value={firstRate}
                      onChange={(e) => setFirstRate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Comeback purchase (%)
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      value={repeatRate}
                      onChange={(e) => setRepeatRate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Total mock USDC budget
                    <input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn dark" onClick={saveRules}>
                    Save demo rules
                  </button>
                  <span className="note">7-day comeback · one bonus per customer · $10 per-order cap</span>
                </div>
              </div>
              <div className="card">
                <div className="section-head">
                  <h3>Test risk controls</h3>
                  <span className="pill orange">Fraud & edge cases</span>
                </div>
                <div className="step-list">
                  <div className="step">
                    <div className="step-icon">
                      <LockKeyhole size={15} />
                    </div>
                    <div>
                      <strong>Duplicate order replay protection</strong>
                      <p>
                        An existing order ID cannot receive another reward.{' '}
                        <button
                          style={{
                            color: '#5268e0',
                            background: 'none',
                            border: 0,
                            fontWeight: 800,
                            padding: 0,
                          }}
                          onClick={() => openSim('duplicate')}
                        >
                          Test rejection ↗
                        </button>
                      </p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-icon">
                      <Clock3 size={15} />
                    </div>
                    <div>
                      <strong>Seven-day comeback eligibility</strong>
                      <p>
                        A second purchase after the window is rejected.{' '}
                        <button
                          style={{
                            color: '#5268e0',
                            background: 'none',
                            border: 0,
                            fontWeight: 800,
                            padding: 0,
                          }}
                          onClick={() => openSim('late')}
                        >
                          Test expiry ↗
                        </button>
                      </p>
                    </div>
                  </div>
                  <div className="step">
                    <div className="step-icon">
                      <FileCheck2 size={15} />
                    </div>
                    <div>
                      <strong>Refund exception handling</strong>
                      <p>
                        Post-settlement refunds are flagged rather than misrepresented as reversible onchain
                        deliveries.{' '}
                        <button
                          style={{
                            color: '#5268e0',
                            background: 'none',
                            border: 0,
                            fontWeight: 800,
                            padding: 0,
                          }}
                          onClick={() => openSim('refund')}
                        >
                          Test refund ↗
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {view === 'wallet' && (
            <>
              <div className="header">
                <div>
                  <div className="eyebrow">CUSTOMER EXPERIENCE</div>
                  <h1>My stock rewards</h1>
                  <p>Shop. Return. Grow your simulated stock reward collection.</p>
                </div>
                <button className="btn" onClick={() => openSim('return')}>
                  <Gift size={16} /> Earn mock stock
                </button>
              </div>
              <div className="portfolio">
                <div className="eyebrow" style={{ color: '#b7c6d6' }}>
                  DEMO STOCK REWARD VALUE
                </div>
                <div className="value">{dollars(customerValue)}</div>
                <p>Based on a fixed mock $100 per mB20 token; not an investment quote</p>
                <div className="portfolio-card">
                  <div style={{ color: '#b2c5d2', fontSize: 10 }}>SIMULATED HOLDINGS</div>
                  <strong style={{ fontSize: 19 }}>{stockTokens(customerStock)} mB20</strong>
                </div>
              </div>
              <div className="two-col">
                <div className="card">
                  <div className="section-head">
                    <h3>Your holdings</h3>
                    <span className="pill green">Demo token</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 0' }}>
                    <div
                      style={{
                        background: '#e8ecff',
                        borderRadius: 13,
                        padding: 15,
                        color: '#5365dd',
                        fontWeight: 900,
                      }}
                    >
                      B20
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong>mB20 · Mock stock basket</strong>
                      <p className="note" style={{ margin: '3px 0 0' }}>
                        No real underlying equity; Base Sepolia demo
                      </p>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 19 }}>{dollars(customerValue)}</div>
                  </div>
                  <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 12 }}>
                    <div className="eyebrow">CUSTOMER IDENTITY</div>
                    <select
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
                      style={{
                        marginTop: 8,
                        width: '100%',
                        padding: 10,
                        borderRadius: 9,
                        border: '1px solid #dee5ed',
                      }}
                    >
                      <option value="alex">alex</option>
                      <option value="jordan">jordan</option>
                      <option value="casey">casey</option>
                    </select>
                    <p className="note" style={{ margin: '10px 0 0' }}>
                      Each demo customer maintains an independent reward history and comeback eligibility.
                    </p>
                  </div>
                </div>
                <div className="card">
                  <div className="section-head">
                    <h3>How stock rewards unlock</h3>
                    <span className="pill green">3-step journey</span>
                  </div>
                  <div className="step-list">
                    <div className="step">
                      <div className="step-icon">01</div>
                      <div>
                        <strong>Shop a participating merchant</strong>
                        <p>
                          A first eligible purchase qualifies for {state.firstBps / 100}% mock stock-back.
                        </p>
                      </div>
                    </div>
                    <div className="step">
                      <div className="step-icon">02</div>
                      <div>
                        <strong>Verify your reward</strong>
                        <p>Only confirmed delivery appears in your stock wallet.</p>
                      </div>
                    </div>
                    <div className="step">
                      <div className="step-icon">03</div>
                      <div>
                        <strong>Return within 7 days</strong>
                        <p>Earn {state.repeatBps / 100}% on your comeback, up to the configured cap.</p>
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn primary"
                    style={{ width: '100%', marginTop: 23 }}
                    onClick={() => openSim('first')}
                  >
                    Simulate a purchase <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              <div className="card">
                <div className="section-head">
                  <h3>Confirmed demo allocations</h3>
                  <span className="note">Customer: {customer}</span>
                </div>
                {customerHistory.length ? (
                  customerHistory.map(receiptRow)
                ) : (
                  <div className="empty">
                    This customer has no confirmed demo reward. Run a first purchase.
                  </div>
                )}
              </div>
            </>
          )}
          {view === 'activity' && (
            <>
              <div className="header">
                <div>
                  <div className="eyebrow">TRANSACTION MONITOR</div>
                  <h1>Reward ledger</h1>
                  <p>Understand the difference between valid payouts and policy rejections.</p>
                </div>
                <button className="btn dark" onClick={() => openSim('first')}>
                  <Plus size={15} /> New test
                </button>
              </div>
              <div className="stat-grid">
                {stats.map((x) => (
                  <div className="card stat" key={x.label}>
                    <div className="label">{x.label}</div>
                    <div className="stat-value">{x.value}</div>
                    <footer>{x.hint}</footer>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="section-head">
                  <h3>Recent transaction attempts</h3>
                  <span className="pill orange">Mock receipt registry</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th className="hide-mobile">Stock units</th>
                        <th>Reward</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <strong>{o.orderId}</strong>
                          </td>
                          <td>
                            <CustomerLabel id={o.customerId} />
                          </td>
                          <td>{o.kind === 'FIRST' ? 'First' : 'Comeback'}</td>
                          <td>
                            <span
                              className={
                                'chip ' +
                                (o.status === 'BLOCKED' ? 'block' : o.status === 'REFUNDED' ? 'refund' : '')
                              }
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="hide-mobile">{stockTokens(o.stockUnits)}</td>
                          <td>{dollars(o.rewardCents)}</td>
                          <td>
                            <button
                              className="btn small"
                              onClick={() => {
                                setSelected(o);
                                setView('proof');
                              }}
                            >
                              Inspect <ArrowUpRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!state.orders.length && (
                    <div className="empty">
                      There are no attempted transactions yet. Start a test purchase.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {view === 'proof' && (
            <>
              <div className="header">
                <div>
                  <div className="eyebrow">JUDGE-READY EVIDENCE</div>
                  <h1>Proof of reward journey</h1>
                  <p>Every demo reward has traceable preconditions and an explicit outcome.</p>
                </div>
                <button className="btn lime" onClick={preset}>
                  <Zap size={15} /> Run complete journey
                </button>
              </div>
              {selected ? (
                <>
                  <div className="card" style={{ marginBottom: 18 }}>
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                    >
                      <div>
                        <span className="eyebrow">DEMO SETTLEMENT RECEIPT</span>
                        <h2 style={{ fontSize: 26, letterSpacing: '-1px', margin: '8px 0 3px' }}>
                          {selected.orderId}
                        </h2>
                        <p className="muted" style={{ fontSize: 12 }}>
                          Customer: {selected.customerId} · {new Date(selected.timestamp).toUTCString()}
                        </p>
                      </div>
                      <span className={'pill ' + (selected.status === 'BLOCKED' ? 'orange' : 'green')}>
                        {selected.status === 'BLOCKED' ? <XCircle size={13} /> : <CheckCircle2 size={13} />}{' '}
                        {selected.status === 'BLOCKED'
                          ? 'POLICY BLOCKED'
                          : selected.status === 'REFUNDED'
                            ? 'REFUND EXCEPTION'
                            : 'MOCK DELIVERY CONFIRMED'}
                      </span>
                    </div>
                    <div className="receipt-journey">
                      {selected.steps.map((s, i) => (
                        <div
                          className={
                            'journey-step ' +
                            (selected.status === 'BLOCKED' && i === selected.steps.length - 1
                              ? 'blocked'
                              : '')
                          }
                          key={i}
                        >
                          <div style={{ marginBottom: 8 }}>
                            {selected.status === 'BLOCKED' && i === selected.steps.length - 1 ? (
                              <XCircle size={19} style={{ margin: 'auto' }} />
                            ) : (
                              <CheckCircle2 size={19} style={{ margin: 'auto' }} />
                            )}
                          </div>
                          {s}
                        </div>
                      ))}
                    </div>
                    <div
                      className="stat-grid"
                      style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 0 }}
                    >
                      <div className="card" style={{ background: '#f9fafc' }}>
                        <span className="label">Order value</span>
                        <div className="stat-value">{dollars(selected.orderCents)}</div>
                      </div>
                      <div className="card" style={{ background: '#f9fafc' }}>
                        <span className="label">Reward value</span>
                        <div className="stat-value">{dollars(selected.rewardCents)}</div>
                      </div>
                      <div className="card" style={{ background: '#f9fafc' }}>
                        <span className="label">Mock stock issued</span>
                        <div className="stat-value" style={{ fontSize: 23 }}>
                          {stockTokens(selected.stockUnits)}
                        </div>
                      </div>
                    </div>
                    {selected.reason && (
                      <div className="banner" style={{ margin: '15px 0 0', background: '#fff1e6' }}>
                        Reason: {selected.reason}
                      </div>
                    )}
                    <p className="note" style={{ margin: '19px 0 0' }}>
                      Mock asset valuation: 1 mB20 = {dollars(MOCK_STOCK_PRICE_CENTS)}. The proof timeline is
                      simulated and intentionally contains no invented blockchain transaction hash.
                    </p>
                  </div>
                  <div className="two-col">
                    <div className="card">
                      <h3>Test an attack</h3>
                      <div className="step-list" style={{ marginTop: 17 }}>
                        <button className="btn" onClick={() => openSim('duplicate')}>
                          <LockKeyhole size={15} /> Replay same order ID
                        </button>
                        <button className="btn" onClick={() => openSim('late')}>
                          <Clock3 size={15} /> Attempt late comeback
                        </button>
                        <button className="btn" onClick={() => openSim('return')}>
                          <RefreshCw size={15} /> Attempt another comeback
                        </button>
                      </div>
                    </div>
                    <div className="card">
                      <h3>What is verified in production?</h3>
                      <div className="step-list" style={{ marginTop: 17 }}>
                        <div className="step">
                          <div className="step-icon">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <strong>Shopify HMAC and order recheck</strong>
                            <p>Server authenticates events, then checks the latest order status.</p>
                          </div>
                        </div>
                        <div className="step">
                          <div className="step-icon">
                            <Wallet size={16} />
                          </div>
                          <div>
                            <strong>Wallet claim and securities gate</strong>
                            <p>Only eligible recipients can receive real tokenized stock.</p>
                          </div>
                        </div>
                        <div className="step">
                          <div className="step-icon">
                            <BadgeCheck size={16} />
                          </div>
                          <div>
                            <strong>Onchain receipt or no delivery claim</strong>
                            <p>Production UI displays stock delivery only after the chain confirms it.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card" style={{ padding: 35, textAlign: 'center' }}>
                  <ShieldCheck size={42} color="#7482e9" style={{ margin: 'auto' }} />
                  <h3 style={{ fontSize: 22, margin: '15px 0' }}>Your demonstration can prove every step.</h3>
                  <p className="muted">
                    Load the complete first-purchase → comeback journey, or test blocked payouts to see policy
                    enforcement.
                  </p>
                  <button className="btn primary" style={{ marginTop: 14 }} onClick={preset}>
                    <Zap size={15} /> Start judge journey
                  </button>
                </div>
              )}
            </>
          )}
          <p className="note" style={{ marginTop: 24 }}>
            Demo virtual time: {demoNow} UTC. Base Sepolia mock stock, not real equity. Repeat rate measures
            observed customers rather than an experiment-controlled uplift.
          </p>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <div className="modal">
            <div className="section-head">
              <div>
                <div className="eyebrow">OWNBACK TEST HARNESS</div>
                <h2 style={{ fontSize: 25 }}>Simulate an order</h2>
                <p>Validate the loyalty rules without sending funds.</p>
              </div>
              <button className="btn small" aria-label="Close" onClick={() => setModal(false)}>
                <X size={17} />
              </button>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Customer
                <select value={customer} onChange={(e) => setCustomer(e.target.value)}>
                  <option value="alex">Alex</option>
                  <option value="jordan">Jordan</option>
                  <option value="casey">Casey</option>
                </select>
              </label>
              <label className="field">
                Scenario
                <select
                  value={purchaseType}
                  onChange={(e) => setPurchaseType(e.target.value as typeof purchaseType)}
                >
                  <option value="first">First / next purchase</option>
                  <option value="return">Comeback</option>
                  <option value="late">Comeback after 9 days</option>
                  <option value="duplicate">Duplicate order</option>
                  <option value="refund">Post-payout refund</option>
                </select>
              </label>
            </div>
            {purchaseType !== 'refund' && (
              <label className="field">
                Order value (USD)
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            )}
            <div
              style={{
                background: '#f1f8e7',
                borderRadius: 13,
                padding: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: '19px 0',
              }}
            >
              <div>
                <div className="eyebrow">REWARD IF ELIGIBLE</div>
                <span className="note">Up to $10 · eligibility checked on execution</span>
              </div>
              <strong style={{ fontSize: 27 }}>
                {purchaseType === 'refund'
                  ? '—'
                  : dollars(
                      Math.min(
                        1000,
                        Math.floor(
                          (Math.max(0, Number(amount) * 100) *
                            (purchaseType === 'first' ? state.firstBps : state.repeatBps)) /
                            10000,
                        ),
                      ),
                    )}
              </strong>
            </div>
            <button className="btn primary" style={{ width: '100%', padding: 15 }} onClick={run}>
              <Check size={16} /> Run simulation & inspect result
            </button>
            <p className="note" style={{ textAlign: 'center', margin: '15px 0 0' }}>
              No real charge, securities trade, or blockchain transaction.
            </p>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
