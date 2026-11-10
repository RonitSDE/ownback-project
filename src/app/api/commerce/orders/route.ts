import { NextRequest,NextResponse } from 'next/server';
import { createOrder, CommerceError } from '@/lib/commerce/orders';
import { sameOrigin } from '@/lib/commerce/auth';
import { enforceLimit } from '@/lib/commerce/limits';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403});
 try {
  const raw=await req.text();if(raw.length>20000)return NextResponse.json({error:'Cart too large'},{status:413});
  const input=JSON.parse(raw);
  await enforceLimit('checkout-wallet',String(input.wallet||'unknown'),8,15);
  const order=await createOrder(input);
  return NextResponse.json(order,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('create order',e);return NextResponse.json({error:e instanceof CommerceError?e.message:'Unable to reserve order'},{status:e instanceof CommerceError?e.status:503});}
}
