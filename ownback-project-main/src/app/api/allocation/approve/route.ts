/** User-signed *preference receipt* only. No delegated authorization, custody or transfer. */
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAddress, isHex, verifyMessage, type Address, type Hex } from 'viem';
import { pool } from '@/lib/commerce/db';
import { sameOrigin } from '@/lib/commerce/auth';
import { clientIp, rateLimit, sweepRateLimits } from '@/lib/server/rate-limit';
import { buildAllocationProposal, validateAllocationInput, allocationApprovalMessage } from '@/lib/allocation/policy';
import { allocationCapabilities } from '@/lib/allocation/capabilities';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  if (!sameOrigin(req))return NextResponse.json({error:'Untrusted origin.'},{status:403});
  if(process.env.OWNBACK_PREFERENCE_RECEIPTS_ENABLED!=='true')return NextResponse.json({error:'Preference receipt storage not enabled. Preview only.'},{status:503});
  sweepRateLimits();const rate=rateLimit(`alloc-approve:${clientIp(req)}`,8,60_000);
  if(!rate.ok)return NextResponse.json({error:'Too many approvals.'},{status:429});
  const raw=await req.text();if(raw.length>4000)return NextResponse.json({error:'Request too large.'},{status:413});
  let body:Record<string,unknown>;try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid object');body=value as Record<string,unknown>}catch{return NextResponse.json({error:'Invalid JSON object.'},{status:400})}
  const parsed=validateAllocationInput(body.input);
  if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400});
  const {wallet,signature,nonce,expiresAt}=body;
  if(typeof wallet!=='string'||!isAddress(wallet)||typeof signature!=='string'||!isHex(signature)||
    typeof nonce!=='string'||!/^\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b$/.test(nonce)||
    typeof expiresAt!=='number'||!Number.isSafeInteger(expiresAt)||expiresAt<Date.now()+1000||expiresAt>Date.now()+10*60_000)
    return NextResponse.json({error:'Invalid or expired preference proof.'},{status:400});
  const c=allocationCapabilities();const proposal=buildAllocationProposal(parsed.input,c);
  if(proposal.status!=='proposed'||!proposal.stock)return NextResponse.json({error:'Refused policy cannot be approved.',reasons:proposal.reasons},{status:422});
  const origin=process.env.APP_ORIGIN?.replace(/\/$/,'');
  if(!origin||!/^https:\/\//.test(origin) && !/^http:\/\/localhost(?::\d+)?$/.test(origin))return NextResponse.json({error:'Trusted origin is missing.'},{status:503});
  const message=allocationApprovalMessage({origin,wallet,nonce,expiresAt,proposal,input:parsed.input});
  let valid=false;
  try{valid=await verifyMessage({address:wallet as Address,message,signature:signature as Hex});}catch{valid=false;}
  if(!valid)return NextResponse.json({error:'Wallet signature did not match the server policy.'},{status:401});
  const digest=createHash('sha256').update(message).digest('hex');
  try{
    const result=await pool.query(`INSERT INTO allocation_preferences
      (wallet,origin,nonce,chain_id,stock,reward_cents,payload_digest,verified_signature,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9/1000.0))
      ON CONFLICT(wallet,nonce) DO NOTHING RETURNING id,status,created_at`,[
      wallet.toLowerCase(),origin,nonce,c.chainId,proposal.stock,Math.round(parsed.input.rewardUsd*100),digest,signature.toLowerCase(),expiresAt
    ]);
    if(!result.rowCount)return NextResponse.json({error:'This one-time preference was already recorded.'},{status:409});
    return NextResponse.json({receiptId:result.rows[0].id,digest,status:'RECORDED_NOT_EXECUTED',chainId:c.chainId,
      message:'Preference recorded. No stock acquired, funds moved, or trading authority granted.'},
      {headers:{'Cache-Control':'no-store, private'}});
  }catch(e){console.error('allocation receipt storage failed',e);return NextResponse.json({error:'Receipt storage unavailable; no preference recorded.'},{status:503});}
}
