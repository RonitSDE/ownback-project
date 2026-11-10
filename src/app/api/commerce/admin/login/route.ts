import { NextRequest, NextResponse } from 'next/server';
import { verifiedAdminPassword, attachSession, sameOrigin } from '@/lib/commerce/auth';
import { enforceLimit } from '@/lib/commerce/limits';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 try{await enforceLimit('merchant-login',req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',8,15);const {password}=await req.json();if(typeof password!=='string'||!verifiedAdminPassword(password))return NextResponse.json({error:'Invalid credentials'},{status:401});
  return attachSession(NextResponse.json({ok:true}));
 }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}
