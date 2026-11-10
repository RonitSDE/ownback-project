'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {toHex,formatUnits,type Hex} from 'viem';
import {ArrowRight,ArrowUpRight,BadgeCheck,Clock3,ExternalLink,Gift,LockKeyhole,RefreshCw,ShieldAlert,ShieldCheck,ShoppingBag,Wallet,WalletCards} from 'lucide-react';
import {useWallet} from '@/hooks/useWallet';
import {useShopData} from '@/hooks/useShopData';
import {isConfigured,txUrl} from '@/lib/config';
import {usd,stockUnits,shortAddress} from '@/lib/format';
import {rewardStage} from '@/lib/retention/economics';
import '../retention.css';

type ShopifyRow={shop_domain:string;order_id:string;order_label:string;paid_at:string;status:string;reward_kind:string|null;reward_usdc:string|null;tx_hash:string|null;stock_amount:string|null};
const fmt=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
function dataState(s:string){return rewardStage(s)}
function nativeState(n:number){return n===0?'reserved':n===1?'owned':n===3?'liability':'reversed'}
export default function Ownership(){
 const {account,provider,wrongNetwork}=useWallet();
 const {campaign,balances,price,purchases,refresh,error}=useShopData(account);
 const [shopify,setShopify]=useState<ShopifyRow[]|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{setShopify(null);setMessage('')},[account]);
 const native=useMemo(()=>purchases.map(row=>({
  id:`N-${row.id}`,name:`Base USDC order #${row.id}`,source:'Native USDC',kind:row.kind===2?'Comeback':row.kind===1?'First purchase':'No reward',
  status:nativeState(row.status),rawStatus:row.status,amount:row.reward>0n?usd(row.reward):'No reward',
  settled:row.status===1||row.status===3,tx:row.settleTx||null,date:row.paidAt?new Date(row.paidAt*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'
 })),[purchases]);
 const hybrid=useMemo(()=>shopify?.map(row=>({id:`S-${row.shop_domain}-${row.order_id}`,name:row.order_label||`Shopify order #${row.order_id}`,source:'Shopify',kind:row.reward_kind==='COMEBACK'?'Comeback':'First purchase',status:dataState(row.status),rawStatus:row.status,amount:row.reward_usdc?fmt(Number(row.reward_usdc)/1e6):'Pending valuation',settled:row.status==='DELIVERED'||row.status==='REFUNDED_AFTER_DELIVERY',tx:row.tx_hash,date:new Date(row.paid_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}))||[],[shopify]);
 const combined=[...native,...hybrid];const pending=combined.filter(r=>r.status==='reserved'||r.status==='eligible'||r.status==='settling');
 const delivered=combined.filter(r=>r.settled);
 const position=balances?Number(formatUnits(balances.stockBalance,8)):0;
 const referencePrice=price?Number(formatUnits(price.price,6)):null;
 async function unlockPortfolio(){if(!account||!provider)return;setBusy(true);setMessage('');try{
  const expiresAt=Date.now()+90_000;
  const origin=window.location.origin;
  const signingMessage=`OWNBACK Portfolio Access\nOrigin: ${origin}\nWallet: ${account.toLowerCase()}\nExpires: ${expiresAt}\nRead only. No transaction authority.`;
  const signature=await provider.request({method:'personal_sign',params:[toHex(signingMessage),account]}) as Hex;
  const result=await fetch('/api/retention/portfolio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet:account,expiresAt,signature}),cache:'no-store'});
  const json=await result.json();if(!result.ok)throw Error(json.error||'Unable to verify wallet proof');
  setShopify(json.orders as ShopifyRow[]);
  setMessage('Shopify wallet claims verified. This signature cannot transfer funds.');
 }catch(e){setMessage(e instanceof Error?e.message:'Portfolio lookup failed')}finally{setBusy(false)}}
 return <main className="v37-shell v37-page" id="main"><div className="v37-topline"><span><span className="v37-signal"/> THE CUSTOMER OWNERSHIP PASSPORT</span><span>Base Sepolia · no real securities</span></div>
 <header className="v37-nav v37-width"><Link href="/" className="v37-logo"><span>↗</span> OWNBACK<b>.</b></Link><nav><Link href="/agentic">Discover</Link><Link href="/ownership" aria-current="page">My ownership</Link><Link href="/growth">Merchant growth</Link><Link href="/protocol">Evidence</Link></nav><Link href="/shop" className="v37-nav-cta">Open Base wallet <ArrowUpRight size={15}/></Link></header>
 <div className="v37-width"><section className="v37-page-head"><div className="v37-kicker">THE REWARDS YOU KEEP TRACK OF</div><h1>Every purchase.<br/>One ownership story.</h1><p>A quiet home for your stock-linked rewards. See the exact difference between a promise, an eligible claim, and confirmed delivery.</p></section>
 <div className="v37-reward-grid"><section className="v37-portfolio-hero"><small>YOUR TESTNET PORTFOLIO</small><h2>{!account?'Connect a wallet':`${position.toFixed(6)} ${price?.symbol||'mock stock'}`}</h2><p>{account?`≈ ${referencePrice!==null?fmt(position*referencePrice):'Price unavailable'} at the latest adapter price. Synthetic Base Sepolia units only; no equity rights.`:'Connect your wallet using the Base app wallet controls to load real contract balances. No demo amounts will appear as if they were yours.'}</p><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:25,position:'relative',zIndex:1}}><span className="v37-status">{account?shortAddress(account):'Not connected'}</span><span className="v37-status">BASE SEPOLIA · MOCK STOCK</span></div></section>
 <section className="v37-card"><div className="v37-kicker">WHAT YOUR STATUS MEANS</div><h2 style={{marginTop:12}}>Only settled means owned.</h2><p>Every verified reward moves through a transparent sequence. It can stop if the payment is refunded, eligibility fails or settlement needs review.</p><div style={{marginTop:20}}>{[{name:'Reserved',detail:'Merchant reward budget allocated',icon:LockKeyhole},{name:'Eligible',detail:'Hold and identity conditions checked',icon:Clock3},{name:'Settling',detail:'Blockchain confirmation in progress',icon:WalletCards},{name:'Owned (testnet)',detail:'Delivery receipt verified on Base',icon:BadgeCheck}].map(s=><div className="v37-wallet-preview-row" key={s.name}><span className="v37-state-icon"><s.icon size={16}/></span><div><strong>{s.name}</strong><small>{s.detail}</small></div></div>)}</div></section></div>
 <div className="v37-inline-actions" style={{marginTop:24}}><Link href="/shop"><Wallet size={16}/> Connect wallet / settle eligible native rewards</Link>{account&&<button onClick={()=>refresh()}><RefreshCw size={15}/> Refresh onchain history</button>}{account&&<button onClick={unlockPortfolio} disabled={busy||wrongNetwork}><ShieldCheck size={16}/>{busy?'Checking wallet signature…':shopify?'Refresh Shopify claims':'Unlock Shopify claim history'}</button>}</div>
 {message&&<div className="v37-data-box" role="status">{message}</div>}{error&&<div className="v37-data-box" role="alert">{error}</div>}
 <section className="v37-card" style={{marginBottom:20}}><div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:15,flexWrap:'wrap'}}><div><div className="v37-kicker">SINGLE CUSTOMER VIEW</div><h2 style={{marginTop:12}}>Your reward activity.</h2><p>Base-native orders are read directly from the contract. Shopify claims are private until you sign a read-only wallet-access message.</p></div><span className="v37-tag">{combined.length} verified record{combined.length===1?'':'s'} loaded</span></div>
  {!account?<div className="v37-empty"><Wallet size={30}/>No wallet connected. Go to the Base wallet page to connect your wallet and return here.</div>:combined.length===0?<div className="v37-empty"><ShoppingBag size={30}/>No purchases found on the configured contract. Shopify orders become visible after you unlock the history with your wallet signature.</div>:<div className="v37-order-list">{combined.map(row=><div className="v37-order-row" key={row.id}><span className="v37-order-icon"><Gift size={17}/></span><div><strong>{row.name}</strong><small>{row.date} · {row.source} · {row.kind} · {row.amount}</small></div><span className={'v37-status '+(row.status==='owned'?'v37-status-owned':(row.status==='reversed'||row.status==='liability')?'v37-status-reversed':row.status==='reserved'?'v37-status-reserved':'')}>{row.status==='owned'?'Delivered':row.status==='liability'?'Refunded after delivery':row.status.replaceAll('_',' ')}</span>{row.tx&&row.settled&&txUrl(row.tx)&&<a title="Verified transaction" href={txUrl(row.tx)} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/></a>}</div>)}</div>}
  <div className="v37-metrics-grid" style={{marginBottom:0}}><div className="v37-metric"><small>Rewards still pending</small><strong>{pending.length}</strong><b>Not included in owned assets</b></div><div className="v37-metric"><small>Confirmed deliveries</small><strong>{delivered.length}</strong><b>Onchain evidence required</b></div></div>
 </section>
 <div className="v37-reward-grid" style={{margin:'20px 0 90px'}}><section className="v37-card"><div className="v37-kicker"><ShoppingBag size={14}/> KEEP DISCOVERING</div><h2 style={{marginTop:12}}>Shopping that gives more back.</h2><p>Shop connected merchants through Shopify or use the native Base USDC store. Paid-order verification and refund rules determine actual reward eligibility.</p><div className="v37-inline-actions"><Link href="/agentic">Shopping concierge <ArrowRight size={14}/></Link><Link href="/commerce">Native USDC store <ArrowRight size={14}/></Link></div></section><section className="v37-card"><div className="v37-kicker"><ShieldAlert size={14}/> HONEST OWNERSHIP</div><h2 style={{marginTop:12}}>No stock-shaped points.</h2><p>The current pilot sends mock testnet tokens, not securities. Real B20 economic claims and corporate-action multiplier support require an approved provider, eligible jurisdiction and verifiable delivery.</p><Link className="v37-text-link" href="/protocol">See settlement safeguards <ArrowUpRight size={14}/></Link></section></div>
 </div></main>
}
