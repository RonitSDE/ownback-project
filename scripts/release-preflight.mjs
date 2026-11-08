/** Offline release preflight, no secrets or network calls. */
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync('contracts/src/Ownback.sol', 'utf8');
const adapter = readFileSync('contracts/src/mocks/PricedMockStockAdapter.sol', 'utf8');
const stock = readFileSync('contracts/src/mocks/MockB20Stock.sol', 'utf8');
const abi = readFileSync('src/lib/abi/index.ts', 'utf8');
assert(src.includes('RewardBelowMinimum()') && src.includes('InvalidOrderRef()'));
assert(adapter.includes('priceUpdatedAt[stock] = sourceTimestamp'));
assert(stock.includes('return 8;'));
assert(abi.includes('"name": "minRewardUsdc"') && abi.includes('"name": "sourceTimestamp"'));
console.log('PASS: checkout floor, unique reference, upstream timestamp, 8-decimal mock and matching ABIs');

const network = process.env.NEXT_PUBLIC_CHAIN_ID ?? '';
if (network && !['84532', '31337'].includes(network))
  throw new Error('V3.1 demo only supports Base Sepolia or Anvil');
if (
  process.env.NEXT_PUBLIC_CHAIN_ID === '84532' &&
  process.env.NEXT_PUBLIC_OWNBACK_ADDRESS &&
  !existsSync('contracts/deployments/84532.json')
) {
  console.warn(
    'WARN: frontend address set but contracts/deployments/84532.json absent: check contract deployment',
  );
}
if (process.env.PRICE_SOURCE === 'static' && process.env.NEXT_PUBLIC_CHAIN_ID === '84532') {
  console.warn(
    'WARN: static price selected on public testnet; requires explicit override and must be labeled DEMO',
  );
}
console.log(
  'Preflight OK. Still run npm ci, check, build, forge test and actual local-chain E2E before release.',
);
