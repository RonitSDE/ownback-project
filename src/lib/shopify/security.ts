import { createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
export const shopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
export function validatedShop(input:string):string {
 const shop=input.trim().toLowerCase();
 if(!shopPattern.test(shop) || shop.length>100)throw Error('Invalid Shopify shop domain');
 return shop;
}
function sharedSecret(){const secret=process.env.SHOPIFY_CLIENT_SECRET;if(!secret)throw Error('SHOPIFY_CLIENT_SECRET not configured');return secret;}
export function timingEqual(a:string,b:string):boolean{
 const x=Buffer.from(a), y=Buffer.from(b);
 return x.length===y.length && timingSafeEqual(x,y);
}
export function verifyWebhook(raw:string,hmac:string):boolean{
 if(!hmac)return false;
 const digest=createHmac('sha256',sharedSecret()).update(raw,'utf8').digest('base64');
 return timingEqual(digest,hmac);
}
export function verifyOAuth(params:URLSearchParams):boolean {
 const hmac=params.get('hmac') ?? '';
 if(!/^[a-fA-F0-9]{64}$/.test(hmac))return false;
 const message=[...params.entries()].filter(([k])=>!['hmac','signature'].includes(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&');
 const digest=createHmac('sha256',sharedSecret()).update(message).digest('hex');
 return timingEqual(digest,hmac);
}
export function customerHash(shop:string,customerId:string):`0x${string}`{
 const secret=process.env.SHOPIFY_CUSTOMER_SECRET;
 if(!secret||secret.length<32)throw Error('SHOPIFY_CUSTOMER_SECRET must be 32+ characters');
 if(!customerId||customerId==='undefined')throw Error('Shopify customer ID required');
 return `0x${createHmac('sha256',secret).update(`${shop}:${customerId}`).digest('hex')}`;
}
function encryptionKey(){const hex=process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || '';
 if(!/^[a-fA-F0-9]{64}$/.test(hex))throw Error('SHOPIFY_TOKEN_ENCRYPTION_KEY must be a 32-byte hex key');
 return Buffer.from(hex,'hex');
}
export function encryptToken(token:string):string{
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const ciphertext=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),ciphertext].map(x=>x.toString('base64url')).join('.');
}
export function decryptToken(input:string):string{
 const parts=input.split('.'); if(parts.length!==3)throw Error('Invalid stored Shopify token');
 const [iv,tag,body]=parts.map(x=>Buffer.from(x,'base64url'));
 const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
}
export function issueToken(){const token=randomBytes(32).toString('hex');return {token,digest:tokenDigest(token)};}
export function tokenDigest(token:string){return createHash('sha256').update(token).digest('hex');}
export function usdToBaseUnits(amount:string):bigint{
 if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(amount))throw Error('Invalid USD amount');
 const [whole,fraction='']=amount.split('.'); const result=BigInt(whole)*1_000_000n+BigInt(fraction.padEnd(2,'0'))*10_000n;
 if(result<=0n)throw Error('Amount must be positive'); return result;
}
export function orderHash(shop:string,orderId:string){return `0x${createHash('sha256').update(`ownback:shopify:v1:${shop}:${orderId}`).digest('hex')}` as `0x${string}`;}
