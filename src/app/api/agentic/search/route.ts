import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {callShopifyUcp,normaliseCatalog} from '@/lib/agentic/ucp';
import {requireActiveAgentShop} from '@/lib/agentic/shops';
import {rateLimit,clientIp} from '@/lib/server/rate-limit';
export const runtime='nodejs';
const bodySchema=z.object({shop:z.string(),query:z.string().trim().min(2).max(180)}).strict();
export async function POST(req:NextRequest){
 const limit=rateLimit(`agentic:search:${clientIp(req)}`,12,60000);
 if(!limit.ok)return NextResponse.json({error:'Too many searches; try again shortly.'},{status:429,headers:{'Retry-After':String(limit.retryAfter)}});
 const parsed=bodySchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Please enter a valid shopping request.'},{status:400});
 try{
  const shop=await requireActiveAgentShop(parsed.data.shop);
  const data=await callShopifyUcp(shop,'search_catalog',{catalog:{query:parsed.data.query,pagination:{limit:12}}},process.env.UCP_AGENT_PROFILE_URL||'');
  return NextResponse.json({products:normaliseCatalog(data),merchant:shop,source:'shopify-ucp-live',note:'Prices and availability can change at merchant checkout. Reward estimates are illustrative.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('[Agentic search]',e instanceof Error?e.message:'Unknown error');
  return NextResponse.json({error:'Live merchant search is unavailable. Check that the shop supports UCP and the agent profile is published.'},{status:503});
 }
}
