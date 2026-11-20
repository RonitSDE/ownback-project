import {NextRequest,NextResponse} from 'next/server';
import {confirmOrder, CommerceError} from '@/lib/commerce/orders';
import {sameOrigin} from '@/lib/commerce/auth';
import {enforceLimit} from '@/lib/commerce/limits';
import type {Hex} from 'viem';
export const runtime='nodejs';
export async function POST(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 try{const {id}=await ctx.params;await enforceLimit('order-confirm',id,12,15);const token=req.headers.get('x-order-token')||'';const {txHash}=await req.json();
  return NextResponse.json(await confirmOrder(id,token,txHash as Hex));
 }catch(e){console.error('confirm order',e);return NextResponse.json({error:e instanceof CommerceError?e.message:'Payment confirmation unavailable; keep your transaction hash'},{status:e instanceof CommerceError?e.status:503});}
}
