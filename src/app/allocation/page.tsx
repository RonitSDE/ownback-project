'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bot, CheckCircle2, Compass, ExternalLink, LockKeyhole, RefreshCw, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Wallet } from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useWallet } from '@/hooks/useWallet';
import { allocationApprovalMessage, buildAllocationProposal, type AllocationInput, type AllocationProposal, type StockSymbol } from '@/lib/allocation/policy';
import '../retention.css';
import './studio.css';

type ProposeResponse={proposal:AllocationProposal;input:AllocationInput;preferenceReceiptsEnabled:boolean};
type Receipt={receiptId:number;digest:string;status:'RECORDED_NOT_EXECUTED';message:string};
const defaultInput:AllocationInput={rewardUsd:2,theme:'technology',preferredStock:'AUTO',excludedSymbols:[],maxSingleWeightPercent:100,cashReservePercent:0};
const themeOptions=[['technology','Technology'],['consumer-electronics','Consumer electronics'],['semiconductors','Semiconductors'],['robotics','Robotics'],['energy','Energy']] as const;
const money=(x:number)=>x.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function AllocationStudio(){
 const {account,provider,wrongNetwork,chainId}=useWallet();
 const [input,setInput]=useState<AllocationInput>(defaultInput),[response,setResponse]=useState<ProposeResponse|null>(null);
 const [error,setError]=useState(''),[working,setWorking]=useState(false),[saving,setSaving]=useState(false),[receipt,setReceipt]=useState<Receipt|null>(null);
 const [research,setResearch]=useState(''),[researchState,setResearchState]=useState('');
 const [consent,setConsent]=useState(false);
 const [fixtureMode,setFixtureMode]=useState(false);
 function update(next:Partial<AllocationInput>){setFixtureMode(false);setInput(v=>({...v,...next}));setResponse(null);setReceipt(null);setError('');setResearch('');setResearchState('');setConsent(false)}
 function toggleExclude(symbol:StockSymbol){update({excludedSymbols:input.excludedSymbols.includes(symbol)?input.excludedSymbols.filter(s=>s!==symbol):[...input.excludedSymbols,symbol]})}
 function previewFixture(kind:'allowed'|'refused'){
  const brief:AllocationInput=kind==='allowed'?{...defaultInput}:{...defaultInput,theme:'robotics',maxSingleWeightPercent:50,excludedSymbols:['AAPLc']};
  const proposal=buildAllocationProposal(brief,{settlementStock:'AAPLc',chainId:84532});
  setFixtureMode(true);setInput(brief);setResponse({input:brief,proposal,preferenceReceiptsEnabled:false});setError('');setConsent(false);setReceipt(null);setResearch('');
 }
 async function propose(){setFixtureMode(false);setWorking(true);setError('');setResponse(null);setReceipt(null);setResearch('');setResearchState('');try{
   const result=await fetch('/api/allocation/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
   const data=await result.json();if(!result.ok)throw Error(data.error||'Could not evaluate policy.');setResponse(data as ProposeResponse);
 }catch(e){setError((e as Error).message)}finally{setWorking(false)}}
 async function requestResearch(symbol:StockSymbol){setResearchState('Requesting read-only Bankr research…');setResearch('');try{
   const res=await fetch('/api/allocation/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Research not available.');
   const url=`/api/allocation/research?jobId=${encodeURIComponent(data.jobId)}&token=${encodeURIComponent(data.token)}`;
   for(let attempt=0;attempt<20;attempt++){
    await new Promise<void>(resolve=>setTimeout(resolve,1600));
    const polled=await fetch(url,{cache:'no-store'});const item=await polled.json();
    if(!polled.ok)throw Error(item.error||'Research status unavailable.');
    if(item.status==='completed'){setResearch(item.research||'Research completed without a report.');setResearchState('Research returned · check cited sources independently');return}
    if(item.status==='failed'||item.status==='cancelled')throw Error('Research did not complete.');
   }
   setResearchState('Still processing. Retry the research if needed.');
 }catch(e){setResearchState((e as Error).message)}}
 async function signPreference(){
  const proposal=response?.proposal;if(!response||!proposal||proposal.status!=='proposed'||!proposal.stock||!account||!provider||!consent||wrongNetwork||chainId!==proposal.chainId)return;
  setSaving(true);setError('');
  try{
   const nonce=crypto.randomUUID();const expiresAt=Date.now()+5*60_000;
   const message=allocationApprovalMessage({origin:location.origin,wallet:account,nonce,expiresAt,proposal,input:response.input});
   const signature=await provider.request({method:'personal_sign',params:[message,account] as never});
   if(typeof signature!=='string')throw Error('Wallet did not return a signature.');
   const res=await fetch('/api/allocation/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:response.input,wallet:account,signature,nonce,expiresAt})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Could not store preference.');
   setReceipt(data as Receipt);
  }catch(e){setError((e as Error).message)}finally{setSaving(false)}
 }
 const plan=response?.proposal;
 return <main className="v37-shell ob39" id="main">
  <div className="v37-topline"><span><span className="v37-signal"/> OWNBACK · AGENTIC STOCK FINANCE</span><span>Base Stocks Maxxing · pilot candidate · not an investment service</span></div>
  <header className="v37-nav v37-width"><Link href="/" className="v37-logo"><span>↗</span> OWNBACK<b>.</b></Link><nav aria-label="Primary navigation"><Link href="/agentic">Discover</Link><Link href="/allocation" aria-current="page">Allocation agent</Link><Link href="/ownership">My ownership</Link><Link href="/growth">Merchant proof</Link></nav><WalletButton/></header>
  <div className="v37-width">
   <section className="ob39-head"><div><div className="v37-kicker"><Sparkles size={15}/> CONTROLLED INTELLIGENCE, NOT AUTONOMOUS TRADING</div><h1>Give your reward<br/><em>direction.</em></h1><p>Tell the agent what matters. It checks your constraints against the exact stock token a merchant-funded reward vault can settle, cites its sources, and <strong>refuses an impossible allocation.</strong> Your wallet controls the final preference.</p><div className="ob39-chips"><span><ShieldCheck size={14}/> Explicit limits</span><span><Compass size={14}/> Explainable refusal</span><span><LockKeyhole size={14}/> Zero delegated spending</span></div></div><div className="ob39-head-card"><span>THE OWNBACK LOOP</span><div><b>01</b> Verified purchase</div><div><b>02</b> Reward reserved</div><div className="ob39-selected"><b>03</b> Agent proposes</div><div><b>04</b> Owner reviews</div><div><b>05</b> Separate eligible settlement</div><small>Steps 01, 02 and 05 require actual merchant/backend/onchain proof. This studio never generates it.</small></div></section>
   <div className="v37-card" style={{marginBottom:16}}><div className="v37-kicker">ONE-CLICK 20-SECOND REFUSAL DEMO · OFFLINE FIXTURE</div><p>Both examples are deterministic, local policy evaluations with an explicitly assumed AAPLc vault. No payment, eligibility, signature or settlement is executed.</p><div className="v37-inline-actions"><button onClick={()=>previewFixture('allowed')}>1 · Supported brief → PROPOSED</button><button onClick={()=>previewFixture('refused')}>2 · Robotics / 50% cap / exclude AAPLc → REFUSED</button></div><small>To test your configured backend instead, edit the brief and select Generate policy-checked proposal. A missing real vault configuration must refuse.</small></div>
   <div className="ob39-grid"><section className="v37-card ob39-controls"><div className="v37-kicker"><SlidersHorizontal size={15}/> 01 / YOUR BRIEF</div><h2>Make the rules yours.</h2><p>Prototype a preference for one merchant-funded reward. The amount below is an assumption, not verified wallet funds.</p>
     <div className="ob39-field"><label htmlFor="reward-usd">Illustrative single reward ($)</label><input id="reward-usd" type="number" min="0.01" max="10" step="0.01" value={input.rewardUsd} onChange={e=>update({rewardUsd:Number(e.target.value)})}/><small>Maximum $10 per reward in the mainnet pilot contract</small></div>
     <div className="ob39-field"><label htmlFor="stock-theme">Which exposure interests you?</label><select id="stock-theme" value={input.theme} onChange={e=>update({theme:e.target.value as AllocationInput['theme']})}>{themeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
     <div className="ob39-field"><label htmlFor="preferred">Stock preference</label><select id="preferred" value={input.preferredStock} onChange={e=>update({preferredStock:e.target.value as AllocationInput['preferredStock']})}><option value="AUTO">Use the active vault token</option><option value="AAPLc">AAPLc</option><option value="NVDAc">NVDAc</option></select></div>
     <fieldset className="ob39-exclusions"><legend>Exclude these tokens</legend>{(['AAPLc','NVDAc'] as StockSymbol[]).map(stock=><label key={stock}><input type="checkbox" checked={input.excludedSymbols.includes(stock)} onChange={()=>toggleExclude(stock)}/>{stock}</label>)}</fieldset>
     <div className="ob39-field"><div className="ob39-sliderhead"><label htmlFor="concentration">Maximum weight in one company</label><b>{input.maxSingleWeightPercent}%</b></div><input id="concentration" type="range" min="10" max="100" step="10" value={input.maxSingleWeightPercent} onChange={e=>update({maxSingleWeightPercent:Number(e.target.value)})}/></div>
     <div className="ob39-field"><div className="ob39-sliderhead"><label htmlFor="reserve">Desired uninvested cash reserve</label><b>{input.cashReservePercent}%</b></div><input id="reserve" type="range" min="0" max="90" step="10" value={input.cashReservePercent} onChange={e=>update({cashReservePercent:Number(e.target.value)})}/></div>
     <button className="ob39-primary" onClick={propose} disabled={working}>{working?<RefreshCw size={16}/>:<Bot size={17}/>} {working?'Checking restrictions…':'Generate policy-checked proposal'} <ArrowRight size={16}/></button>
     <p className="ob39-footnote">Try setting max concentration to 50%, selecting robotics, or excluding the active stock: the agent must refuse instead of ignoring your instruction.</p>
    </section>
    <section className="v37-card ob39-result" aria-live="polite"><div className="v37-kicker"><Bot size={15}/> 02 / RESEARCH → PROPOSAL · {fixtureMode?'OFFLINE FIXTURE':'BACKEND POLICY'}</div><h2>A proposal you can challenge.</h2>
     {!plan?<div className="ob39-placeholder"><Compass size={30}/><strong>Your preferences come first.</strong><p>Adjust the brief and generate a constrained recommendation. No market price, trade or eligibility is assumed.</p></div>:<>
      <div className={'ob39-result-heading '+(plan.status==='refused'?'refused':'ok')}><div><small>POLICY ENGINE VERDICT</small><strong>{plan.status==='refused'?'Refused — constraints cannot be met':'Proposal — single-token pilot'}</strong></div>{plan.status==='refused'?<ShieldAlert size={25}/>:<CheckCircle2 size={25}/>}</div>
      {plan.status==='refused'?<div className="ob39-reasons"><strong>Hard stops</strong>{plan.reasons.map(r=><p key={r}>• {r}</p>)}<small>Change the brief or enable an independently audited, funded compatible stock lane. No override is available.</small></div>:<div className="ob39-allocation"><div><small>Merchant-funded reward assumption</small><strong>{money(plan.rewardUsd)}</strong></div><div><small>Eligible stock candidate</small><strong>{plan.stock}</strong></div><div><small>Proposed stock weight</small><strong>{plan.stockWeightPercent}%</strong></div><div><small>Cash reserve</small><strong>{plan.reservePercent}%</strong></div></div>}
      <div className="ob39-evidence"><h3>Facts / assumptions / opinions</h3><strong>Facts about the architecture</strong>{plan.facts.map(f=><p key={f}>{f}</p>)}<strong>Assumptions</strong>{plan.assumptions.map(f=><p key={f}>{f}</p>)}<strong>Risk assessment</strong>{plan.opinions.map(f=><p key={f}>{f}</p>)}</div>
      <div className="ob39-sources"><strong>Primary references · verify live restrictions</strong>{plan.sources.map(x=><a key={x.url} href={x.url} target="_blank" rel="noreferrer">{x.title} <ExternalLink size={13}/></a>)}</div>
      {plan.stock&&<details className="ob39-secondary"><summary>Optional source research · Bankr (unverified read-only)</summary><button className="ob39-secondary" onClick={()=>requestResearch(plan.stock!)}><Sparkles size={15}/> Request unverified Bankr research</button></details>}
      {researchState&&<div className="ob39-research-state">{researchState}</div>}
      {research&&<div className="ob39-research"><strong>Unverified AI output (not used by policy engine)</strong><pre>{research}</pre></div>}
      <div className="ob39-execution"><LockKeyhole size={15}/> Execution status: <b>{plan.executionStatus}</b>. An allocation proposal does not deliver stock.</div>
     </>}
    </section></div>
   <section className="ob39-approval v37-card"><div><div className="v37-kicker"><Wallet size={15}/> 03 / WALLET-SIGNED PREFERENCE</div><h2>Consent without custody.</h2><p><strong>NOT_EXECUTED · preference only — cannot trade or claim.</strong> {plan?.approvalMeaning || 'Only a supported proposal can be signed. A wallet signature does not authorize spending or execute a reward.'}</p><div className="ob39-consent"><label><input type="checkbox" checked={consent} disabled={plan?.status!=='proposed'} onChange={e=>setConsent(e.target.checked)}/> Preference only — cannot trade or claim. No stock purchased or delivered.</label></div><button className="ob39-primary" disabled={!account||!provider||!consent||plan?.status!=='proposed'||!response?.preferenceReceiptsEnabled||saving||wrongNetwork||chainId!==plan?.chainId} onClick={signPreference}>{saving?'Requesting wallet signature…':'Sign and record preference'} <ArrowUpRight size={15}/></button><p className="ob39-footnote">{!response?.preferenceReceiptsEnabled?'Receipt recording is off until production Postgres, APP_ORIGIN and pilot consent settings are configured. Proposals remain available.':!account?'Connect a wallet to enable signing.':wrongNetwork?'Switch to the configured Base network in your wallet.':'Wallet signatures are replay-protected and expire after five minutes.'}</p></div>
    <div className="ob39-proof"><div className="v37-kicker"><ShieldCheck size={15}/> EXECUTION / EVIDENCE BOUNDARY</div>{receipt?<><h3>Preference recorded · NOT_EXECUTED</h3><p>Receipt #{receipt.receiptId} · {receipt.status} · preference only — cannot trade or claim</p><code>{receipt.digest}</code></>:<><h3>No purchase has been made here.</h3><p>A real merchant-paid order, refund hold, eligibility screening, funded inventory, fresh pricing and onchain settlement still have to happen in the existing reward flow.</p></>}<Link href="/ownership">View delivered-versus-pending reward states <ArrowUpRight size={14}/></Link></div>
   </section>{error&&<div className="ob39-error" role="alert">{error}</div>}
   <footer className="ob39-footer">OWNBACK v3.10 · Base Agentic Stock Finance candidate. Prototype policy engine; optional Bankr research. No real-money trade or investment advice here.</footer>
  </div>
 </main>;
}
