import Link from 'next/link';
import type {Metadata} from 'next';
import {ArrowUpRight, ExternalLink, LockKeyhole, Receipt, ShieldAlert, ShieldCheck} from 'lucide-react';
import register from '../../../evidence/proofs.json';
import '../retention.css';
import '../judge.css';
import './verify.css';

export const metadata:Metadata={
 title:'Verify OWNBACK · Base Sepolia proof register',
 description:'Inspect captured merchant-funding, paid-order, mock-stock reward and preference-replay evidence. Source-captured does not mean independently RPC-verified.',
 robots:{index:true,follow:true}
};
const shortHash=(h:string|null)=>h?`${h.slice(0,12)}…${h.slice(-10)}`:'Offchain — no transaction';
export default function Verify(){
 const records=register.proofs;
 const captured=records.filter(r=>r.status==='VERIFIED'&&r.evidenceFile).length;
 return <main className="v37-shell ob40" id="main">
  <div className="v37-width ob38-verify">
   <div className="v37-kicker"><Receipt size={15}/> READ-ONLY EVIDENCE · NO WALLET REQUIRED</div>
   <h1>Don't trust the demo.<br/><em>Check the proof.</em></h1>
   <p className="ob38-lead">OWNBACK links each claim to its evidence type, network and verification instructions. This register describes captures bundled with the release; it does <strong>not</strong> claim the live RPC gate or Builder Code attribution has passed on this deployment.</p>
   <div className="ob38-stats"><div><small>Captured artifacts in source</small><strong>{captured} / {records.length}</strong><span>Structural proof; not live verification</span></div><div><small>Independently verified by this page</small><strong>0 / {records.length}</strong><span>No live RPC attestation embedded</span></div><div><small>Comeback purchase receipt</small><strong>Not attached</strong><span>Observed retention ≠ causal uplift</span></div></div>
   <section className="ob38-panel"><div className="v37-kicker"><Receipt size={15}/> CHAIN AND API PROOFS</div><h2>One campaign. One purchase. An explicit evidence boundary.</h2>
   {records.map((proof,i)=><article className="ob38-proof" key={proof.id}><div className="ob38-proof-index">0{i+1}</div><div className="ob38-proof-main"><div className="ob38-proof-top"><h3>{proof.name}</h3><span className="ob38-pending">{proof.status==='VERIFIED'?'CAPTURED · RPC PENDING':'MISSING'}</span></div><p>{proof.id==='preference_replay'?'Offchain signed preference; captured HTTP 200 followed by replay HTTP 409. This is not a trade.':proof.id==='settlement_refusal'?'Saved Base Sepolia mock-stock reward settlement; not a real B20 transfer.':'Saved Base Sepolia transaction; verify the contract event and linkage onchain.'}</p><code>{shortHash(proof.transactionHash)}</code><small>{proof.environment} · {proof.evidenceFile||'No artifact attached'}</small>{proof.id==='order_payment'&&'orderRef'in proof&&proof.orderRef?<small>orderRef: <code>{proof.orderRef}</code></small>:null}{proof.url?<a href={proof.url} target="_blank" rel="noopener noreferrer">Open transaction in BaseScan <ExternalLink size={13}/></a>:null}</div></article>)}
   </section>
   <div className="ob38-verify-split">
    <section className="ob38-panel"><div className="v37-kicker"><ShieldCheck size={15}/> HOW JUDGES VERIFY</div><h2>Reproduce the claims.</h2><ol><li>Confirm chain ID <code>84532</code> and each transaction's successful receipt.</li><li>Match the OWNBACK contract address, campaign, purchase, customer and paid <code>orderRef</code> across events.</li><li>Compare saved receipt block hashes with canonical chain blocks.</li><li>For the signed preference, inspect first 200 and identical replay 409; a local log is not a public chain transaction.</li><li>Run <code>npm run verify:proofs:strict</code> with <code>BASE_SEPOLIA_RPC_URL</code> and the exact tagged source.</li></ol><p>The strict checker exists in <code>scripts/verify-proofs.mjs</code>. An RPC success is required before the release gate can be marked verified.</p></section>
    <section className="ob38-panel"><div className="v37-kicker"><LockKeyhole size={15}/> BUILDER CODE & LIMITS</div><h2>Attribution is not assumed.</h2><p>The Builder Code integration introduced in v3.10.7 tagging for wallet and worker paths. Historical Sepolia receipts in this package do <strong>not</strong> prove the tag survived signing, especially for smart-wallet UserOperations.</p><p>New attributed transactions require the verified suffix in actual calldata or the inner UserOperation, not simply an environment variable.</p><div className="ob38-warning"><ShieldAlert size={16}/> Only mock stock delivered on testnet. No real B20 ownership, Shopify production partnership, causal retention uplift or real-money mainnet readiness is claimed.</div><Link href="/allocation" className="v37-text-link">See allowed and refused agent policies <ArrowUpRight size={14}/></Link></section>
   </div>
   <div className="ob38-bottom"><Link href="/growth" className="v37-button v37-button-dark">Inspect campaign and order links <ArrowUpRight size={14}/></Link><Link href="/judge" className="v37-button v37-button-plain">Return to judge walkthrough</Link></div>
  </div>
 </main>
}
