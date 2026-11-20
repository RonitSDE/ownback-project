'use client';

import { useCallback, useState } from 'react';
import type { Address, EIP1193Provider, Hash } from 'viem';
import { ownbackAbi, usdcAbi } from '@/lib/abi';
import { addresses, campaignId } from '@/lib/config';
import {
  decideIntent,
  intentKey,
  newIntent,
  parseStoredIntent,
  type CheckoutIntent,
  type ReceiptLookup,
} from '@/lib/checkout-intent';
import { publicClient, send } from '@/lib/wallet';

export type CheckoutStep = 'idle' | 'approve' | 'sign' | 'confirming' | 'done';

/**
 * Chain time, not the device clock: the contract checks quoteDeadline against block.timestamp,
 * so a phone that is minutes off would otherwise produce payments that revert as expired.
 */
async function chainNow(): Promise<number> {
  const block = await publicClient.getBlock({ blockTag: 'latest' });
  return Number(block.timestamp);
}

async function lookupReceipt(hash: Hash): Promise<ReceiptLookup> {
  try {
    const r = await publicClient.getTransactionReceipt({ hash });
    return r.status === 'success' ? 'success' : 'reverted';
  } catch {
    return 'not-found';
  }
}

/**
 * Idempotent checkout. See lib/checkout-intent.ts for the guarantees; this hook only wires
 * storage, the wallet and the chain around that pure decision function.
 */
export function useCheckout() {
  const [step, setStep] = useState<CheckoutStep>('idle');

  const pay = useCallback(
    async (p: {
      provider: EIP1193Provider;
      account: Address;
      amount: bigint;
      minReward: bigint; // reward shown to the customer; 0 only after explicit opt-in
    }): Promise<{ hash: Hash; alreadyPaid: boolean }> => {
      const ownback = addresses.ownback!;
      const key = intentKey({ contract: ownback, campaignId, account: p.account, amount: p.amount });
      const stored = parseStoredIntent(localStorage.getItem(key));
      const receipt = stored?.hash ? await lookupReceipt(stored.hash) : null;
      const now = await chainNow();
      const decision = decideIntent(stored, receipt, now, p.minReward);

      if (decision.action === 'already-paid') {
        localStorage.removeItem(key);
        setStep('done');
        return { hash: decision.hash, alreadyPaid: true };
      }
      if (decision.action === 'wait') {
        const minutes = Math.max(1, Math.ceil((decision.retryAfter - now) / 60));
        throw new Error(
          `Your earlier payment is still confirming. Check your wallet, or retry in about ${minutes} min.`,
        );
      }

      const intent: CheckoutIntent =
        decision.action === 'reuse'
          ? decision.intent
          : newIntent(now, p.minReward, crypto.getRandomValues(new Uint8Array(32)));
      localStorage.setItem(key, JSON.stringify(intent));

      try {
        // Read allowance fresh from chain; approve only the exact amount, never unlimited.
        const allowance = await publicClient.readContract({
          address: addresses.usdc!,
          abi: usdcAbi,
          functionName: 'allowance',
          args: [p.account, ownback],
        });
        if (allowance < p.amount) {
          setStep('approve');
          await send({
            provider: p.provider,
            account: p.account,
            address: addresses.usdc!,
            abi: usdcAbi,
            functionName: 'approve',
            args: [ownback, p.amount],
          });
        }

        setStep('sign');
        const hash = await send({
          provider: p.provider,
          account: p.account,
          address: ownback,
          abi: ownbackAbi,
          functionName: 'pay',
          args: [campaignId, p.amount, intent.orderRef, p.minReward, BigInt(intent.deadline)],
          onSubmitted: (tx) => {
            setStep('confirming');
            localStorage.setItem(key, JSON.stringify({ ...intent, hash: tx }));
          },
        });
        localStorage.removeItem(key);
        setStep('done');
        return { hash, alreadyPaid: false };
      } catch (err) {
        setStep('idle');
        throw err;
      }
    },
    [],
  );

  return { step, pay, reset: () => setStep('idle') };
}
