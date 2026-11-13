/** Private shopper history, requested via time-limited wallet signature.
 * A public wallet address alone never reveals pseudonymous Shopify order history.
 */
import {NextRequest,NextResponse} from 'next/server';
import {isAddress,isHex,verifyMessage,type Address,type Hex} from 'viem';
import {sameOrigin} from '@/lib/commerce/auth';
import {enforceLimit} from '@/lib/commerce/limits';
import {pool} from '@/lib/commerce/db';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
 try{
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  await enforceLimit('portfolio-read',ip,12,15);
  const {wallet,expiresAt,signature}=await req.json() as {wallet:string;expiresAt:number;signature:string};
  if(!isAddress(wallet)||!isHex(signature)||!Number.isSafeInteger(expiresAt))return NextResponse.json({error:'Invalid access proof'},{status:400});
  if(expiresAt<Date.now()||expiresAt>Date.now()+120000)return NextResponse.json({error:'Portfolio proof expired'},{status:401});
  const origin=(process.env.APP_ORIGIN||'').replace(/\/$/,'');
  if(!origin)throw new Error('Missing APP_ORIGIN');
  const message=`OWNBACK Portfolio Access\nOrigin: ${origin}\nWallet: ${wallet.toLowerCase()}\nExpires: ${expiresAt}\nRead only. No transaction authority.`;
  const valid=await verifyMessage({address:wallet as Address,message,signature:signature as Hex});
  if(!valid)return NextResponse.json({error:'Wallet signature rejected'},{status:401});
  const {rows}=await pool.query(`SELECT shop_domain,order_id,order_label,paid_at,status,reward_kind,reward_usdc,tx_hash,stock_amount
   FROM shopify_reward_orders WHERE wallet=$1 AND status IN ('CLAIMED','SETTLING','DELIVERED','REFUNDED_AFTER_DELIVERY','FAILED')
   ORDER BY paid_at DESC LIMIT 100`,[wallet.toLowerCase()]);
  return NextResponse.json({source:'shopify_claimed_wallet',wallet:wallet.toLowerCase(),asset:process.env.SHOPIFY_REWARD_CHAIN_ID==='8453'?'Base mainnet B20, only after confirmed transfer':'Base Sepolia synthetic mock stock',
   orders:rows.map(r=>({...r,reward_usdc:r.reward_usdc===null?null:String(r.reward_usdc),
    tx_hash:['DELIVERED','REFUNDED_AFTER_DELIVERY'].includes(r.status)?r.tx_hash:null,
    stock_amount:['DELIVERED','REFUNDED_AFTER_DELIVERY'].includes(r.status)?r.stock_amount:null})),
   notice:'Claimed is not delivered. Check an onchain settlement receipt before treating rewards as owned.'},
   {headers:{'Cache-Control':'no-store, private'}});
 }catch(e){console.error('Portfolio access unavailable',e);return NextResponse.json({error:'Unable to verify portfolio access'},{status:503});}
}
