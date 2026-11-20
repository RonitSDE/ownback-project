import { createHmac, timingSafeEqual } from 'node:crypto';
export const SYMBOLS=['AAPLc','NVDAc','TSLAc','MSFTc','GOOGLc','AMZNc'] as const;
export function validSymbol(value:unknown):value is string{return typeof value==='string' && SYMBOLS.includes(value as typeof SYMBOLS[number]);}
export function researchPrompt(symbol:string){if(!validSymbol(symbol))throw new Error('Unsupported token');return `Read-only research task. No transactions, transfers, swaps, approvals or borrowing. Explain whether ${symbol} on Base has any publicly verifiable lending market; cite protocol and risk factors. Do NOT assume token eligibility or price, do NOT rely on wallet balances or personal positions, do NOT claim any loan is available. If uncertain say unverified. Output a short educational research note only.`;}
const hx=/^[0-9a-f]{64}$/;
export function makeJobToken(jobId:string, expiry:number, secret:string){return createHmac('sha256',secret).update(`${jobId}:${expiry}`).digest('hex');}
export function verifyJobToken(jobId:string, expiry:number,token:string,secret:string){if(!hx.test(token)||!Number.isSafeInteger(expiry)||expiry < Math.floor(Date.now()/1000)||expiry > Math.floor(Date.now()/1000)+7200)return false;const a=Buffer.from(token,'hex'),b=Buffer.from(makeJobToken(jobId,expiry,secret),'hex');return timingSafeEqual(a,b);}
