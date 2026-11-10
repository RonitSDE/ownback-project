import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, Check, CircleDollarSign,
  LockKeyhole, Repeat2, ShieldCheck, ShoppingBag, Sparkles, Wallet, ExternalLink, TrendingUp } from 'lucide-react';
import './retention.css';

const features=[
 {number:'01',icon:Repeat2,title:'The comeback Loop',description:'First purchase creates the relationship. A better second-purchase reward gives customers a reason to return.'},
 {number:'02',icon:ChartNoAxesCombined,title:'Proof of Retention',description:'Show observed repeat behavior, reward spending and contribution. Add a valid holdout before claiming lift.'},
 {number:'03',icon:ShieldCheck,title:'Protected by finality',description:'Reserve the budget, wait through refund holds, verify delivery. Never call an unsettled reward ownership.'},
 {number:'04',icon:Wallet,title:'An ownership portfolio',description:'One clear view of pending and settled stock-linked rewards—not another points game.'},
 ];
const gallery=[
 {src:'/visuals/audio.webp',label:'A little more sound',sub:'Electronics'},
 {src:'/visuals/sneakers.webp',label:'Something worth moving for',sub:'Style'},
 {src:'/visuals/skincare.webp',label:'An everyday ritual',sub:'Beauty'},
 {src:'/visuals/coffee.webp',label:'Your daily favorite',sub:'Lifestyle'},
 ];
export default function Home(){return <main className="v37-shell" id="main">
  <div className="v37-topline"><span><span className="v37-signal"/> THE OWNERSHIP RETENTION PROTOCOL</span><span>Built on Base · Sepolia pilot</span></div>
  <header className="v37-nav v37-width">
   <Link href="/" className="v37-logo"><span>↗</span> OWNBACK<b>.</b></Link>
   <nav aria-label="Primary navigation"><Link href="/agentic">Discover</Link><Link href="/ownership">My ownership</Link><Link href="/growth">Merchant growth</Link><Link href="/protocol">How it works</Link></nav>
   <Link href="/growth" className="v37-nav-cta">Explore the Loop <ArrowUpRight size={15}/></Link>
  </header>
  <section className="v37-width v37-hero">
   <div className="v37-hero-copy">
    <div className="v37-kicker"><span className="v37-kicker-line"/> COMMERCE THAT COMPOUNDS</div>
    <h1>Shop as usual.<br/>Come back for <em>more.</em></h1>
    <p>Every purchase can mean something more. Merchants grow repeat business with measurable, protected stock-linked rewards. Customers build toward ownership, one everyday purchase at a time.</p>
    <div className="v37-hero-actions"><Link className="v37-button v37-button-dark" href="/agentic">Explore shopping <ArrowRight size={17}/></Link><Link className="v37-button v37-button-plain" href="/growth">See merchant economics <ArrowUpRight size={15}/></Link></div>
    <Link href="/preview/v3.7.html" className="v37-text-link" style={{marginBottom:22}}>Explore the full interactive concept (simulated) <ArrowUpRight size={15}/></Link>
    <div className="v37-trust"><span><ShieldCheck size={15}/> Verified purchases</span><span><LockKeyhole size={15}/> Refund-aware rewards</span><span><BadgeCheck size={15}/> Onchain evidence</span></div>
   </div>
   <div className="v37-hero-stage"><div className="v37-stage-label"><span>EVERYDAY PURCHASES</span><span>→</span><strong>OWNERSHIP POTENTIAL</strong></div>
    <Image src="/visuals/product-world.webp" alt="Illustrative premium products including headphones, shoes, skincare and coffee equipment" width={1010} height={266} priority className="v37-stage-image"/>
    <div className="v37-stage-receipt"><span className="v37-receipt-eyebrow">EXAMPLE · FIRST PURCHASE</span><div className="v37-receipt-line"><strong>Store purchase</strong><span>$50.00</span></div><div className="v37-receipt-line"><span>Illustrative 2% reward</span><strong className="v37-ink-blue">+$1.00</strong></div><div className="v37-receipt-footer"><span className="v37-mini-dot"/> Reserved · not yet delivered</div></div>
    <div className="v37-stage-foot">Illustrative products and rewards, not live offers or equities</div>
   </div>
  </section>
  <section className="v37-width v37-section v37-four"><div className="v37-section-intro"><div className="v37-kicker">WHY OWNBACK</div><h2>A better reason to return.</h2><p>Not more loyalty points. A practical growth instrument that both sides can understand.</p></div><div className="v37-feature-grid">{features.map(f=><article className="v37-feature" key={f.number}><div className="v37-feature-top"><f.icon size={22}/><span>{f.number}</span></div><h3>{f.title}</h3><p>{f.description}</p></article>)}</div></section>
  <section className="v37-width v37-section v37-split"><div className="v37-story-image"><div className="v37-story-label">THE OWNERSHIP LOOP</div><div className="v37-loop-visual"><div><ShoppingBag size={21}/><span>Purchase</span><strong>$50</strong></div><ArrowRight/><div><CircleDollarSign size={21}/><span>Merchant-funded</span><strong>2%</strong></div><ArrowRight/><div><Repeat2 size={21}/><span>Comeback</span><strong>5%</strong></div></div><div className="v37-story-bottom"><div><span>01</span> First purchase</div><div><span>02</span> Reward reserved</div><div><span>03</span> Return & earn</div></div></div><div className="v37-story-copy"><div className="v37-kicker">BUILT FOR MERCHANTS</div><h2>Growth should be <em>measurable.</em></h2><p>Track the purchases that matter, compare a properly assigned control when available, and model whether the margin from returning buyers outweighs reward costs.</p><div className="v37-checks"><span><Check size={15}/> Gross margin and break-even calculator</span><span><Check size={15}/> Verified orders and reward finality</span><span><Check size={15}/> No invented retention-lift claims</span></div><Link className="v37-text-link" href="/growth">Open Merchant Growth Studio <ArrowUpRight size={17}/></Link></div></section>
  <section className="v37-section v37-gallery-outer"><div className="v37-width"><div className="v37-gallery-head"><div><div className="v37-kicker">MADE FOR EVERYDAY LIFE</div><h2>Good things. More meaning.</h2><p>Shop from connected merchants, then follow your eligible rewards from reservation to verified delivery.</p></div><Link className="v37-text-link" href="/agentic">Explore discovery <ArrowRight size={17}/></Link></div><div className="v37-gallery">{gallery.map(g=><div className="v37-gallery-card" key={g.src}><div className="v37-gallery-photo"><Image src={g.src} width={720} height={620} alt={`Illustrative ${g.sub.toLowerCase()} product imagery`} loading="lazy"/></div><div className="v37-gallery-info"><span>{g.sub}</span><h3>{g.label}</h3></div></div>)}</div><div className="v37-gallery-caption">Concept photography only. Live offers, stock eligibility, and final reward amounts are independently verified.</div></div></section>
  <section className="v37-width v37-section v37-ownership-promo"><div><div className="v37-kicker">FOR THE CUSTOMER</div><h2>Your purchases,<br/><em>all in one place.</em></h2><p>A simple wallet for the rewards you earn across OWNBACK purchases. See what is reserved, what is pending, and what has really settled—without confusing a claim with a security.</p><Link className="v37-button v37-button-dark" href="/ownership">Open my ownership <ArrowRight size={16}/></Link></div><div className="v37-wallet-preview"><div className="v37-wallet-top"><span>↗ YOUR OWNERSHIP</span><span className="v37-tag">BASE SEPOLIA</span></div><h3>Every reward has a status.</h3><div className="v37-wallet-preview-row"><span className="v37-state-icon"><LockKeyhole size={17}/></span><div><strong>Reward reserved</strong><small>Merchant budget protected</small></div><span>01</span></div><div className="v37-wallet-preview-row"><span className="v37-state-icon"><TrendingUp size={17}/></span><div><strong>Ready for settlement</strong><small>Eligibility & refund checks complete</small></div><span>02</span></div><div className="v37-wallet-preview-row"><span className="v37-state-icon"><BadgeCheck size={17}/></span><div><strong>Delivery confirmed</strong><small>Verified onchain receipt</small></div><span>03</span></div><div className="v37-wallet-warning">No testnet mock stock is represented as real equity.</div></div></section>
  <section className="v37-width v37-final-cta"><div><span>BUILDING ON BASE</span><h2>Make the second purchase<br/>worth more than the first.</h2><p>One retention Loop. Honest economics. Programmable stock-linked rewards.</p></div><div><Link className="v37-button v37-button-white" href="/growth">Explore merchant ROI <ArrowUpRight size={17}/></Link><Link href="/protocol" className="v37-light-link">View protocol evidence <ExternalLink size={15}/></Link></div></section>
  <footer className="v37-width v37-footer"><Link href="/" className="v37-logo"><span>↗</span> OWNBACK<b>.</b></Link><p>Prototype · Base Sepolia · Mock stock has no securities value. No live tokenized equity issuance, trading or borrowing.</p><span>© 2026 OWNBACK</span></footer>
 </main>}
