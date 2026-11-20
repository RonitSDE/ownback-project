import type { Hex } from 'viem';

/**
 * A checkout intent is created before the wallet prompt and persisted, so a reload, a dropped
 * connection or a double-click can never produce a second payment:
 *  - the same orderRef is reused until the intent completes or expires (the contract rejects a
 *    reused orderRef from the same payer, so a duplicate submission cannot charge twice);
 *  - once submitted, the tx hash is stored and checked before anything is sent again;
 *  - after `deadline` the contract rejects the payment (QuoteExpired), so an unconfirmed intent is
 *    provably dead and safe to discard.
 */
export type CheckoutIntent = {
  orderRef: Hex;
  deadline: number; // unix seconds, mirrors the on-chain quoteDeadline
  minReward: string; // decimal string of the reward floor (bigint is not JSON-safe)
  hash?: Hex;
};

export const INTENT_TTL_SECONDS = 15 * 60;

export type ReceiptLookup = 'success' | 'reverted' | 'not-found';

export type IntentDecision =
  | { action: 'already-paid'; hash: Hex }
  | { action: 'wait'; hash: Hex; retryAfter: number }
  | { action: 'reuse'; intent: CheckoutIntent }
  | { action: 'create' };

/** Pure decision: what to do with a stored intent before paying again. */
export function decideIntent(
  stored: CheckoutIntent | null,
  receipt: ReceiptLookup | null,
  nowSeconds: number,
  minReward: bigint,
): IntentDecision {
  if (!stored) return { action: 'create' };
  if (stored.hash) {
    if (receipt === 'success') return { action: 'already-paid', hash: stored.hash };
    if (receipt === 'not-found' && stored.deadline > nowSeconds) {
      return { action: 'wait', hash: stored.hash, retryAfter: stored.deadline };
    }
    return { action: 'create' }; // reverted, or pending past its deadline (cannot execute any more)
  }
  // Never submitted. Reuse only while valid and for the same promised reward.
  if (stored.deadline > nowSeconds + 60 && stored.minReward === minReward.toString()) {
    return { action: 'reuse', intent: stored };
  }
  return { action: 'create' };
}

export function newIntent(nowSeconds: number, minReward: bigint, random: Uint8Array): CheckoutIntent {
  if (random.length !== 32) throw new Error('orderRef needs 32 random bytes');
  const hex = Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('');
  return { orderRef: `0x${hex}`, deadline: nowSeconds + INTENT_TTL_SECONDS, minReward: minReward.toString() };
}

export function intentKey(parts: { contract: string; campaignId: bigint; account: string; amount: bigint }) {
  return `ownback:intent:v2:${parts.contract.toLowerCase()}:${parts.campaignId}:${parts.account.toLowerCase()}:${parts.amount}`;
}

export function parseStoredIntent(raw: string | null): CheckoutIntent | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CheckoutIntent>;
    const okRef = typeof v.orderRef === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v.orderRef);
    const okHash = v.hash === undefined || (typeof v.hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v.hash));
    if (!okRef || !okHash || typeof v.deadline !== 'number' || typeof v.minReward !== 'string') return null;
    return v as CheckoutIntent;
  } catch {
    return null;
  }
}
