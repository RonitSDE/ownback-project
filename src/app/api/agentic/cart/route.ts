import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {callShopifyUcp,parseCart,validateVariant,permittedCheckoutHosts,normaliseCatalog} from '@/lib/agentic/ucp';
import {requireActiveAgentShop} from '@/lib/agentic/shops';
import {rateLimit,clientIp} from '@/lib/server/rate-limit';
export const runtime='nodejs';
const schema=z.object({shop:z.string(),items:z.array(z.object({variantId:z.string(),quantity:z.number().int().min(1).max(10)})).min(1).max(6)}).strict();
export async function POST(req:NextRequest){
 const limited=rateLimit(`agentic:cart:${clientIp(req)}`,5,60000);
 if(!limited.ok)return NextResponse.json({error:'Cart creation limit reached. Try again shortly.'},{status:429,headers:{'Retry-After':String(limited.retryAfter)}});
 const p=schema.safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:'Invalid cart items.'},{status:400});
 try{
  const shop=await requireActiveAgentShop(p.data.shop);
  const ids=p.data.items.map(item=>validateVariant(item.variantId));
  if(new Set(ids).size!==ids.length)return NextResponse.json({error:'Merge duplicate items before checkout.'},{status:400});
  // Reject nonexistent and unavailable variants before creating a cart.
  const catalog=await callShopifyUcp(shop,'lookup_catalog',{catalog:{ids}},process.env.UCP_AGENT_PROFILE_URL||'');
  const variants=normaliseCatalog(catalog).flatMap(product=>product.variants);
  for(const id of ids){if(!variants.some(v=>v.id===id&&v.available))return NextResponse.json({error:'A selected product is no longer available. Please refresh search.'},{status:409});}
  const result=await callShopifyUcp(shop,'create_cart',{cart:{line_items:p.data.items.map(i=>({quantity:i.quantity,item:{id:i.variantId}})),attribution:{utm_source:'ownback',utm_medium:'agentic',utm_campaign:'ownership-discovery'}}},process.env.UCP_AGENT_PROFILE_URL||'');
  const cart=parseCart(result,shop,permittedCheckoutHosts(process.env.SHOPIFY_AGENT_ALLOWED_CHECKOUT_HOSTS));
  // No server-side payment completion. The buyer reviews and pays on Shopify.
  return NextResponse.json({cart,merchant:shop,mode:'buyer-handoff',note:'You will review and pay directly at the merchant. No reward is issued before a verified order.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('[Agentic cart]',e instanceof Error?e.message:'Unknown error');
  return NextResponse.json({error:'Merchant cart is unavailable or returned an unapproved checkout origin.'},{status:503});
 }
}
