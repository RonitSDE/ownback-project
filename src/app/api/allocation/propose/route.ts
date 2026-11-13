import { NextRequest, NextResponse } from 'next/server';
import { buildAllocationProposal, validateAllocationInput } from '@/lib/allocation/policy';
import { allocationCapabilities } from '@/lib/allocation/capabilities';
import { sameOrigin } from '@/lib/commerce/auth';
import { clientIp, rateLimit, sweepRateLimits } from '@/lib/server/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Untrusted origin.' }, {status:403});
  sweepRateLimits();
  const limit=rateLimit(`alloc-propose:${clientIp(req)}`,20,60_000);
  if (!limit.ok) return NextResponse.json({error:'Rate limit exceeded.'},{status:429});
  const raw=await req.text();
  if(raw.length>2000)return NextResponse.json({error:'Request too large.'},{status:413});
  let body:unknown;
  try{body=JSON.parse(raw)}catch{return NextResponse.json({error:'Malformed request.'},{status:400})}
  const parsed=validateAllocationInput(body);
  if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400});
  return NextResponse.json({proposal:buildAllocationProposal(parsed.input,allocationCapabilities()),input:parsed.input,preferenceReceiptsEnabled:process.env.OWNBACK_PREFERENCE_RECEIPTS_ENABLED==='true'},
    {headers:{'Cache-Control':'private, no-store'}});
}
