import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
const cookieName='ob_merchant';
const ttl=8*3600;
function sign(message:string){return createHmac('sha256',process.env.COMMERCE_SESSION_SECRET ?? '').update(message).digest('hex');}
export function verifiedAdminPassword(pass: string) {
  const expected = process.env.COMMERCE_ADMIN_PASSWORD;
  if (!expected || !process.env.COMMERCE_SESSION_SECRET || expected.length < 20 || pass.length > 1000) return false;
  const a=createHmac('sha256',expected).update('login').digest();
  const b=createHmac('sha256',pass).update('login').digest();
  return timingSafeEqual(a,b);
}
export function adminSessionToken(now = Date.now()){const payload=Math.floor(now/1000+ttl).toString();return `${payload}.${sign(payload)}`;}
export function validSession(s:string|undefined){
  if(!s || !process.env.COMMERCE_SESSION_SECRET || process.env.COMMERCE_SESSION_SECRET.length<32) return false;
  const m=/^(\d{10})\.([0-9a-f]{64})$/.exec(s); if(!m) return false;
  if(Number(m[1]) < Date.now()/1000 || Number(m[1]) > Date.now()/1000+ttl+120) return false;
  const x=Buffer.from(sign(m[1]),'hex'); const y=Buffer.from(m[2],'hex');
  return timingSafeEqual(x,y);
}
export async function adminAuthorized(){return validSession((await cookies()).get(cookieName)?.value);}
export function attachSession(res:NextResponse){res.cookies.set(cookieName,adminSessionToken(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:ttl});return res;}
export function clearSession(res:NextResponse){res.cookies.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});return res;}
export function sameOrigin(req:NextRequest){
  const origin=req.headers.get('origin');
  const allowed=process.env.APP_ORIGIN;
  // Mutating browser requests MUST provide an Origin header.
  return Boolean(origin && allowed && origin===allowed);
}
export async function serverOrigin(){return (await headers()).get('host')}
