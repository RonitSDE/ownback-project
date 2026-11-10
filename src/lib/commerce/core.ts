import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { keccak256, toHex, type Hex } from 'viem';
export type Line = { productId: string; quantity: number };
export const PURCHASE_WINDOW_SECONDS = 15 * 60;
export function canonicalCart(raw: unknown): Line[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) throw new Error('Cart must have 1–20 lines');
  const found = new Set<string>();
  return raw.map((r: unknown) => {
    const v = r as Record<string, unknown>;
    if (!v || typeof v.productId !== 'string' || !/^[0-9a-f-]{36}$/i.test(v.productId) ||
      !Number.isInteger(v.quantity) || Number(v.quantity) < 1 || Number(v.quantity) > 20 || found.has(v.productId)) {
      throw new Error('Invalid or duplicate cart line');
    }
    found.add(v.productId);
    return {productId: v.productId, quantity: Number(v.quantity)};
  }).sort((a,b)=>a.productId.localeCompare(b.productId));
}
export function totalFor(lines: {quantity:number; unit_usdc: number | string | bigint}[]): bigint {
  const total = lines.reduce((sum,l)=>sum + BigInt(l.unit_usdc)*BigInt(l.quantity), 0n);
  if (total<=0n || total > (2n**128n -1n)) throw new Error('Invalid checkout total');
  return total;
}
export function receiptToken() { return randomBytes(32).toString('hex'); }
export function hashSecret(raw: string) { return createHash('sha256').update(raw).digest('hex'); }
export function equalSecret(a:string,b:string) {
  const x = Buffer.from(hashSecret(a),'hex'), y = Buffer.from(b,'hex');
  return y.length === x.length && timingSafeEqual(x,y);
}
export function orderReference(id: string, chainId: number, vault: string, campaign: string): Hex {
  return keccak256(toHex(`OWNBACK:COMMERCE:V4:${chainId}:${vault.toLowerCase()}:${campaign}:${id}`));
}
export function needsManualReview(status:string) { return status==='AWAITING_PAYMENT'; }
