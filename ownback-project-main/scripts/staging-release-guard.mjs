/** Defensive environment check before deploying the Base Sepolia competition pilot.
 * No RPC/private keys needed. Run with actual staging env populated. */
export function inspectStagingConfig(env = process.env) {
  const errors = [];
  const chain = String(env.NEXT_PUBLIC_CHAIN_ID || '');
  if (chain !== '84532') errors.push('NEXT_PUBLIC_CHAIN_ID must be 84532 (Base Sepolia)');
  const shopify = String(env.SHOPIFY_REWARD_CHAIN_ID || '');
  if (shopify !== '84532') errors.push('SHOPIFY_REWARD_CHAIN_ID must be 84532 for staging');
  const commerce = String(env.COMMERCE_CHAIN_ID || '');
  if (commerce !== '84532') errors.push('COMMERCE_CHAIN_ID must be 84532 for staging');
  for (const key of ['MAINNET_DEPLOY_APPROVED', 'MAINNET_OPERATIONS_APPROVED', 'SHOPIFY_LIVE_STOCK_ENABLED', 'COMMERCE_LIVE_STOCK_ENABLED', 'NEXT_PUBLIC_LIVE_STOCK_ENABLED']) {
    if (env[key] === 'true') errors.push(`${key} must not be true in the mock-stock release`);
  }
  const code = env.BUILDER_CODE?.trim();
  const publicCode = env.NEXT_PUBLIC_BUILDER_CODE?.trim();
  if (!code || !publicCode || code !== publicCode || !/^[\x21-\x7e]{1,128}$/.test(code) || code.includes(','))
    errors.push('BUILDER_CODE and NEXT_PUBLIC_BUILDER_CODE must match a valid, nonempty code');
  if (env.OWNBACK_REQUIRE_BUILDER_CODE !== 'true' || env.NEXT_PUBLIC_REQUIRE_BUILDER_CODE !== 'true')
    errors.push('Both attribution-required flags must be true');
  const addresses = ['NEXT_PUBLIC_OWNBACK_ADDRESS', 'NEXT_PUBLIC_ADAPTER_ADDRESS'];
  for (const key of addresses) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(env[key] || '') || /^0x0{40}$/i.test(env[key] || ''))
      errors.push(`${key} must be a deployed testnet address`);
  }
  return {ok: errors.length === 0, errors, target: 'BASE_SEPOLIA / MOCK STOCK'};
}

if (process.argv[1]?.endsWith('/staging-release-guard.mjs')) {
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile('.env'); } catch { /* CI sets variables directly. */ }
  }
  const report = inspectStagingConfig(process.env);
  if (!report.ok) {
    console.error('STAGING CONFIG NO-GO:', report.errors.join(' | '));
    process.exitCode = 1;
  } else {
    console.log('STAGING CONFIG PASS — configuration only, not deployment/RPC/stock proof');
  }
}
