import type { Address, Chain, Hex } from 'viem';
import { baseSepolia, foundry } from 'viem/chains';
import { Attribution } from 'ox/erc8021';

// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? baseSepolia.id);

export const chain: Chain = chainId === foundry.id ? foundry : baseSepolia;

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

export const isConfigured = Object.values(addresses).every(Boolean);

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
