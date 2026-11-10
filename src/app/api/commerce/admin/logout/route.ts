import { NextRequest,NextResponse } from 'next/server';
import { clearSession,sameOrigin } from '@/lib/commerce/auth';
export async function POST(req:NextRequest){if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});return clearSession(NextResponse.json({ok:true}));}
