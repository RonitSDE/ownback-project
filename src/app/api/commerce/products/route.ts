import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/commerce/orders';
export const runtime='nodejs';
export async function GET(){try{return NextResponse.json({products:await listProducts()},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return NextResponse.json({error:'Store unavailable'},{status:503});}}
