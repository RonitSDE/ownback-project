'use client';

import { getAbiItem, type Address, type Hash } from 'viem';
import { adapterAbi, ownbackAbi, stockAbi, usdcAbi } from './abi';
import { addresses, campaignId, deployBlock } from './config';
import { publicClient } from './wallet';

export type Campaign = {
  merchant: Address;
  stock: Address;
  funded: bigint;
  spent: bigint;
  reserved: bigint;
  withdrawn: bigint;
  maxReward: bigint;
  minOrder: bigint;
  firstBps: number;
  comebackBps: number;
  expiresAt: bigint;
  holdSeconds: number;
  returnWindow: number;
  paused: boolean;
  available: bigint;
};

export type PurchaseRow = {
  id: bigint;
  customer: Address;
  amount: bigint;
  reward: bigint;
  paidAt: number;
  kind: number;
  status: number;
  payTx: Hash;
  settleTx?: Hash;
  delivered?: bigint;
};

const purchasedEvent = getAbiItem({ abi: ownbackAbi, name: 'Purchased' });
const deliveredEvent = getAbiItem({ abi: ownbackAbi, name: 'RewardDelivered' });

function must<T>(v: T | undefined, name: string): T {
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export async function readCampaign(): Promise<Campaign> {
  const ownback = must(addresses.ownback, 'NEXT_PUBLIC_OWNBACK_ADDRESS');
  const [c, available] = await Promise.all([
    publicClient.readContract({
      address: ownback,
      abi: ownbackAbi,
      functionName: 'getCampaign',
      args: [campaignId],
    }),
    publicClient.readContract({
      address: ownback,
      abi: ownbackAbi,
      functionName: 'available',
      args: [campaignId],
    }),
  ]);
  return { ...c, available };
}

export async function readPrice() {
  const adapter = must(addresses.adapter, 'NEXT_PUBLIC_ADAPTER_ADDRESS');
  const stock = must(addresses.stock, 'NEXT_PUBLIC_STOCK_ADDRESS');
  const [price, updatedAt, maxAge, multiplier, symbol] = await Promise.all([
    publicClient.readContract({
      address: adapter,
      abi: adapterAbi,
      functionName: 'priceUsdc',
      args: [stock],
    }),
    publicClient.readContract({
      address: adapter,
      abi: adapterAbi,
      functionName: 'priceUpdatedAt',
      args: [stock],
    }),
    publicClient.readContract({ address: adapter, abi: adapterAbi, functionName: 'maxPriceAge' }),
    publicClient.readContract({ address: stock, abi: stockAbi, functionName: 'multiplier' }),
    publicClient.readContract({ address: stock, abi: stockAbi, functionName: 'symbol' }),
  ]);
  return { price, updatedAt: Number(updatedAt), maxAge: Number(maxAge), multiplier, symbol };
}

export async function readBalances(account: Address) {
  const usdc = must(addresses.usdc, 'NEXT_PUBLIC_USDC_ADDRESS');
  const stock = must(addresses.stock, 'NEXT_PUBLIC_STOCK_ADDRESS');
  const ownback = must(addresses.ownback, 'NEXT_PUBLIC_OWNBACK_ADDRESS');
  const [usdcBalance, allowance, stockBalance, stockShares] = await Promise.all([
    publicClient.readContract({ address: usdc, abi: usdcAbi, functionName: 'balanceOf', args: [account] }),
    publicClient.readContract({
      address: usdc,
      abi: usdcAbi,
      functionName: 'allowance',
      args: [account, ownback],
    }),
    publicClient.readContract({ address: stock, abi: stockAbi, functionName: 'balanceOf', args: [account] }),
    publicClient.readContract({
      address: stock,
      abi: stockAbi,
      functionName: 'balanceOfUI',
      args: [account],
    }),
  ]);
  return { usdcBalance, allowance, stockBalance, stockShares };
}

export async function previewReward(account: Address, amount: bigint) {
  const ownback = must(addresses.ownback, 'NEXT_PUBLIC_OWNBACK_ADDRESS');
  const [kind, reward] = await publicClient.readContract({
    address: ownback,
    abi: ownbackAbi,
    functionName: 'previewReward',
    args: [campaignId, account, amount],
  });
  return { kind: Number(kind), reward };
}

/** Public RPCs cap eth_getLogs ranges, so scan in chunks. */
async function chunkedLogs<T>(fetchRange: (from: bigint, to: bigint) => Promise<T[]>): Promise<T[]> {
  // cacheTime 0: viem caches the block number by default, which would cut off the newest logs.
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const out: T[] = [];
  let step = 50_000n;
  for (let from = deployBlock; from <= latest;) {
    const to = from + step - 1n > latest ? latest : from + step - 1n;
    try {
      out.push(...(await fetchRange(from, to)));
      from = to + 1n;
    } catch (err) {
      if (step <= 1_000n) throw err;
      step /= 5n; // RPC refused the range; retry smaller
    }
  }
  return out;
}

/** All purchases in the campaign, optionally for one customer, newest first. */
export async function readPurchases(customer?: Address): Promise<PurchaseRow[]> {
  const ownback = must(addresses.ownback, 'NEXT_PUBLIC_OWNBACK_ADDRESS');
  const args = customer ? { campaignId, customer } : { campaignId };

  const [paid, delivered] = await Promise.all([
    chunkedLogs((fromBlock, toBlock) =>
      publicClient.getLogs({ address: ownback, event: purchasedEvent, args, fromBlock, toBlock }),
    ),
    chunkedLogs((fromBlock, toBlock) =>
      publicClient.getLogs({ address: ownback, event: deliveredEvent, args, fromBlock, toBlock }),
    ),
  ]);

  const settleByPurchase = new Map<bigint, { tx: Hash; delivered: bigint }>();
  for (const log of delivered) {
    settleByPurchase.set(log.args.purchaseId!, {
      tx: log.transactionHash,
      delivered: log.args.stockDelivered!,
    });
  }

  const rows = await Promise.all(
    paid.map(async (log) => {
      const id = log.args.purchaseId!;
      // Current state (refunds and voided comebacks change it after the Purchased event).
      const p = await publicClient.readContract({
        address: ownback,
        abi: ownbackAbi,
        functionName: 'getPurchase',
        args: [id],
      });
      const settle = settleByPurchase.get(id);
      return {
        id,
        customer: p.customer,
        amount: p.amount,
        reward: p.reward,
        paidAt: Number(p.paidAt),
        kind: Number(p.kind),
        status: Number(p.status),
        payTx: log.transactionHash,
        settleTx: settle?.tx,
        delivered: settle?.delivered,
      } satisfies PurchaseRow;
    }),
  );
  return rows.sort((a, b) => Number(b.id - a.id));
}
