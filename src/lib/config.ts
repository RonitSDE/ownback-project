import type { Address, Chain, Hex } from 'viem';
import { base, baseSepolia, foundry } from 'viem/chains';
import { Attribution } from 'ox/erc8021';

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? baseSepolia.id);

if (!([foundry.id, baseSepolia.id, base.id] as number[]).includes(chainId)) {
  throw new Error(`Unsupported OWNBACK chain ${chainId}`);
}
if (chainId === base.id && process.env.NEXT_PUBLIC_LIVE_STOCK_ENABLED !== 'true') {
  throw new Error('Mainnet storefront requires explicit NEXT_PUBLIC_LIVE_STOCK_ENABLED=true');
}
export const chain: Chain = chainId === foundry.id ? foundry : chainId === base.id ? base : baseSepolia;
export const isMainnet = chain.id === base.id;


export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0];

function addr(value: string | undefined): Address | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
}

export const addresses = {
  ownback: addr(process.env.NEXT_PUBLIC_OWNBACK_ADDRESS),
  usdc: addr(process.env.NEXT_PUBLIC_USDC_ADDRESS),
  stock: addr(process.env.NEXT_PUBLIC_STOCK_ADDRESS),
  adapter: addr(process.env.NEXT_PUBLIC_ADAPTER_ADDRESS),
};

export const isConfigured = Object.values(addresses).every(Boolean) &&
  (!isMainnet || addresses.usdc?.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');

export const campaignId = BigInt(process.env.NEXT_PUBLIC_CAMPAIGN_ID ?? '1');

/** Block the contracts were deployed at, so log scans don't start from genesis. */
export const deployBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? '0');

/** Mainnet Coinbase tokenized stock the testnet mock mirrors (price + multiplier). */
export const mirroredSymbol = process.env.NEXT_PUBLIC_STOCK_SYMBOL ?? 'AAPLc';

/** ERC-8021 Builder Code suffix appended to every transaction for Base attribution. */
export const builderDataSuffix: Hex | undefined = (() => {
  const code = process.env.NEXT_PUBLIC_BUILDER_CODE;
  if (!code) return undefined;
  try {
    return Attribution.toDataSuffix({ codes: [code] });
  } catch {
    console.warn('Invalid NEXT_PUBLIC_BUILDER_CODE; transactions will not be attributed.');
    return undefined;
  }
})();

export function txUrl(hash: string) {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/tx/${hash}` : undefined;
}

export function addressUrl(address: string) {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/address/${address}` : undefined;
}
