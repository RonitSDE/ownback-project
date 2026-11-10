'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,ShieldCheck,Bot,Sparkles,ShoppingBag,Search,Send,LockKeyhole,PackageCheck,Repeat2,Wallet,Check,Plus,Minus,X,ExternalLink,Lightbulb,Store,Compass,SlidersHorizontal,LoaderCircle} from 'lucide-react';
import './agentic.css';

type Variant={id:string;title:string;priceMinor:number;currency:string;available:boolean};
type Product={id:string;title:string;description:string;image:string|null;priceMinor:number;currency:string;url:string|null;variants:Variant[]};
type CartLine={variant:Variant;product:Product;quantity:number};
type Message={from:'assistant'|'user';text:string};
const demos:Product[]=[
 {id:'demo-1',title:'Everyday Studio Headphones',description:'Minimal design, big sound. A good starting point for your next daily essential.',image:null,priceMinor:8400,currency:'USD',url:null,variants:[{id:'demo:one',title:'Obsidian',priceMinor:8400,currency:'USD',available:true},{id:'demo:oneb',title:'Cloud',priceMinor:8400,currency:'USD',available:true}]},
 {id:'demo-2',title:'Nomad Coffee Essentials',description:'Thoughtfully made daily rituals for the curious and the caffeinated.',image:null,priceMinor:3200,currency:'USD',url:null,variants:[{id:'demo:two',title:'Default',priceMinor:3200,currency:'USD',available:true}]},
 {id:'demo-3',title:'Atelier Everyday Tote',description:'A beautiful, practical companion for the moments between places.',image:null,priceMinor:5600,currency:'USD',url:null,variants:[{id:'demo:three',title:'Stone',priceMinor:5600,currency:'USD',available:true}]},
 {id:'demo-4',title:'Motion Running Club',description:'Soft, lightweight essentials made for movement and long weekends.',image:null,priceMinor:7200,currency:'USD',url:null,variants:[{id:'demo:four',title:'Standard',priceMinor:7200,currency:'USD',available:true}]}
];
const suggestions=['Headphones under $100','A thoughtful gift under $60','Coffee for the morning ritual','Everyday essentials'];
function currency(minor:number,code='USD'){try{return new Intl.NumberFormat('en-US',{style:'currency',currency:code}).format(minor/100)}catch{return '$'+(minor/100).toFixed(2)}}
function reward(minor:number,pct:number){return Math.min(1000,Math.floor(minor*pct/100))}
function productMark(index:number){return ['✳','◌','✺','✦'][index%4]}

export default function AgenticPage(){
 const [mode,setMode]=useState<'preview'|'live'>('preview');
 const [merchants,setMerchants]=useState<string[]>([]),[shop,setShop]=useState(''),[catalogConfigured,setCatalogConfigured]=useState(false);
 const [loadingDirectory,setLoadingDirectory]=useState(true),[searching,setSearching]=useState(false),[creating,setCreating]=useState(false);
 const [query,setQuery]=useState(''),[results,setResults]=useState<Product[]>(demos),[selectedVariants,setSelectedVariants]=useState<Record<string,string>>({});
 const [cart,setCart]=useState<CartLine[]>([]),[link,setLink]=useState(''),[handoff,setHandoff]=useState(false);
 const [error,setError]=useState(''),[activity,setActivity]=useState<Message[]>([{from:'assistant',text:'Tell me what you are looking for. I will help you discover products, compare options and preview potential OWNBACK rewards—without guessing which products are available.'}]);
 const [comeback,setComeback]=useState(false),[activeTab,setActiveTab]=useState<'discover'|'how'>('discover');
 const searchRef=useRef<HTMLInputElement>(null);
 const searchEpoch=useRef(0),cartEpoch=useRef(0);
 useEffect(()=>{
   let closed=false;
   fetch('/api/agentic/merchants',{cache:'no-store'}).then(async r=>{const data=await r.json();if(closed)return;const list=Array.isArray(data.merchants)?data.merchants:[];setMerchants(list);setCatalogConfigured(Boolean(data.live));if(list.length)setShop(list[0])}).catch(()=>{}).finally(()=>{if(!closed)setLoadingDirectory(false)});
   return()=>{closed=true};
 },[]);
 const cartTotal=useMemo(()=>cart.reduce((sum,item)=>sum+item.variant.priceMinor*item.quantity,0),[cart]);
 const cartCurrency=cart[0]?.variant.currency||'USD';
 const previewReward=cartCurrency==='USD'?reward(cartTotal,comeback?5:2):null;
 const liveReady=catalogConfigured&&merchants.length>0&&Boolean(shop);
 const shown=useMemo(()=>{
   if(mode==='live')return results;
   const q=query.trim().toLowerCase();
   if(!q)return demos;
   const words=q.replace(/under \$?\d+/g,'').split(/\s+/).filter(w=>w.length>3);
   const limit=/(?:under|below|less than)\s*\$?(\d+)/.exec(q);const max=limit?Number(limit[1])*100:Infinity;
   const match=demos.filter(p=>p.priceMinor<=max&&(!words.length||words.some(w=>(p.title+' '+p.description).toLowerCase().includes(w))));
   return match.length?match:demos.filter(p=>p.priceMinor<=max);
 },[mode,query,results]);
 function changeMode(next:'preview'|'live'){
   searchEpoch.current++;cartEpoch.current++;setSearching(false);setCreating(false);
   setMode(next);setResults(next==='preview'?demos:[]);setCart([]);setLink('');setHandoff(false);setError('');
   setActivity([{from:'assistant',text:next==='preview'?'You are exploring an illustrative shopping journey. Try a product, build a sample cart, and see each ownership step. No transaction will happen.':'Live mode searches products from your selected connected Shopify merchant. Your payment stays entirely on the merchant’s secure checkout.'}]);
 }
 function switchMerchant(next:string){
   searchEpoch.current++;cartEpoch.current++;setSearching(false);setCreating(false);
   setShop(next);setResults([]);setSelectedVariants({});setCart([]);setLink('');setHandoff(false);setError('');
 }
 async function search(q:string){
   const text=q.trim();if(text.length<2)return;
   setError('');setLink('');setHandoff(false);
   setActivity(v=>[...v,{from:'user',text}]);setQuery(text);
   if(mode==='preview'){
     setActivity(v=>[...v,{from:'assistant',text:'Here are sample items to explore the ownership journey. These are not live merchant listings, so checkout is disabled.'}]);
     return;
   }
   if(!shop){setError('Connect a Shopify merchant first.');return}
   const epoch=++searchEpoch.current;setSearching(true);
   try{
    const response=await fetch('/api/agentic/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop,query:text})});
    const data=await response.json();if(epoch!==searchEpoch.current)return;if(!response.ok)throw Error(data.error||'Search unavailable');
    const products=Array.isArray(data.products)?data.products as Product[]:[];
    setResults(products);setSelectedVariants({});
    setActivity(v=>[...v,{from:'assistant',text:products.length?`I found ${products.length} current catalog ${products.length===1?'option':'options'} from ${shop}. Prices and availability are live catalog data, but rewards only qualify after a verified purchase and eligibility checks.`:'I could not find a current match in this merchant’s catalog. Try another description or price range.'}]);
   }catch(e){if(epoch===searchEpoch.current){setError(e instanceof Error?e.message:'Search unavailable');setActivity(v=>[...v,{from:'assistant',text:'I cannot verify live inventory right now. I will not invent merchant offers. You can try again or browse the preview.'}])}}
   finally{if(epoch===searchEpoch.current)setSearching(false)}
 }
 function add(product:Product){
  const variantId=selectedVariants[product.id]||product.variants.find(v=>v.available)?.id;
  const variant=product.variants.find(v=>v.id===variantId&&v.available);
  if(!variant){setError('Choose an available product option first.');return}
  if(cart.length&&cart[0].variant.currency!==variant.currency){setError('This cart can only contain products in the same currency.');return}
  if(cart.length>=6&&!cart.some(item=>item.variant.id===variant.id)){setError('Maximum six different items per cart.');return}
  setCart(items=>{
    const old=items.find(item=>item.variant.id===variant.id);
    if(old)return items.map(item=>item.variant.id===variant.id?{...item,quantity:Math.min(10,item.quantity+1)}:item);
    return [...items,{product,variant,quantity:1}];
  });
  cartEpoch.current++;setCreating(false);setLink('');setHandoff(false);setError('');
 }
 function quantity(id:string,delta:number){cartEpoch.current++;setCreating(false);setCart(items=>items.map(item=>item.variant.id===id?{...item,quantity:item.quantity+delta}:item).filter(item=>item.quantity>0&&item.quantity<=10));setLink('');setHandoff(false)}
 async function createCart(){
  if(mode==='preview'){setHandoff(true);return}
  if(!cart.length||!shop)return;
  const epoch=++cartEpoch.current;setCreating(true);setError('');
  try{
   const response=await fetch('/api/agentic/cart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop,items:cart.map(item=>({variantId:item.variant.id,quantity:item.quantity}))})});
   const data=await response.json();if(epoch!==cartEpoch.current)return;if(!response.ok)throw Error(data.error||'Cart creation unavailable');
   setLink(data.cart.continueUrl);setHandoff(true);
   setActivity(v=>[...v,{from:'assistant',text:'Your cart is ready. Review the final totals, shipping, taxes, and payment inside Shopify. OWNBACK issues no rewards until the merchant confirms the paid order.'}]);
  }catch(e){if(epoch===cartEpoch.current)setError(e instanceof Error?e.message:'Could not create cart')}
  finally{if(epoch===cartEpoch.current)setCreating(false)}
 }
 return <main className="ac-shell" id="main">
  <div className="ac-strip"><span className="ac-status"/> OWNBACK CONCIERGE <span>SHOPIFY UCP × BASE REWARDS</span><span className="ac-strip-end">Testnet rewards only · No real stock</span></div>
  <header className="ac-nav"><Link className="ac-logo" href="/"><span>↗</span> OWNBACK<b>.</b></Link><nav><Link className="ac-nav-active" href="/agentic">Shopping concierge</Link><Link href="/commerce">USDC store</Link><Link href="/experience">Merchant network</Link><Link href="/growth">Merchant growth</Link><Link href="/protocol">Our proof</Link></nav><Link className="ac-nav-wallet" href="/claim">My rewards <ArrowUpRight size={15}/></Link></header>
  <div className="ac-wrap">
   <section className="ac-hero"><div className="ac-hero-content"><div className="ac-kicker"><span className="ac-status"/> MEET THE NEW WAY TO SHOP</div><h1>Your next favorite thing.<br/><em>And a little more ownership.</em></h1><p>Ask, discover, and build a cart in one thoughtful flow. Buy directly from the merchant. Get invited to claim eligible stock-linked rewards on Base—no crypto setup at checkout.</p><div className="ac-hero-actions"><button type="button" onClick={()=>{setActiveTab('discover');searchRef.current?.focus();document.getElementById('ac-workspace')?.scrollIntoView({behavior:'smooth'})}} className="ac-btn ac-btn-lime">Start discovering <ArrowRight size={17}/></button><button onClick={()=>setActiveTab(activeTab==='how'?'discover':'how')} className="ac-btn ac-btn-outline">{activeTab==='how'?'See discovery':'How OWNBACK works'} <Compass size={16}/></button></div><div className="ac-hero-trust"><span><ShieldCheck size={14}/> Merchant-verified orders</span><span><LockKeyhole size={14}/> No payment custody</span><span><Sparkles size={14}/> Personal discovery</span></div></div><div className="ac-hero-art"><div className="ac-orbit ac-orbit-1"/><div className="ac-orbit ac-orbit-2"/><div className="ac-art-card ac-art-feature"><span>THE REWARD MOMENT</span><div className="ac-art-glyph">✳</div><strong>Make every<br/>purchase mean more.</strong><small>Everyday commerce → potential stock-linked rewards</small></div><div className="ac-art-float ac-art-float-top"><Check size={14}/> Payment stays with the store</div><div className="ac-art-float ac-art-float-bottom">↗ 2% first · 5% comeback*</div><div className="ac-art-caption">*Illustrative pilot rates; not guaranteed</div></div></section>
   <div className="ac-proof-strip"><div><span>01</span><strong>Discover with context</strong><small>Shopify live catalog</small></div><div><span>02</span><strong>Checkout with confidence</strong><small>Shop directly with the merchant</small></div><div><span>03</span><strong>Claim your reward</strong><small>After order verification</small></div><div><span>04</span><strong>Keep building ownership</strong><small>Base testnet proof</small></div></div>
   <section className="ac-section" id="ac-workspace"><div className="ac-section-heading"><div><div className="ac-overline">THE PERSONAL SHOPPING STUDIO</div><h2>Tell us what you're looking for.</h2><p>No endless filters. Just useful finds from merchants, with clear reward expectations.</p></div><div className="ac-mode"><button className={mode==='preview'?'selected':''} onClick={()=>changeMode('preview')}>Preview experience</button><button className={mode==='live'?'selected':''} onClick={()=>changeMode('live')}>Live Shopify catalog</button></div></div>
    {activeTab==='how'&&<div className="ac-education"><div><Sparkles size={23}/><h3>Useful recommendations, never invented listings.</h3><p>Live search requests go to the connected merchant’s Shopify UCP Catalog MCP. Variant prices and availability come from the merchant.</p></div><div><ShoppingBag size={23}/><h3>The merchant keeps checkout.</h3><p>OWNBACK creates a Shopify cart and redirects you to the merchant. OWNBACK never asks for your card credentials or triggers an autonomous purchase.</p></div><div><Wallet size={23}/><h3>Ownership begins after proof.</h3><p>Paid-order verification, refund checks, merchant funding and customer eligibility precede a Base Sepolia mock-stock reward claim.</p></div></div>}
    <div className="ac-workspace-grid"><div className="ac-discovery-panel"><div className="ac-assistant-heading"><div className="ac-avatar"><Bot size={22}/></div><div><strong>OWNBACK Concierge</strong><small><span className="ac-status"/> {mode==='preview'?'Illustrative guided demo':'Shopify Catalog MCP · live'}</small></div><span className="ac-trust-label"><ShieldCheck size={12}/> Verified sources</span></div>
      <div className="ac-chat-log" aria-live="polite">{activity.slice(-6).map((m,i)=><div className={'ac-chat-message '+(m.from==='user'?'user':'agent')} key={i}><div className="ac-chat-symbol">{m.from==='assistant'?'↗':'YOU'}</div><p>{m.text}</p></div>)}</div>
      <div className="ac-merchant-bar"><div><Store size={16}/><span>{mode==='preview'?'Sample design studio':'Connected merchant'}</span></div>{mode==='live'?<select aria-label="Select connected merchant" disabled={!liveReady||searching} value={shop} onChange={e=>switchMerchant(e.target.value)}>{!liveReady&&<option value="">No connected Shopify store</option>}{merchants.map(merchant=><option value={merchant} key={merchant}>{merchant}</option>)}</select>:<span className="ac-sample-badge">No live offers</span>}</div>
      <form className="ac-search" onSubmit={e=>{e.preventDefault();search(query)}}><Search size={19}/><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="E.g. stylish headphones under $100" aria-label="What are you shopping for?" maxLength={180}/><button aria-label="Search merchant products" disabled={searching||query.trim().length<2||mode==='live'&&!liveReady}>{searching?<LoaderCircle size={18} className="ac-spin"/>:<Send size={18}/>}</button></form>
      <div className="ac-suggestions"><span>Try asking</span>{suggestions.map(t=><button key={t} onClick={()=>search(t)} disabled={searching||mode==='live'&&!liveReady}>{t} ↗</button>)}</div>
      {mode==='live'&&!liveReady&&<p className="ac-notice"><Lightbulb size={16}/>{loadingDirectory?'Checking merchant connections…':merchants.length&&!catalogConfigured?'The live catalog needs a published HTTPS UCP agent profile. Preview remains available.':'No reward-ready Shopify merchant is connected yet. Visit the merchant console or try Preview experience.'}</p>}
     </div>
     <aside className="ac-basket"><div className="ac-basket-head"><div><span className="ac-overline">YOUR CURATED BAG</span><h3>The good stuff.</h3></div><span className="ac-count">{cart.reduce((n,i)=>n+i.quantity,0)}</span></div>
      {cart.length===0?<div className="ac-empty-bag"><ShoppingBag size={34}/><strong>Nothing in your bag yet.</strong><p>Discover something you love and we'll build your cart together.</p></div>:<div className="ac-bag-items">{cart.map(item=><div className="ac-bag-line" key={item.variant.id}><div className="ac-bag-icon">✳</div><div className="ac-bag-info"><strong>{item.product.title}</strong><small>{item.variant.title}</small><div className="ac-quantity"><button onClick={()=>quantity(item.variant.id,-1)} aria-label="Remove one"><Minus size={12}/></button><b>{item.quantity}</b><button onClick={()=>quantity(item.variant.id,1)} aria-label="Add one" disabled={item.quantity>=10}><Plus size={12}/></button></div></div><strong>{currency(item.variant.priceMinor*item.quantity,item.variant.currency)}</strong></div>)}</div>}
      <div className="ac-bag-bottom"><div className="ac-total"><span>Estimated products subtotal</span><strong>{currency(cartTotal,cartCurrency)}</strong></div><div className="ac-reward-mini"><div className="ac-reward-mini-icon">↗</div><div><span>Potential {comeback?'comeback':'first-purchase'} reward</span><strong>{previewReward!==null?currency(previewReward):'USD orders only'}</strong><small>Illustrative · $10 max · subject to eligibility and budget</small></div></div><label className="ac-toggle"><input type="checkbox" checked={comeback} onChange={e=>setComeback(e.target.checked)}/><span>Preview 5% comeback rate <small>(not proof of eligibility)</small></span></label>
       {handoff?(mode==='preview'?<div className="ac-handoff"><Check size={16}/><div><strong>Journey preview ready</strong><p>No purchase occurred. With a real Shopify store connected, this step creates a checkout handoff, after which webhook verification and a reward claim can follow.</p><Link href="/protocol">See the proof protocol <ArrowUpRight size={13}/></Link></div></div>:<a href={link} className="ac-checkout-cta" target="_blank" rel="noopener noreferrer">Review & pay at merchant <ExternalLink size={16}/></a>):<button className="ac-checkout-cta" disabled={!cart.length||creating||mode==='live'&&!liveReady} onClick={createCart}>{creating?'Creating secure merchant cart…':mode==='preview'?'Preview checkout journey':'Create merchant cart'} <ArrowRight size={16}/></button>}
       <p className="ac-basket-disclaimer"><LockKeyhole size={13}/> Payment, taxes and shipping are confirmed at merchant checkout. We never collect card details.</p>
      </div></aside>
    </div>
    <div className="ac-catalog-head"><div><div className="ac-overline">DISCOVERED FOR YOU</div><h3>{mode==='preview'?'A little inspiration.':results.length?'Live from the merchant.':'Search for something great.'}</h3><p>{mode==='preview'?'Illustrative products for trying the user journey. Not actual Shopify listings.':'Variants, availability and pricing are read from the connected merchant catalog.'}</p></div><span className="ac-product-count"><SlidersHorizontal size={15}/>{shown.length} {shown.length===1?'item':'items'}</span></div>
    {error&&<div className="ac-error" role="alert"><X size={16}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss">×</button></div>}
    {shown.length?<div className="ac-products">{shown.map((p,i)=>{const v=p.variants.find(v=>v.id===(selectedVariants[p.id]||p.variants.find(v=>v.available)?.id));const priceMinor=v?.priceMinor??p.priceMinor;return <article className="ac-product" key={p.id}><div className={'ac-product-media ac-media-'+i%4}>{p.image?<img src={p.image} alt={p.title} loading="lazy" referrerPolicy="no-referrer"/>:<span aria-hidden>{productMark(i)}</span>}<span className="ac-product-source">{mode==='preview'?'SAMPLE ITEM':'SHOPIFY CATALOG'}</span></div><div className="ac-product-body"><div className="ac-product-price"><span>{currency(priceMinor,v?.currency||p.currency)}</span><span className="ac-product-reward">{(v?.currency||p.currency)==="USD"?`↗ ~${currency(reward(priceMinor,comeback?5:2))}*`:"USD rewards only"}</span></div><h4>{p.title}</h4><p>{p.description||'Explore the latest options from this merchant.'}</p>{p.variants.length>1&&<select value={selectedVariants[p.id]||v?.id} onChange={e=>setSelectedVariants(s=>({...s,[p.id]:e.target.value}))} aria-label={`Choose variant for ${p.title}`}>{p.variants.map(variant=><option key={variant.id} value={variant.id} disabled={!variant.available}>{variant.title}{!variant.available?' — unavailable':''}</option>)}</select>}<button className="ac-add" onClick={()=>add(p)} disabled={!v?.available}>Add to my bag <Plus size={15}/></button></div></article>})}</div>:<div className="ac-no-results"><Compass size={34}/><strong>Start with a question.</strong><p>Describe a product, occasion or budget to discover a participating merchant's catalog.</p></div>}
    <p className="ac-estimate-foot">*Rewards are illustrative. A second purchase is eligible for a higher rate only when the verified loyalty rules allow it. USD orders only for the Shopify reward pilot; mock-stock tokens on Base Sepolia have no equity value.</p>
   </section>
   <section className="ac-next"><div><div className="ac-overline">ONE CONTINUOUS OWNERSHIP JOURNEY</div><h2>Checkout is the beginning.<br/><em>Not the finish line.</em></h2><p>OWNBACK makes the reward journey clear, with no surprise wallet prompts at checkout.</p><div className="ac-next-actions"><Link href="/claim" className="ac-btn ac-btn-lime">Claim an eligible reward <ArrowRight size={16}/></Link><Link href="/shop" className="ac-btn ac-btn-outline">Explore Bankr research <ArrowUpRight size={16}/></Link></div></div><div className="ac-steps"><div><span>01</span><div><strong>Buy from the merchant</strong><small>Card, Shop Pay, or eligible store payment method</small></div><ShoppingBag size={19}/></div><div><span>02</span><div><strong>OWNBACK verifies the order</strong><small>Signed Shopify events, refund checks and budget rules</small></div><PackageCheck size={19}/></div><div><span>03</span><div><strong>Claim through your wallet</strong><small>No crypto wallet required during the purchase</small></div><Wallet size={19}/></div><div><span>04</span><div><strong>Explore financial intelligence</strong><small>Bankr research only; borrowing disabled</small></div><Bot size={19}/></div></div></section>
   <footer className="ac-footer"><Link href="/" className="ac-logo"><span>↗</span> OWNBACK<b>.</b></Link><div>Shop thoughtfully. Earn differently. Come back for more.</div><small>Base Sepolia prototype. No real equities, guaranteed rewards or automated loans.</small></footer>
  </div>
 </main>
}
