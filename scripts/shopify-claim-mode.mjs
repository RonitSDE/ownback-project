/** Isolated and testable fail-closed policy for the Shopify email claim worker.
 * Not a mainnet real-equity authorization mechanism. */
export function assertShopifyClaimMode(env = process.env) {
  const chain = env.SHOPIFY_REWARD_CHAIN_ID || '84532';
  if (chain === '8453') {
    throw new Error('MAINNET_SHOPIFY_CLAIMS_DISABLED: this email/claim workflow is testnet-only; a separately reviewed live-stock claim service is required');
  }
  if (!['31337', '84532'].includes(chain)) throw new Error('Unsupported Shopify claim chain');
  if (env.SHOPIFY_LIVE_STOCK_ENABLED === 'true' || env.NEXT_PUBLIC_LIVE_STOCK_ENABLED === 'true') {
    throw new Error('MOCK_STOCK_ONLY: Shopify testnet claims cannot advertise real B20 equities');
  }
  return {chainId: Number(chain), asset: 'TESTNET / MOCK STOCK', mainnetClaimsAllowed: false};
}
