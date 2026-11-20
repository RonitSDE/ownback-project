/** Shopify UCP Storefront Catalog + Cart MCP adapter.
 * Docs: https://shopify.dev/docs/agents/catalog/storefront-catalog
 *       https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp
 * This client does NOT collect buyer payment details or complete checkout.
 */
export type AgentProduct = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  priceMinor: number;
  currency: string;
  url: string | null;
  variants: {id:string;title:string;priceMinor:number;currency:string;available:boolean}[];
};
export type AgentCart = {id: string; continueUrl: string; totalMinor?: number; currency?: string};
const SHOP = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const VARIANT = /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/;

export function merchantDomain(domain:unknown):string {
  if(typeof domain!=='string' || domain.length>100)throw Error('Invalid merchant');
  const s=domain.trim().toLowerCase();
  if(!SHOP.test(s))throw Error('Invalid merchant');
  return s;
}
export function validateVariant(id:unknown):string {
  if(typeof id!=='string'||!VARIANT.test(id))throw Error('Invalid Shopify variant');
  return id;
}
export function validateBuyerLink(url:unknown,shop:string, extraHosts:string[]=[]):string {
  if(typeof url!=='string'||url.length>3000)throw Error('Missing merchant checkout link');
  const u=new URL(url);
  const allowed=[merchantDomain(shop),...extraHosts];
  if(u.protocol!=='https:' || u.username || u.password || !allowed.includes(u.hostname.toLowerCase()) || u.port)throw Error('Unexpected merchant checkout origin');
  return u.toString();
}
export function rewardPreview(priceMinor:number, comeback:boolean):{minor:number;rate:number} {
  if(!Number.isSafeInteger(priceMinor)||priceMinor<0)throw Error('Invalid price');
  const rate=comeback?5:2;
  return {minor:Math.min(1000,Math.floor((priceMinor*rate)/100)),rate};
}
function record(x:unknown):Record<string,unknown>{return x && typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};}
function imgUrl(src:unknown){try{if(typeof src!=='string')return null;const u=new URL(src);return u.protocol==='https:'?u.href:null;}catch{return null}}
function moneyMinor(raw:unknown):number|null{
  if(typeof raw!=='number' && !(typeof raw==='string' && /^\d+$/.test(raw)))return null;
  const num=Number(raw);return Number.isSafeInteger(num)&&num>=0&&num<=100_000_000?num:null;
}
export function normaliseCatalog(response:unknown):AgentProduct[]{
  const source=record(response);
  const rows=Array.isArray(source.products)?source.products:[];
  return rows.slice(0,18).flatMap((p:unknown)=>{
   const x=record(p), price=record(x.price_range),min=record(price.min),variants=Array.isArray(x.variants)?x.variants:[];
   const currency=typeof min.currency==='string'?min.currency:'USD';
   const priceMinor=moneyMinor(min.amount);
   if(typeof x.id!=='string'||typeof x.title!=='string'||priceMinor===null)return [];
   const safeVariants=variants.flatMap((v:unknown)=>{
     const item=record(v), amount=record(item.price), availability=record(item.availability);
     if(typeof item.id!=='string'||!VARIANT.test(item.id))return [];
     const n=moneyMinor(amount.amount);
     if(n===null)return [];
     return [{id:item.id,title:String(item.title||'Default').slice(0,100),priceMinor:n,currency:String(amount.currency||currency),available:availability.available===true}];
   });
   const media=Array.isArray(x.media)?x.media:[];
   const image=media.map((m:unknown)=>imgUrl(record(m).url)).find(Boolean)??null;
   const text=record(x.description);
   // Never render remote HTML, or invent a variant for a product without one.
   const description=typeof text.plain==='string'?text.plain:typeof text.html==='string'?text.html.replace(/<[^>]*>/g,' '):'';
   return [{id:x.id,title:x.title.slice(0,140),description:description.slice(0,300),image,priceMinor,currency,url:imgUrl(x.url),variants:safeVariants}];
  });
}
export function catalogItems(response:unknown):AgentProduct[]{
  return normaliseCatalog(response);
}
export function parseCart(response:unknown,shop:string,extraHosts:string[]=[]):AgentCart {
 const cart=record(record(response).cart);
 if(typeof cart.id!=='string'||cart.id.length<4)throw Error('Invalid cart response');
 const totals=record(cart.totals),total=record(totals.total), price=record(totals.subtotal);
 const amount=moneyMinor(total.amount??price.amount);
 return {id:cart.id,continueUrl:validateBuyerLink(cart.continue_url,shop,extraHosts),...(amount!==null?{totalMinor:amount,currency:String(total.currency||price.currency||'USD')}:{})};
}
export function permittedCheckoutHosts(env:string|undefined):string[]{
 return (env||'').split(',').map(v=>v.trim().toLowerCase()).filter(v=>/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(v)&&v.includes('.')&&!v.includes('..')&&!v.startsWith('.')&&!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)&&!v.endsWith('.local')&&!v.endsWith('.internal')&&!v.endsWith('.localhost')).slice(0,8);
}
export function ucpProfile(url:string|undefined):string{
 if(!url)throw Error('UCP_AGENT_PROFILE_URL must point to a public HTTPS profile');
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname==='localhost')throw Error('UCP profile must use public HTTPS');
 return u.toString();
}
export function unwrapMcp(json:unknown):Record<string,unknown>{
 const envelope=record(json);
 if(envelope.error||record(envelope.result).isError)throw Error('Merchant UCP request rejected');
 const data=record(record(envelope.result).structuredContent);
 if(!Object.keys(data).length)throw Error('Merchant returned no structured UCP data');
 return data;
}
export async function callShopifyUcp(shop:string,tool:'search_catalog'|'lookup_catalog'|'create_cart',args:Record<string,unknown>,profileUrl:string,fetcher:typeof fetch=fetch):Promise<Record<string,unknown>>{
  merchantDomain(shop);
  // Optional merchant primary storefront domain for one allowlisted pilot store. Do not
  // accept arbitrary endpoints, redirects, or browser-supplied domains.
  let host=shop;
  const configured=process.env.SHOPIFY_AGENT_STOREFRONT_HOST?.trim().toLowerCase();
  if(configured && shop===process.env.SHOPIFY_ALLOWED_SHOP?.trim().toLowerCase() && permittedCheckoutHosts(process.env.SHOPIFY_AGENT_ALLOWED_CHECKOUT_HOSTS).includes(configured))host=configured;
  const result=await fetcher(`https://${host}/api/ucp/mcp`,{
   method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:{meta:{'ucp-agent':{profile:ucpProfile(profileUrl)}},...args}}})
  });
  if(!result.ok)throw Error(`Merchant UCP HTTP ${result.status}`);
  return unwrapMcp(await result.json());
}
