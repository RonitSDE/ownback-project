/** Optional Bankr research. Untrusted research text is never used for allocation permission. */
import { NextRequest, NextResponse } from 'next/server';
import { getBankrClient } from '@/lib/bankr/server';
import { makeJobToken, verifyJobToken } from '@/lib/bankr/research';
import { STOCK_RESEARCH, type StockSymbol } from '@/lib/allocation/policy';
import { sameOrigin } from '@/lib/commerce/auth';
import { clientIp, rateLimit, sweepRateLimits } from '@/lib/server/rate-limit';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const secret=()=>process.env.BANKR_JOB_TOKEN_SECRET||'';
const enabled=()=>process.env.BANKR_RESEARCH_ENABLED==='true'&&secret().length>=32;
export async function POST(req:NextRequest){
  if(!sameOrigin(req))return NextResponse.json({error:'Untrusted origin.'},{status:403});
  if(!enabled())return NextResponse.json({error:'Optional Bankr research not configured.'},{status:503});
  const client=getBankrClient();if(!client)return NextResponse.json({error:'Bankr is not connected.'},{status:503});
  sweepRateLimits();const rate=rateLimit(`alloc-research:${clientIp(req)}`,3,60_000);
  if(!rate.ok)return NextResponse.json({error:'Research rate limit reached.'},{status:429});
  const raw=await req.text();if(raw.length>300)return NextResponse.json({error:'Request too large.'},{status:413});
  let body:Record<string,unknown>;try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid object');body=value as Record<string,unknown>}catch{return NextResponse.json({error:'Invalid JSON object.'},{status:400})}
  const symbol=body.symbol;
  if(symbol!=='AAPLc' && symbol!=='NVDAc')return NextResponse.json({error:'Unsupported token.'},{status:400});
  const doc=STOCK_RESEARCH[symbol];
  const prompt=`READ ONLY. Never trade, transact, approve, transfer, or borrow. Research ${symbol} tokenized stock availability and issuer transfer restrictions on Base. Verify (do not assume) whether it can be delivered to eligible recipients. Discuss concentration, market hours, corporate action multiplier and total-return reference feeds. Separate FACTS, ASSUMPTIONS, and OPINIONS. Cite clickable public source URLs with dates, especially ${doc.assetReference} and ${doc.implementationReference}. Never give a stock price, execution guarantee, eligibility decision, or personalized investment recommendation. If something cannot be verified say UNVERIFIED. No investor private data is provided.`;
  try{const job=await client.prompt(prompt);const expiry=Math.floor(Date.now()/1000)+600;
    return NextResponse.json({jobId:job.jobId,token:`${expiry}.${makeJobToken(job.jobId,expiry,secret())}`,status:'pending'},
    {headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Research service unavailable.'},{status:502});}
}
export async function GET(req:NextRequest){
  if(!enabled())return NextResponse.json({error:'Research unavailable.'},{status:503});
  const u=new URL(req.url),jobId=u.searchParams.get('jobId')||'',token=u.searchParams.get('token')||'';
  const [e,mac]=token.split('.');if(!/^job_[a-zA-Z0-9_-]{1,120}$/.test(jobId)||!verifyJobToken(jobId,Number(e),mac||'',secret()))
    return NextResponse.json({error:'Invalid or expired research token.'},{status:403});
  const client=getBankrClient();if(!client)return NextResponse.json({error:'Bankr unavailable.'},{status:503});
  try{const job=await client.job(jobId);return NextResponse.json({status:job.status,
    research:job.status==='completed'?(job.response||'No analysis returned.').slice(0,12000):undefined,
    notice:'Unverified AI-generated research, not execution or suitability advice. Check every citation independently.',
    executionVerified:false},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return NextResponse.json({error:'Research could not be retrieved.'},{status:502})}
}
