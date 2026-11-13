'use client';
import {useEffect,useState} from 'react';
import type {Address} from 'viem';
import {CheckCircle2,ShieldCheck,Wallet,ArrowRight,Sparkles,Mail} from 'lucide-react';
import {connectWallet,signWithConnectedWallet} from '@/lib/wallet';
import {isMainnet} from '@/lib/config';
import '../experience/hybrid.css';
export default function ShopifyClaimPage(){
 const [token,setToken]=useState(''),[wallet,setWallet]=useState<Address>(),[busy,setBusy]=useState(false),[result,setResult]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{const url=new URL(window.location.href);const t=url.searchParams.get('token');if(t){setToken(t);window.history.replaceState({},'',url.pathname)}},[]);
 async function claim(){
  if(!token||!wallet)return;setBusy(true);setResult('');
  try{
   const origin=window.location.origin;
   const msg=`OWNBACK Shopify Reward\nOrigin: ${origin}\nWallet: ${wallet.toLowerCase()}\nClaim: ${token}`;
   const signature=await signWithConnectedWallet(wallet,msg);
   const r=await fetch('/api/shopify/claim/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,wallet,signature})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to claim');
   setDone(true);setToken('');setResult('Wallet verified. Your reward is reserved for eligibility and settlement checks.');
  }catch(e){setResult(e instanceof Error?e.message:'Claim failed')}finally{setBusy(false)}
 }
 return <main className="hb-shell"><header className="hb-top"><a className="hb-logo" href="/experience"><span>↗</span> OWNBACK<b>.</b></a><a href="/experience" className="hb-navlink">Explore the rewards network <ArrowRight size={15}/></a></header>
 <div className="hb-claim-shell"><div className="hb-claim-hero"><span className="hb-eyebrow"><Sparkles size={15}/> YOUR OWNERSHIP MOMENT</span><h1>Your purchase deserves <em>more.</em></h1><p>Link your wallet to a Shopify purchase reward. Your store checkout is already complete—we will never charge you a second time.</p><div className="hb-claim-steps"><span><Mail size={17}/> Verified order link</span><span><ShieldCheck size={17}/> Eligibility review</span><span><Wallet size={17}/> {isMainnet?'Eligible B20 delivery':'Testnet stock delivery'}</span></div></div>
 <div className="hb-claim-card"><div className="hb-claim-icon"><Wallet size={28}/></div><h2>{done?'Your wallet is connected':'Claim your ownership reward'}</h2><p>{done?'You can close this page and check back for settlement.':'Sign a free wallet message to link your Shopify purchase. No payment or token approval is requested.'}</p><div className="hb-claim-wallet">{wallet?`${wallet.slice(0,8)}…${wallet.slice(-6)}`:'Wallet not connected'}</div><button disabled={busy} onClick={async()=>{try{setWallet(await connectWallet())}catch(e){setResult(String(e))}}} className="hb-btn hb-btn-outline"><Wallet size={16}/> {wallet?'Change wallet':'Connect Base wallet'}</button><button disabled={busy||done||!wallet||!token} onClick={claim} className="hb-btn hb-btn-dark">{busy?'Checking signature…':done?'Claim verified':'Verify reward claim'}<ArrowRight size={16}/></button>{!token&&!done&&<p className="hb-inline-warning">Open your one-time claim link from your merchant email.</p>}{result&&<p role="status" className={done?'hb-inline-success':'hb-inline-warning'}>{done&&<CheckCircle2 size={16}/>} {result}</p>}<div className="hb-claim-note">{isMainnet?'Base mainnet: delivery requires confirmed purchase, approved wallet, real prefunded stock inventory, a fresh price feed and a successful onchain receipt.':'Base Sepolia pilot. Mock stock tokens have no monetary value or equity rights. Real stock distribution is not enabled.'}</div></div></div></main>
}
