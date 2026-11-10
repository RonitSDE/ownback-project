import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {reconcileOpen} from '@/lib/commerce/orders';
import {indexPayments} from '@/lib/commerce/indexer';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const actual=req.headers.get('authorization')||'';const expected=`Bearer ${process.env.COMMERCE_CRON_SECRET||''}`;
 const a=createHash('sha256').update(actual).digest(),b=createHash('sha256').update(expected).digest();
 if(!process.env.COMMERCE_CRON_SECRET||process.env.COMMERCE_CRON_SECRET.length<32||!timingSafeEqual(a,b))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const indexed=await indexPayments(4);const results=await reconcileOpen(100);return NextResponse.json({indexed,results});}catch(e){console.error(e);return NextResponse.json({error:'Reconciliation failed'},{status:503});}
}
