import { NextResponse } from 'next/server';
import { getBankrClient, isBankrConfigured } from '@/lib/bankr/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){let available=false;let detail='Read-only Bankr research needs a configured scoped API key.';
 if(isBankrConfigured() && process.env.BANKR_RESEARCH_ENABLED==='true')try{await getBankrClient()!.me();available=true;detail='Read-only research connected; customer borrowing disabled.'}catch{detail='Bankr key is unavailable or rejected.'}
 return NextResponse.json({providers:[{id:'direct',label:'Own-wallet lending explorer',available:true,detail:'External link; not an executed loan.'},{id:'bankr',label:'Bankr research',available,detail}],borrowingEnabled:false},{headers:{'Cache-Control':'no-store'}});
}
