import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const abiSource = read('src/lib/abi/index.ts');
const contract = read('contracts/src/Ownback.sol');
const adapter = read('contracts/src/mocks/PricedMockStockAdapter.sol');
const mock = read('contracts/src/mocks/MockB20Stock.sol');

test('checkout Solidity: nonzero ref, reward floor never downgraded, deadline, per-payer refs', () => {
  assert.match(contract, /if \(orderRef == bytes32\(0\)\) revert InvalidOrderRef\(\)/);
  // A reward below what the customer was shown always reverts; 0 is an explicit no-reward opt-in.
  assert.match(contract, /if \(reward < minRewardUsdc\) revert RewardBelowMinimum\(\)/);
  assert.match(contract, /if \(quoteDeadline < block\.timestamp/);
  // Order references are namespaced by payer so they cannot be griefed by a front-runner.
  assert.match(contract, /orderRefUsed\[campaignId\]\[msg\.sender\]\[orderRef\]/);
});
test('admin ownership is two-step', () => {
  assert.match(contract, /contract Ownback is Ownable2Step/);
  assert.match(adapter, /contract PricedMockStockAdapter is IStockAdapter, Ownable2Step/);
});
test('committed ABI includes new five-input checkout', () => {
  const abi = JSON.parse(abiSource.match(/export const ownbackAbi = (\[[\s\S]*?\]) as const;/)[1]);
  const pay = abi.find((entry) => entry.type === 'function' && entry.name === 'pay');
  assert.deepEqual(
    pay.inputs.map((v) => v.type),
    ['uint256', 'uint128', 'bytes32', 'uint128', 'uint64'],
  );
});
test('committed adapter ABI preserves original upstream timestamp', () => {
  const abi = JSON.parse(abiSource.match(/export const adapterAbi = (\[[\s\S]*?\]) as const;/)[1]);
  const setPrice = abi.find((entry) => entry.type === 'function' && entry.name === 'setPrice');
  assert.deepEqual(
    setPrice.inputs.map((v) => v.type),
    ['address', 'uint256', 'uint256'],
  );
  assert.match(adapter, /priceUpdatedAt\[stock\] = sourceTimestamp;/);
  assert.match(adapter, /STALE_SOURCE_PRICE/);
});
test('mock stock uses eight decimals and a separate multiplier', () => {
  assert.match(mock, /return 8;/);
  assert.match(mock, /multiplier = 1e18/);
});
