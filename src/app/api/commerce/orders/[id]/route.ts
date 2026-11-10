import { NextRequest,NextResponse } from 'next/server';
import { getOrder, CommerceError } from '@/lib/commerce/orders';
export const runtime='nodejs';
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{const {id}=await ctx.params;const token=req.headers.get('x-order-token')||'';return NextResponse.json(await getOrder(id,token),{headers:{'Cache-Control':'no-store'}})}
 catch(e){return NextResponse.json({error:e instanceof CommerceError?e.message:'Order unavailable'},{status:e instanceof CommerceError?e.status:503});}
}
