/**
 * OWNBACK v3.1: stateless, crash-recoverable testnet settlement service.
 * Every run re-reads chain purchase IDs, verifying each is still PAID with a reserved reward.
 * This supports all campaigns using the configured mock stock, including new merchant campaigns.
 * Trade-off: O(historical purchases) RPC reads. Use an indexed durable queue for production scale.
 * No Shopify or offchain purchase oracle is involved in v3.1.
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, foundry } from 'viem/chains';
import { Attribution } from 'ox/erc8021';
import { adapterAbi, ownbackAbi } from '../src/lib/abi';
import { fetchTokenizedStocks, requireFreshObservation, toUsdc6 } from '../src/lib/prices';

type Deployment = {
  chainId: number;
  ownback: Address;
  adapter: Address;
  stock: Address;
  campaignId: number;
  deployBlock: number;
};

const once = process.argv.includes('--once');

function addressFrom(value: string | undefined): Address | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
}

/** File when present (local, CI). Env addresses when the server image has no deployment JSON. */
function loadDeployment(): Deployment {
  const explicit = process.env.DEPLOYMENT_FILE;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`DEPLOYMENT_FILE not found: ${explicit}`);
    return JSON.parse(readFileSync(explicit, 'utf8'));
  }
  const fallback = 'contracts/deployments/84532.json';
  if (existsSync(fallback)) return JSON.parse(readFileSync(fallback, 'utf8'));

  const ownback =
    addressFrom(process.env.OWNBACK_ADDRESS) ?? addressFrom(process.env.NEXT_PUBLIC_OWNBACK_ADDRESS);
  const adapter =
    addressFrom(process.env.ADAPTER_ADDRESS) ?? addressFrom(process.env.NEXT_PUBLIC_ADAPTER_ADDRESS);
  const stock = addressFrom(process.env.STOCK_ADDRESS) ?? addressFrom(process.env.NEXT_PUBLIC_STOCK_ADDRESS);
  if (!ownback || !adapter || !stock) {
    throw new Error(
      'Keeper has no deployment file and no contract addresses. Set DEPLOYMENT_FILE, or OWNBACK_ADDRESS, ADAPTER_ADDRESS and STOCK_ADDRESS.',
    );
  }
  return {
    chainId: Number(process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? '84532'),
    ownback,
    adapter,
    stock,
    campaignId: Number(process.env.CAMPAIGN_ID ?? process.env.NEXT_PUBLIC_CAMPAIGN_ID ?? '1'),
    deployBlock: Number(process.env.DEPLOY_BLOCK ?? process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? '0'),
  };
}

const deployment: Deployment = loadDeployment();
if (![31337, 84532].includes(deployment.chainId)) throw new Error('Unsupported chain for testnet keeper');
const chain = deployment.chainId === foundry.id ? foundry : baseSepolia;
const rpc = process.env.RPC_URL ?? chain.rpcUrls.default.http[0];
const pk = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
if (!pk) throw new Error('KEEPER_PRIVATE_KEY is required');
const account = privateKeyToAccount(pk);
const publicClient = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({ chain, transport: http(rpc), account });
const dataSuffix = process.env.BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [process.env.BUILDER_CODE] })
  : undefined;
const PRICE_SOURCE = process.env.PRICE_SOURCE ?? 'coinbase';
const SYMBOL = process.env.STOCK_SYMBOL ?? 'AAPLc';
const DRIFT_BPS = 25n;
const MAX_SCAN = Number(process.env.KEEPER_MAX_PURCHASES ?? '10000');
const CONFIRMATIONS = chain.id === 31337 ? 1 : 2;
const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

async function targetPrice(
  nowSeconds: number,
  maxAgeSeconds: number,
): Promise<{ price: bigint; observedAt: bigint }> {
  if (PRICE_SOURCE === 'static') {
    // Local/recorded demo only. Never use a static price on Base Sepolia without explicit override.
    if (deployment.chainId !== 31337 && process.env.ALLOW_TESTNET_STATIC_PRICE !== 'true') {
      throw new Error('Static price on public testnet disabled by default');
    }
    const v = process.env.STATIC_PRICE_USDC;
    if (!v || BigInt(v) <= 0n) throw new Error('STATIC_PRICE_USDC must be positive');
    return { price: BigInt(v), observedAt: BigInt(nowSeconds) };
  }
  if (PRICE_SOURCE !== 'coinbase') throw new Error('Unknown PRICE_SOURCE');
  const quotes = await fetchTokenizedStocks();
  const q = quotes.find((x) => x.symbol === SYMBOL);
  if (!q) throw new Error(`${SYMBOL} not found in source response`);
  const ageLimit = Math.min(maxAgeSeconds, Number(process.env.MAX_SOURCE_AGE_SECONDS ?? maxAgeSeconds));
  const observedAt = requireFreshObservation(q, nowSeconds, ageLimit);
  return { price: toUsdc6(q.navPrice), observedAt: BigInt(observedAt) };
}

async function syncPrice() {
  const [current, updatedAt, maxAge, block] = await Promise.all([
    publicClient.readContract({
      address: deployment.adapter,
      abi: adapterAbi,
      functionName: 'priceUsdc',
      args: [deployment.stock],
    }),
    publicClient.readContract({
      address: deployment.adapter,
      abi: adapterAbi,
      functionName: 'priceUpdatedAt',
      args: [deployment.stock],
    }),
    publicClient.readContract({ address: deployment.adapter, abi: adapterAbi, functionName: 'maxPriceAge' }),
    publicClient.getBlock(),
  ]);
  let next: { price: bigint; observedAt: bigint };
  try {
    next = await targetPrice(Number(block.timestamp), Number(maxAge));
  } catch (err) {
    log('No fresh external price; no publishing:', (err as Error).message);
    return;
  }
  if (next.observedAt === updatedAt && next.price === current) return;
  const age = block.timestamp - updatedAt;
  const drift =
    current === 0n
      ? 10_000n
      : ((next.price > current ? next.price - current : current - next.price) * 10_000n) / current;
  if (drift < DRIFT_BPS && age < maxAge / 2n) return;
  const { request } = await publicClient.simulateContract({
    account,
    address: deployment.adapter,
    abi: adapterAbi,
    functionName: 'setPrice',
    args: [deployment.stock, next.price, next.observedAt],
  });
  const hash = await wallet.writeContract({ ...request, dataSuffix });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
  if (receipt.status !== 'success') throw new Error(`Price update reverted ${hash}`);
  log(
    `Price ${SYMBOL}: $${Number(next.price) / 1e6}, source=${new Date(Number(next.observedAt) * 1000).toISOString()}, tx=${hash}`,
  );
}

async function settleDue() {
  const [nextId, block] = await Promise.all([
    publicClient.readContract({
      address: deployment.ownback,
      abi: ownbackAbi,
      functionName: 'nextPurchaseId',
    }),
    publicClient.getBlock(),
  ]);
  if (nextId > BigInt(MAX_SCAN) + 1n) {
    throw new Error(
      `Too many purchases (${nextId - 1n}) for stateless pilot keeper; deploy an indexed queue`,
    );
  }
  const campaigns = new Map<bigint, Awaited<ReturnType<typeof getCampaign>>>();
  async function getCampaign(id: bigint) {
    return publicClient.readContract({
      address: deployment.ownback,
      abi: ownbackAbi,
      functionName: 'getCampaign',
      args: [id],
    });
  }
  for (let id = 1n; id < nextId; id++) {
    const p = await publicClient.readContract({
      address: deployment.ownback,
      abi: ownbackAbi,
      functionName: 'getPurchase',
      args: [id],
    });
    if (p.status !== 0 || p.kind === 0 || p.reward === 0n) continue;
    let campaign = campaigns.get(p.campaignId);
    if (!campaign) {
      campaign = await getCampaign(p.campaignId);
      campaigns.set(p.campaignId, campaign);
    }
    if (block.timestamp < p.paidAt + BigInt(campaign.holdSeconds)) continue;
    // Only the registered demo stock receives a priced mock quote. Other token campaigns
    // require a separately validated adapter configuration.
    if (campaign.stock.toLowerCase() !== deployment.stock.toLowerCase()) {
      log(`Skipping purchase ${id}: unsupported stock ${campaign.stock}`);
      continue;
    }
    try {
      const quote = await publicClient.readContract({
        address: deployment.adapter,
        abi: adapterAbi,
        functionName: 'quote',
        args: [campaign.stock, p.reward],
      });
      const minOut = (quote * 995n) / 1000n || 1n;
      const { request } = await publicClient.simulateContract({
        account,
        address: deployment.ownback,
        abi: ownbackAbi,
        functionName: 'settle',
        args: [id, minOut],
      });
      const hash = await wallet.writeContract({ ...request, dataSuffix });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: CONFIRMATIONS });
      if (receipt.status !== 'success') throw new Error(`Settlement reverted ${hash}`);
      log(
        `Delivered campaign #${p.campaignId} purchase #${id}, reward ${p.reward} USDC base units, tx ${hash}`,
      );
    } catch (err) {
      log(`Pending reward #${id}:`, (err as Error).message.split('\n')[0]);
    }
  }
}

async function pass() {
  await syncPrice();
  await settleDue();
}
async function main() {
  log(`Testnet keeper ${account.address}, chain=${chain.id}, source=${PRICE_SOURCE}`);
  if (once) return pass();
  const interval = Number(process.env.KEEPER_INTERVAL_MS ?? 60_000);
  for (;;) {
    try {
      await pass();
    } catch (err) {
      log('Keeper pass failed:', (err as Error).message);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
