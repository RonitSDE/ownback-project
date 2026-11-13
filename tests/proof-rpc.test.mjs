import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyChainReceipt, verifyProofLifecycle, EVENTS } from '../scripts/chain-proof.mjs';
const tx = '0x' + '1'.repeat(64),
  blockHash = '0x' + '2'.repeat(64),
  contract = '0x' + '3'.repeat(40),
  orderRef = '0x' + '4'.repeat(64);
const baseReceipt = {
  transactionHash: tx,
  to: contract,
  status: '0x1',
  blockHash,
  blockNumber: '0x12',
  logs: [],
};
const word = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');
const customer = '0x' + 'a'.repeat(40);
const eventTopics = (id) =>
  id === 'campaign_funding'
    ? [EVENTS[id], word(1)]
    : [EVENTS[id], word(2), word(1), '0x' + '0'.repeat(24) + customer.slice(2)];
function fixture(id, patch = {}) {
  const row = {
    id,
    environment: 'BASE_SEPOLIA',
    transactionHash: tx,
    contractAddress: contract,
    ...(id === 'order_payment' ? { orderRef } : {}),
  };
  const receipt = {
    ...baseReceipt,
    logs: [
      {
        address: contract,
        topics: eventTopics(id),
        data: id === 'order_payment' ? '0x' + '0'.repeat(64) + orderRef.slice(2) : '0x',
      },
    ],
    ...patch,
  };
  const rpc = async (method) =>
    method === 'eth_chainId'
      ? '0x14a34'
      : method === 'eth_getTransactionReceipt'
        ? receipt
        : method === 'eth_getBlockByHash'
          ? { hash: blockHash, number: '0x12' }
          : null;
  return { row, rpc };
}
for (const id of Object.keys(EVENTS))
  test(`RPC verifies confirmed ${id} event on Base Sepolia`, async () => {
    const { row, rpc } = fixture(id);
    const result = await verifyChainReceipt(row, rpc);
    assert.equal(result.chainId, 84532);
    assert.equal(result.blockNumber, 18);
  });
test('wrong chain is hard refusal', async () => {
  const { row, rpc } = fixture('campaign_funding');
  await assert.rejects(
    () => verifyChainReceipt(row, async (m, p) => (m === 'eth_chainId' ? '0x2105' : rpc(m, p))),
    /Wrong chain/,
  );
});
test('reverted transaction is not a settlement receipt', async () => {
  const { row, rpc } = fixture('settlement_refusal', { status: '0x0' });
  await assert.rejects(() => verifyChainReceipt(row, rpc), /did not succeed/);
});
test('unrelated contract event does not verify', async () => {
  const { row, rpc } = fixture('campaign_funding', {
    logs: [{ address: contract, topics: ['0x' + '5'.repeat(64)], data: '0x' }],
  });
  await assert.rejects(() => verifyChainReceipt(row, rpc), /Expected.*event missing/);
});
test('paid transaction must emit the submitted orderRef', async () => {
  const { row, rpc } = fixture('order_payment', {
    logs: [
      {
        address: contract,
        topics: eventTopics('order_payment'),
        data: '0x' + '0'.repeat(64) + '5'.repeat(64),
      },
    ],
  });
  await assert.rejects(() => verifyChainReceipt(row, rpc), /orderRef/);
});
test('receipt block hash must match canonical block', async () => {
  const { row, rpc } = fixture('campaign_funding');
  await assert.rejects(
    () =>
      verifyChainReceipt(row, async (m, p) =>
        m === 'eth_getBlockByHash' ? { hash: blockHash, number: '0x11' } : rpc(m, p),
      ),
    /Canonical block/,
  );
});

test('fund, payment and settlement must be same campaign, purchase and customer, in order', () => {
  const linked = [
    { id: 'campaign_funding', campaignId: '1', blockNumber: 1 },
    { id: 'order_payment', campaignId: '1', purchaseId: '2', customer, blockNumber: 2 },
    { id: 'settlement_refusal', campaignId: '1', purchaseId: '2', customer, blockNumber: 3 },
  ];
  assert.equal(verifyProofLifecycle(linked).purchaseId, '2');
  assert.throws(
    () => verifyProofLifecycle([{ ...linked[0], campaignId: '3' }, ...linked.slice(1)]),
    /same campaign/,
  );
  assert.throws(
    () => verifyProofLifecycle([linked[0], linked[1], { ...linked[2], purchaseId: '9' }]),
    /paid order/,
  );
  assert.throws(
    () => verifyProofLifecycle([linked[0], { ...linked[1], blockNumber: 4 }, linked[2]]),
    /block order/,
  );
});
