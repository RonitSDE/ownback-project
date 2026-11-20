'use client';

import type { Address, EIP1193Provider, Hash } from 'viem';
import { ownbackAbi, usdcAbi } from './abi';
import { addresses, campaignId } from './config';
import { publicClient, send } from './wallet';

const FAUCET_LIMIT = 10_000_000_000n; // 10,000 test USDC per faucet call

type Ctx = { provider: EIP1193Provider; account: Address };

/** Approve exactly `amount` for OWNBACK if the current allowance is short. Never unlimited. */
async function ensureAllowance({ provider, account }: Ctx, amount: bigint) {
  const allowance = await publicClient.readContract({
    address: addresses.usdc!,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [account, addresses.ownback!],
  });
  if (allowance >= amount) return;
  await send({
    provider,
    account,
    address: addresses.usdc!,
    abi: usdcAbi,
    functionName: 'approve',
    args: [addresses.ownback!, amount],
  });
}

export async function fundCampaign(ctx: Ctx, amount: bigint): Promise<Hash> {
  const balance = await publicClient.readContract({
    address: addresses.usdc!,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [ctx.account],
  });
  if (balance < amount) {
    const shortfall = amount - balance;
    if (shortfall > FAUCET_LIMIT)
      throw new Error('Fund at most $10,000 more than your test USDC balance at a time.');
    await send({
      ...ctx,
      address: addresses.usdc!,
      abi: usdcAbi,
      functionName: 'faucet',
      args: [ctx.account, shortfall],
    });
  }
  await ensureAllowance(ctx, amount);
  return send({
    ...ctx,
    address: addresses.ownback!,
    abi: ownbackAbi,
    functionName: 'fund',
    args: [campaignId, amount],
  });
}

export function withdrawAvailable(ctx: Ctx, amount: bigint): Promise<Hash> {
  return send({
    ...ctx,
    address: addresses.ownback!,
    abi: ownbackAbi,
    functionName: 'withdraw',
    args: [campaignId, amount],
  });
}

export function setRewardsPaused(ctx: Ctx, paused: boolean): Promise<Hash> {
  return send({
    ...ctx,
    address: addresses.ownback!,
    abi: ownbackAbi,
    functionName: 'setPaused',
    args: [campaignId, paused],
  });
}

export async function refundOrder(ctx: Ctx, purchaseId: bigint, amount: bigint): Promise<Hash> {
  await ensureAllowance(ctx, amount);
  return send({
    ...ctx,
    address: addresses.ownback!,
    abi: ownbackAbi,
    functionName: 'refund',
    args: [purchaseId],
  });
}
