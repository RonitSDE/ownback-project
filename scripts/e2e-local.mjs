/**
 * End-to-end run against a local anvil chain using the real deploy output and the real keeper.
 *   anvil &   # in another terminal
 *   cd contracts && forge script script/DeployTestnet.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 *   npm run e2e:local
 * Uses anvil's default dev keys (public, testnet-only).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const d = JSON.parse(readFileSync('contracts/deployments/31337.json', 'utf8'));
const KEYS = {
  merchant: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  keeper: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  alice: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  bob: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
};

const ob = parseAbi([
  'function pay(uint256,uint128,bytes32,uint128,uint64) returns (uint256)',
  'function settle(uint256,uint256) returns (uint256)',
  'function refund(uint256)',
  'function available(uint256) view returns (uint256)',
  'function nextPurchaseId() view returns (uint256)',
  'function nextCampaignId() view returns (uint256)',
  'function createCampaign(address,uint96,uint96,uint16,uint16,uint64,uint32,uint32) returns (uint256)',
  'function fund(uint256,uint128)',
  'function getPurchase(uint256) view returns ((uint256 campaignId,address customer,uint128 amount,uint128 reward,uint64 paidAt,uint8 kind,uint8 status,bytes32 orderRef))',
  'function getCampaign(uint256) view returns ((address merchant,address stock,uint128 funded,uint128 spent,uint128 reserved,uint128 withdrawn,uint96 maxReward,uint96 minOrder,uint16 firstBps,uint16 comebackBps,uint64 expiresAt,uint32 holdSeconds,uint32 returnWindow,bool paused))',
]);
const erc20 = parseAbi([
  'function faucet(address,uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
]);

const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
const testClient = createTestClient({ chain: foundry, mode: 'anvil', transport: http(RPC) });
const wallet = (who) =>
  createWalletClient({ chain: foundry, transport: http(RPC), account: privateKeyToAccount(KEYS[who]) });
const addr = (who) => privateKeyToAccount(KEYS[who]).address;

async function tx(who, address, abi, functionName, args) {
  const { request } = await pub.simulateContract({
    account: privateKeyToAccount(KEYS[who]),
    address,
    abi,
    functionName,
    args,
  });
  const hash = await wallet(who).writeContract(request);
  const r = await pub.waitForTransactionReceipt({ hash });
  assert.equal(r.status, 'success', `${functionName} reverted`);
  return hash;
}

const cid = BigInt(d.campaignId);
const ok = (m) => console.log(`  ✓ ${m}`);
const usdcOf = (who) =>
  pub.readContract({ address: d.usdc, abi: erc20, functionName: 'balanceOf', args: [addr(who)] });
const stockOf = (who) =>
  pub.readContract({ address: d.stock, abi: erc20, functionName: 'balanceOf', args: [addr(who)] });
const purchase = (id) =>
  pub.readContract({ address: d.ownback, abi: ob, functionName: 'getPurchase', args: [id] });

function keeperOnce() {
  execFileSync('npx', ['tsx', 'scripts/keeper.ts', '--once'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      RPC_URL: RPC,
      KEEPER_PRIVATE_KEY: KEYS.keeper,
      DEPLOYMENT_FILE: 'contracts/deployments/31337.json',
      PRICE_SOURCE: 'static',
      STATIC_PRICE_USDC: '200000000', // $200, local test price
    },
  });
}

async function advance(seconds) {
  await testClient.increaseTime({ seconds });
  await testClient.mine({ blocks: 1 });
}

let nonce = 0;
async function pay(who, dollars, campaign = cid) {
  const id = await pub.readContract({ address: d.ownback, abi: ob, functionName: 'nextPurchaseId' });
  const amount = BigInt(dollars * 1e6);
  const orderRef = keccak256(toHex(`${who}-${dollars}-${++nonce}-${campaign}`));
  const block = await pub.getBlock();
  await tx(who, d.ownback, ob, 'pay', [campaign, amount, orderRef, 1n, block.timestamp + 900n]);
  return { id, orderRef };
}

console.log('\nOWNBACK end-to-end (local chain)\n');

for (const who of ['alice', 'bob']) {
  await tx(who, d.usdc, erc20, 'faucet', [addr(who), 500_000_000n]);
  await tx(who, d.usdc, erc20, 'approve', [d.ownback, 2n ** 255n]);
}
ok('customers funded with test USDC');

const merchantBefore = await pub.readContract({
  address: d.usdc,
  abi: erc20,
  functionName: 'balanceOf',
  args: [d.merchant],
});
const { id: p1, orderRef: firstOrderRef } = await pay('alice', 48);
let p = await purchase(p1);
assert.equal(p.kind, 1);
assert.equal(p.reward, 960_000n);
const merchantAfter = await pub.readContract({
  address: d.usdc,
  abi: erc20,
  functionName: 'balanceOf',
  args: [d.merchant],
});
assert.equal(merchantAfter - merchantBefore, 48_000_000n);
ok('first order: merchant paid $48 instantly, $0.96 reward reserved');

await assert.rejects(tx('alice', d.ownback, ob, 'settle', [p1, 1n]));
ok('settling inside the refund hold is rejected');

await advance(601);
keeperOnce();
p = await purchase(p1);
assert.equal(p.status, 1);
assert.equal(await stockOf('alice'), 480_000n); // $0.96 / $200
ok('keeper mirrored price and settled: 0.0048 stock delivered to alice');

const { id: p2 } = await pay('alice', 48);
p = await purchase(p2);
assert.equal(p.kind, 2);
assert.equal(p.reward, 2_400_000n);
ok('comeback order inside the window: $2.40 reserved (5%)');

await advance(601);
keeperOnce();
assert.equal(await stockOf('alice'), 480_000n + 1_200_000n);
ok('comeback settled: alice holds 0.0168 stock total');
keeperOnce();
assert.equal(await stockOf('alice'), 1_680_000n);
ok('keeper restart is idempotent: already-settled stock not minted twice');

const thirdBefore = await usdcOf('alice');
await assert.rejects(pay('alice', 48));
assert.equal(await usdcOf('alice'), thirdBefore);
ok('third order reverts without charging (one comeback only)');
// Exact same checkout intent cannot be replayed, even after a successful purchase.
const block = await pub.getBlock();
await assert.rejects(
  tx('alice', d.ownback, ob, 'pay', [cid, 48_000_000n, firstOrderRef, 1n, block.timestamp + 900n]),
);
ok('replayed checkout rejected before transferring USDC');

// A customer who explicitly accepts no reward can still check out (minReward = 0).
{
  const id = await pub.readContract({ address: d.ownback, abi: ob, functionName: 'nextPurchaseId' });
  const block = await pub.getBlock();
  const merchantBal = await pub.readContract({
    address: d.usdc,
    abi: erc20,
    functionName: 'balanceOf',
    args: [d.merchant],
  });
  await tx('alice', d.ownback, ob, 'pay', [
    cid,
    48_000_000n,
    keccak256(toHex('alice-opt-in')),
    0n,
    block.timestamp + 900n,
  ]);
  const p = await purchase(id);
  assert.equal(p.kind, 0);
  assert.equal(p.reward, 0n);
  const after = await pub.readContract({
    address: d.usdc,
    abi: erc20,
    functionName: 'balanceOf',
    args: [d.merchant],
  });
  assert.equal(after - merchantBal, 48_000_000n);
}
ok('explicit no-reward checkout goes through: merchant paid, nothing reserved');

// Another payer reusing someone's order reference cannot block their checkout.
{
  const ref = keccak256(toHex('carol-pending-checkout'));
  const block = await pub.getBlock();
  await tx('bob', d.ownback, ob, 'pay', [cid, 1n, ref, 0n, block.timestamp + 900n]);
  await tx('alice', d.ownback, ob, 'pay', [cid, 1_000_000n, ref, 0n, block.timestamp + 900n]);
}
ok('order references are per payer: front-running a reference cannot grief a checkout');

const bobBefore = await usdcOf('bob');
const { id: p4 } = await pay('bob', 20);
assert.equal((await purchase(p4)).reward, 400_000n);
await tx('merchant', d.ownback, ob, 'refund', [p4]);
assert.equal(await usdcOf('bob'), bobBefore);
p = await purchase(p4);
assert.equal(p.status, 2);
assert.equal(p.reward, 0n);
ok('refund before settlement: bob made whole, reward released');

await advance(601);
keeperOnce();
assert.equal(await stockOf('bob'), 0n);
ok('keeper skips the refunded order');

// Multi-campaign check: newly created campaign with the SAME registered mock stock
// must also be picked up by the stateless keeper, even after a process restart.
const cid2 = await pub.readContract({ address: d.ownback, abi: ob, functionName: 'nextCampaignId' });
const currentBlock = await pub.getBlock();
await tx('merchant', d.ownback, ob, 'createCampaign', [
  d.stock,
  10_000_000n,
  5_000_000n,
  200,
  500,
  currentBlock.timestamp + 30n * 86400n,
  600,
  604800,
]);
await tx('merchant', d.usdc, erc20, 'faucet', [addr('merchant'), 100_000_000n]);
await tx('merchant', d.ownback, ob, 'fund', [cid2, 100_000_000n]);
const { id: p5 } = await pay('bob', 25, cid2);
await advance(601);
const bobStockBefore = await stockOf('bob');
keeperOnce();
assert.equal((await purchase(p5)).status, 1);
assert.equal((await stockOf('bob')) - bobStockBefore, 250_000n); // $0.50/$200
ok('second merchant campaign paid and settled automatically');
const c = await pub.readContract({ address: d.ownback, abi: ob, functionName: 'getCampaign', args: [cid] });
const avail = await pub.readContract({ address: d.ownback, abi: ob, functionName: 'available', args: [cid] });
assert.equal(c.funded, c.spent + c.reserved + c.withdrawn + avail);
assert.equal(c.spent, 3_360_000n);
assert.equal(c.reserved, 0n);
ok(
  `budget conserved: funded $${Number(c.funded) / 1e6} = spent $${Number(c.spent) / 1e6} + available $${Number(avail) / 1e6}`,
);

console.log('\nAll end-to-end checks passed.\n');
