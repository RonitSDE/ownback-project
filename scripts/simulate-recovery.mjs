/**
 * Fault-injection replay using the actual email/settlement worker code.
 * Tests deterministic in-memory database, Resend and contract substitutes.
 * NEVER represents a live Shopify or Base Sepolia transaction.
 * Run after npm ci: node scripts/simulate-recovery.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  if (!process.env.TS_COMPILER_PATH)
    throw Error('Install TypeScript using npm ci, or provide TS_COMPILER_PATH for offline replay');
  ts = require(process.env.TS_COMPILER_PATH);
}
const root = new URL('../', import.meta.url);
const sec = await import(new URL('src/lib/shopify/security.ts', root).href);
const rules = await import(new URL('src/lib/shopify/rules.ts', root).href);
Object.assign(process.env, {
  SHOPIFY_AUTO_EMAIL_CLAIMS: 'true',
  RESEND_API_KEY: 'fake-key',
  SHOPIFY_CLAIM_FROM_EMAIL: 'rewards@example.test',
  SHOPIFY_REWARD_CHAIN_ID: '31337',
  APP_ORIGIN: 'https://ownback.example.test',
  SHOPIFY_REWARD_VAULT_ADDRESS: '0x' + 'b'.repeat(40),
  SHOPIFY_REWARD_EXECUTOR_KEY: '0x' + '1'.repeat(64),
  SHOPIFY_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
  SHOPIFY_MOCK_PRICE_USDC: '100000000',
  SHOPIFY_CLAIM_BATCH_SIZE: '10',
});
const shop = 'pilot.myshopify.com',
  wallet = '0x' + 'a'.repeat(40),
  vault = '0x' + 'b'.repeat(40);
const customerHash = '0x' + 'd'.repeat(64);
const now = Date.now();
const orders = new Map();
const outbox = new Map();
const emailRequests = [];
const providerDeliveries = new Map();
const delivered = new Map();
let failSentRecord = true,
  failTxPersist = true,
  writeCount = 0,
  assertions = 0;
const key = (s, id) => `${s}:${id}`;
function seed(id, status = 'HOLD') {
  const o = {
    shop_domain: shop,
    order_id: id,
    customer_hash: customerHash,
    status,
    price_usdc: '48000000',
    paid_at: new Date(now - 2 * 86400_000),
    reward_eligible_at: new Date(now - 86400_000),
    processing_started_at: null,
    tx_hash: null,
    wallet: status === 'CLAIMED' ? wallet : null,
    claim_token_hash: null,
    claim_expires_at: null,
  };
  orders.set(id, o);
  return o;
}
const qr = (rows) => ({ rows, rowCount: rows.length });
async function query(sql, p = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (s.startsWith('SELECT shop_domain,order_id FROM shopify_reward_orders WHERE status IN'))
    return qr([...orders.values()].filter((o) => ['HOLD', 'READY'].includes(o.status)));
  if (
    s.startsWith('SELECT * FROM shopify_reward_orders WHERE shop_domain=') &&
    s.includes('FOR UPDATE SKIP LOCKED')
  )
    return qr(orders.get(p[1])?.status === 'HOLD' ? [orders.get(p[1])] : []);
  if (s.startsWith('SELECT 1 FROM shopify_refund_markers')) return qr([]);
  if (s.startsWith('SELECT order_id AS id,extract(epoch FROM paid_at)'))
    return qr(
      [...orders.values()]
        .filter((o) => o.customer_hash === p[1])
        .map((o) => ({ id: o.order_id, paid_at: o.paid_at.getTime(), status: o.status, tx_hash: o.tx_hash })),
    );
  if (s.startsWith("UPDATE shopify_reward_orders SET status='CLAIM_SENT'")) {
    const o = orders.get(p[1]);
    if (!o || o.status !== 'HOLD') return qr([]);
    o.status = 'CLAIM_SENT';
    o.claim_token_hash = p[2];
    o.claim_expires_at = new Date(now + 7 * 86400_000);
    return qr([{ order_id: p[1] }]);
  }
  if (s.startsWith('INSERT INTO shopify_claim_outbox')) {
    const item = {
      shop_domain: p[0],
      order_id: p[1],
      token_ciphertext: p[2],
      recipient_ciphertext: p[3],
      order_label: p[4],
      reward_kind: p[5],
      idempotency_key: p[6],
      created_at: new Date(),
      status: 'PENDING',
      attempts: 0,
    };
    if (outbox.has(p[1])) throw Error('Duplicate outbox record');
    outbox.set(p[1], item);
    return qr([item]);
  }
  if (s.startsWith('SELECT shop_domain,order_id FROM shopify_claim_outbox'))
    return qr([...outbox.values()].filter((o) => ['PENDING', 'RETRY'].includes(o.status)));
  if (s.startsWith("UPDATE shopify_claim_outbox SET status='SENDING'")) {
    const o = outbox.get(p[1]);
    if (!o || !['PENDING', 'RETRY'].includes(o.status)) return qr([]);
    o.status = 'SENDING';
    o.attempts++;
    return qr([{ ...o }]);
  }
  if (s.startsWith('SELECT status,price_usdc,claim_token_hash,claim_expires_at FROM shopify_reward_orders'))
    return qr([orders.get(p[1])]);
  if (s.startsWith("UPDATE shopify_claim_outbox SET status='SENT'")) {
    if (failSentRecord) {
      failSentRecord = false;
      throw Error('INJECTED_DB_CRASH_AFTER_EMAIL_ACCEPT');
    }
    outbox.get(p[1]).status = 'SENT';
    return qr([]);
  }
  if (s.startsWith('UPDATE shopify_claim_outbox SET status=$3')) {
    outbox.get(p[1]).status = p[2];
    return qr([]);
  }
  if (s.startsWith("SELECT * FROM shopify_reward_orders WHERE status='SETTLING'"))
    return qr([...orders.values()].filter((o) => o.status === 'SETTLING'));
  if (s.startsWith("SELECT * FROM shopify_reward_orders WHERE status='CLAIMED'"))
    return qr([...orders.values()].filter((o) => o.status === 'CLAIMED'));
  if (s.startsWith('SELECT order_id AS id,extract(epoch FROM paid_at)'))
    return qr(
      [...orders.values()].map((o) => ({
        id: o.order_id,
        paid_at: o.paid_at.getTime(),
        status: o.status,
        tx_hash: o.tx_hash,
      })),
    );
  if (s.startsWith("UPDATE shopify_reward_orders SET status='SETTLING'")) {
    const o = orders.get(p[1]);
    if (o.status !== 'CLAIMED') return qr([]);
    o.status = 'SETTLING';
    o.processing_started_at = new Date();
    return qr([{ order_id: o.order_id }]);
  }
  if (s.startsWith('UPDATE shopify_reward_orders SET tx_hash=$3')) {
    if (failTxPersist) {
      failTxPersist = false;
      throw Error('INJECTED_DB_CRASH_AFTER_BROADCAST');
    }
    orders.get(p[1]).tx_hash = p[2];
    return qr([]);
  }
  if (s.startsWith('UPDATE shopify_reward_orders SET failure_reason=')) {
    orders.get(p[1]).failure_reason = 'ambiguous';
    return qr([]);
  }
  if (s.startsWith('UPDATE shopify_reward_orders AS o SET status=CASE WHEN EXISTS')) {
    const o = orders.get(p[1]);
    o.status = 'DELIVERED';
    o.tx_hash = p[2];
    o.reward_kind = p[3];
    o.reward_usdc = p[4];
    o.stock_amount = p[5];
    o.processing_started_at = null;
    return qr([]);
  }
  throw Error('Missing simulated DB operation: ' + s.slice(0, 160));
}
const pool = { query, end: async () => {} };
const withTx = async (fn) => fn({ query });
const mockShopifyAdmin = {
  getLiveOrder: async (_shop, id) => ({
    name: '#' + id,
    email: 'buyer@example.test',
    cancelledAt: null,
    displayFinancialStatus: 'PAID',
    totalRefundedSet: { shopMoney: { amount: '0' } },
    totalPriceSet: { shopMoney: { amount: '48.00', currencyCode: 'USD' } },
  }),
  isLiveOrderPaid: (o) => o.displayFinancialStatus === 'PAID' && !o.cancelledAt,
};
const mockChain = {
  readContract: async ({ functionName, args }) =>
    functionName === 'available' ? 10_000_000n : delivered.has(args[0]),
  getLogs: async ({ args }) => (delivered.has(args.orderHash) ? [delivered.get(args.orderHash).log] : []),
  getTransactionReceipt: async ({ hash }) => {
    const rec = [...delivered.values()].find((x) => x.tx === hash);
    return rec ? { status: 'success', logs: [rec.log] } : { status: 'reverted', logs: [] };
  },
  waitForTransactionReceipt: async ({ hash }) => mockChain.getTransactionReceipt({ hash }),
};
const mockWallet = {
  writeContract: async ({ args }) => {
    writeCount++;
    const orderHash = args[0];
    if (delivered.has(orderHash)) throw Error('Duplicate paid order');
    const tx = '0x' + String(writeCount).padStart(64, '0');
    const log = {
      address: vault,
      transactionHash: tx,
      args: {
        orderHash,
        customerHash: args[1],
        wallet: args[2],
        usdcReward: 960000n,
        tokenOut: 960000n,
        comeback: false,
      },
    };
    delivered.set(orderHash, { tx, log });
    return tx;
  },
};
const modules = {
  'dotenv/config': {},
  '../src/lib/commerce/db': { pool, withTx },
  '../src/lib/shopify/admin': mockShopifyAdmin,
  '../src/lib/shopify/rules': rules,
  '../src/lib/shopify/security': sec,
  './security': sec,
  '../src/lib/shopify/claim-outbox': null,
  '../src/lib/shopify/chain': {
    shopifyClient: mockChain,
    shopifyVaultAddress: () => vault,
    shopifyVaultAbi: [],
    executorWallet: () => mockWallet,
  },
  viem: { parseEventLogs: ({ logs }) => logs, parseAbi: (items) => items },
};
const provider = async (_url, init) => {
  const request = { key: init.headers['Idempotency-Key'], body: JSON.parse(init.body) };
  emailRequests.push(request);
  if (!providerDeliveries.has(request.key)) providerDeliveries.set(request.key, request);
  return { ok: true, status: 200, json: async () => ({ id: 'email-id' }) };
};
function compile(path) {
  const input = readFileSync(new URL(path, root), 'utf8');
  const { outputText } = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const mod = { exports: {} };
  const ctx = {
    module: mod,
    exports: mod.exports,
    process,
    Buffer,
    Date,
    URL,
    AbortSignal,
    fetch: provider,
    console,
    require: (name) => {
      if (name in modules && modules[name] !== null) return modules[name];
      throw Error('Unmocked module ' + name + ' in ' + path);
    },
  };
  const ret = vm.runInNewContext(outputText, ctx, { filename: path });
  return { exports: mod.exports, promise: ret };
}
modules['../src/lib/shopify/claim-outbox'] = compile('src/lib/shopify/claim-outbox.ts').exports;
async function worker(path) {
  const m = compile(path);
  await m.promise;
}
seed('101');
await worker('scripts/shopify-claims.ts');
assert.equal(orders.get('101').status, 'CLAIM_SENT');
assertions++;
assert.equal(outbox.get('101').status, 'RETRY');
assertions++;
const firstToken = sec.decryptToken(outbox.get('101').token_ciphertext);
assert.equal(sec.tokenDigest(firstToken), orders.get('101').claim_token_hash);
assertions++;
assert.equal(providerDeliveries.size, 1);
assertions++;
await worker('scripts/shopify-claims.ts');
assert.equal(emailRequests.length, 2);
assertions++;
assert.equal(emailRequests[0].key, emailRequests[1].key);
assertions++;
assert.equal(providerDeliveries.size, 1);
assertions++;
assert.equal(
  new URL(emailRequests[0].body.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('token'),
  firstToken,
);
assertions++;
assert.equal(
  new URL(emailRequests[1].body.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get('token'),
  firstToken,
);
assertions++;
assert.equal(outbox.get('101').status, 'SENT');
assertions++;
seed('501', 'CLAIMED').customer_hash = '0x' + 'e'.repeat(64);
await worker('scripts/shopify-settle.ts');
assert.equal(orders.get('501').status, 'SETTLING');
assertions++;
assert.equal(orders.get('501').tx_hash, null);
assertions++;
assert.equal(writeCount, 1);
assertions++;
await worker('scripts/shopify-settle.ts');
assert.equal(orders.get('501').status, 'DELIVERED');
assertions++;
assert.match(orders.get('501').tx_hash, /^0x[0-9a-f]{64}$/);
assertions++;
assert.equal(writeCount, 1);
assertions++;
await worker('scripts/shopify-settle.ts');
assert.equal(writeCount, 1);
assertions++;
const report = {
  mode: 'OFFLINE WORKER FAULT-INJECTION (SIMULATED EMAIL, POSTGRES AND CHAIN)',
  version: '3.9.0-stocksmaxxing-candidate',
  passed: assertions,
  scenarios: [
    'Email accepted, DB mark-SENT fails; link is already valid',
    'Same claim token and provider idempotency key are used after retry',
    'Chain broadcast succeeds, DB tx hash store fails; order remains SETTLING',
    'Next settlement worker reconciles transaction from chain event without resending',
  ],
  emailRequests: emailRequests.length,
  providerDeduplicatedDeliveries: providerDeliveries.size,
  simulatedDeliverCalls: writeCount,
  settlementStatus: orders.get('501').status,
};
console.log(JSON.stringify(report, null, 2));
