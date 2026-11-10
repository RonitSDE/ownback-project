import {NextResponse} from 'next/server';
import {activeAgentShops} from '@/lib/agentic/shops';
export const runtime='nodejs';
export async function GET(){
 try{return NextResponse.json({merchants:await activeAgentShops(),live:Boolean(process.env.UCP_AGENT_PROFILE_URL)}, {headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({merchants:[],live:false,reason:'Merchant directory currently unavailable'}, {status:503});}
}
