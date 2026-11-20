import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Attribution } from 'ox/erc8021';
import { base, baseSepolia, foundry } from 'viem/chains';
const chainId = Number(process.env.SHOPIFY_REWARD_CHAIN_ID || '84532');
if (![31337, 84532, 8453].includes(chainId)) throw Error('Unsupported Shopify reward network');
if (
  chainId === 8453 &&
  (process.env.SHOPIFY_LIVE_STOCK_ENABLED !== 'true' || process.env.MAINNET_OPERATIONS_APPROVED !== 'true')
)
  throw Error('Mainnet Shopify rewards are not operationally approved');
export const shopifyChain = chainId === 31337 ? foundry : chainId === 8453 ? base : baseSepolia;
export const shopifyClient = createPublicClient({
  chain: shopifyChain,
  transport: http(process.env.SHOPIFY_REWARD_RPC_URL || process.env.COMMERCE_RPC_URL),
});
export const shopifyVaultAbi = parseAbi([
  'function paidOrder(bytes32 hash) view returns(bool)',
  'function available() view returns(uint256)',
  'function firstPurchaseTime(bytes32 customerHash) view returns(uint64)',
  'function comebackPaid(bytes32 customerHash) view returns(bool)',
  'function quote(uint256,bool) view returns(uint256)',
  'function deliver(bytes32 orderHash,bytes32 customerHash,address recipient,uint128 orderValue,uint64 purchasedAt,bool comeback,uint256 minOut) returns(uint256)',
  'function fund(uint256 amount)',
  'event RewardDelivered(bytes32 indexed orderHash,bytes32 indexed customerHash,address indexed wallet,uint256 usdcReward,uint256 tokenOut,bool comeback)',
]);
export function shopifyVaultAddress(): Address {
  const value = process.env.SHOPIFY_REWARD_VAULT_ADDRESS;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value || '')) throw Error('SHOPIFY_REWARD_VAULT_ADDRESS not configured');
  return value as Address;
}
/** ERC-8021 attribution for the worker's own signed delivery transactions.
 * Never label a transaction attributed unless a confirmed receipt's calldata proves it.
 */
export function shopifyBuilderDataSuffix(): Hex | undefined {
  const code = process.env.BUILDER_CODE?.trim();
  const required = shopifyChain.id === 8453 || process.env.OWNBACK_REQUIRE_BUILDER_CODE === 'true';
  if (!code) {
    if (required) throw new Error('BUILDER_CODE is required for attributed Shopify settlement');
    return undefined; // offline/local development only; never count as attributed
  }
  if (!/^[\x21-\x7e]{1,128}$/.test(code) || code.includes(',')) {
    throw new Error('Invalid BUILDER_CODE; expected a single printable ASCII code without commas');
  }
  return Attribution.toDataSuffix({ codes: [code] });
}

export function executorWallet() {
  shopifyBuilderDataSuffix(); // fail closed before making a wallet for approved releases
  const key = process.env.SHOPIFY_REWARD_EXECUTOR_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key || '')) throw Error('Shopify reward executor key missing');
  const account = privateKeyToAccount(key as Hex);
  return createWalletClient({
    account,
    chain: shopifyChain,
    transport: http(process.env.SHOPIFY_REWARD_RPC_URL || process.env.COMMERCE_RPC_URL),
  });
}
