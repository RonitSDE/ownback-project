import Link from 'next/link';
import { ArrowRight, Landmark, Receipt, Repeat, ShieldCheck } from 'lucide-react';

const PILLARS = [
  {
    icon: Receipt,
    title: 'The payment is the proof',
    body: 'No order feeds, no claim links, no trust-me webhooks. A USDC payment on Base triggers the reward, and the reward goes to the wallet that paid.',
  },
  {
    icon: Repeat,
    title: 'Comebacks pay more',
    body: '2% back on a first order, 5% on a return inside seven days. The reward is reserved from the merchant’s budget at checkout, so the promise holds.',
  },
  {
    icon: Landmark,
    title: 'Rewards that work',
    body: 'On mainnet the reward is a Coinbase tokenized stock. Morpho and Aave accept those as collateral for USDC, so a loyalty balance isn’t dead points.',
  },
];

const STEPS = [
  [
    'Merchant funds a campaign',
    'Sets the rates, a per-order cap and a refund hold, then deposits a USDC budget.',
  ],
  [
    'Customer pays in USDC',
    'The store gets paid in full instantly. The reward is reserved in the same transaction.',
  ],
  [
    'Reward settles as stock',
    'After the refund hold, the reward converts to tokenized stock in the customer’s wallet.',
  ],
  [
    'They come back',
    'A second order inside the window earns the higher rate. The stock position keeps growing.',
  ],
];

export default function Home() {
  return (
    <>
      <section className="simple-hero">
        <div className="container">
          <nav className="simple-nav">
            <div className="nav-logo">
              <div className="logo-square">↗</div>
              OWNBACK<span style={{ color: '#9dacb9' }}>.</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link className="btn" href="/merchant">
                Merchant
              </Link>
              <Link className="btn lime" href="/shop">
                Try the store <ArrowRight size={15} />
              </Link>
            </div>
          </nav>
          <div className="simple-body">
            <div className="pill dark">
              <span className="led" /> STOCK-BACK CHECKOUT ON BASE
            </div>
            <h1>
              Spend. Earn stock.
              <br />
              <em>Borrow on it.</em>
            </h1>
            <p>
              OWNBACK is a checkout that pays customers back in tokenized stock instead of points. More on the
              first order, more again when they come back, and a reward balance that can be used as
              collateral.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 33 }}>
              <Link href="/shop" className="btn lime" style={{ padding: '17px 24px' }}>
                Place a test order <ArrowRight size={18} />
              </Link>
              <Link href="/demo" className="btn" style={{ padding: '17px 24px' }}>
                Run the simulator
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container landing-section">
        <div className="grid cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div className="panel" key={title}>
              <Icon size={20} color="#5665ea" />
              <h2 style={{ marginTop: 12, fontSize: 17 }}>{title}</h2>
              <p className="sub" style={{ margin: 0 }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="container landing-section">
        <h2>How it works</h2>
        <ol className="steps" style={{ padding: 0, margin: 0 }}>
          {STEPS.map(([title, body]) => (
            <li key={title}>
              <strong>{title}</strong>
              {body}
            </li>
          ))}
        </ol>
      </section>

      <section className="container landing-section">
        <div className="panel dark">
          <ShieldCheck size={20} color="#c7f37d" />
          <h2 style={{ marginTop: 10, fontSize: 17 }}>What this build is, and isn&apos;t</h2>
          <p className="sub" style={{ margin: 0, maxWidth: 820 }}>
            This is a Base Sepolia testnet build. The stock reward is a mock token that mirrors the price and
            multiplier of a Coinbase tokenized stock, and it has no value. Tokenized stocks give price
            exposure, not shareholder rights. Coinbase tokenized stocks are available only to eligible persons
            outside the United States, and any mainnet launch needs the issuer&apos;s eligibility rules
            applied at delivery.
          </p>
        </div>
      </section>

      <footer className="container site-footer">
        <span>© 2026 OWNBACK · Built on Base</span>
        <span>Not an offer of securities. Testnet tokens have no value.</span>
      </footer>
    </>
  );
}
