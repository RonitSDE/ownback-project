/** Safe public local-chain config; uses only contract deployment addresses. No private keys. */
import { readFileSync, writeFileSync } from 'node:fs';
import { isAddress } from 'viem';

const d = JSON.parse(readFileSync('contracts/deployments/31337.json', 'utf8'));
if (d.chainId !== 31337 || ![d.ownback, d.usdc, d.stock, d.adapter].every(isAddress)) {
  throw new Error('Invalid local deployment JSON');
}
const text = [
  '# Auto-generated for local Anvil. Do NOT commit this file.',
  'NEXT_PUBLIC_CHAIN_ID=31337',
  'NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545',
  `NEXT_PUBLIC_OWNBACK_ADDRESS=${d.ownback}`,
  `NEXT_PUBLIC_USDC_ADDRESS=${d.usdc}`,
  `NEXT_PUBLIC_STOCK_ADDRESS=${d.stock}`,
  `NEXT_PUBLIC_ADAPTER_ADDRESS=${d.adapter}`,
  `NEXT_PUBLIC_CAMPAIGN_ID=${d.campaignId}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK=${d.deployBlock}`,
  'NEXT_PUBLIC_STOCK_SYMBOL=AAPLc',
  '',
].join('\n');
writeFileSync('.env.local', text, { mode: 0o600 });
console.log('Wrote local public contract config to .env.local');
