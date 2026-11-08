/**
 * Real-browser journey against a local chain: an EIP-6963 test wallet is injected that forwards
 * requests to anvil's unlocked dev account, so every click sends genuine transactions.
 *   UI_URL=http://localhost:3300 CHROME_PATH=... node tests/ui/wallet-journey.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const URL = process.env.UI_URL ?? 'http://localhost:3000';
const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const CUSTOMER = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'; // anvil dev account #5 (unlocked)
const OUT = process.env.SCREENSHOT_DIR ?? 'test-results/ui';
mkdirSync(OUT, { recursive: true });

const rpc = (method, params = []) =>
  fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }).then((r) => r.json());

function injectWallet({ rpcUrl, account }) {
  const listeners = {};
  const provider = {
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
      if (method === 'eth_chainId') return '0x7a69';
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params ?? [] }),
      }).then((r) => r.json());
      if (res.error)
        throw Object.assign(new Error(res.error.message), { code: res.error.code, data: res.error.data });
      return res.result;
    },
    on: (e, fn) => ((listeners[e] ??= []).push(fn), provider),
    removeListener: () => provider,
  };
  const info = {
    uuid: 'test-wallet-0001',
    name: 'Test Wallet',
    rdns: 'test.ownback',
    icon:
      'data:image/svg+xml;base64,' +
      btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" rx="6" fill="#5665ea"/></svg>',
      ),
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }),
    );
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: (process.env.CHROME_ARGS ?? '').split(' ').filter(Boolean),
});
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const problems = [];
const ALLOWED = (process.env.ALLOW_ERRORS ?? '').split('|').filter(Boolean);
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = `${m.text()} ${m.location()?.url ?? ''}`;
  if (!ALLOWED.some((a) => text.includes(a))) problems.push(`console: ${text}`);
});
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
await page.addInitScript(injectWallet, { rpcUrl: RPC, account: CUSTOMER });

const step = (m) => console.log(`  ✓ ${m}`);
const toast = (re) => page.locator('.toast-bar').filter({ hasText: re }).waitFor({ timeout: 30_000 });

console.log('\nOWNBACK UI journey (real browser, real transactions)\n');

await page.goto(`${URL}/shop`);
await page.getByRole('button', { name: 'Connect wallet' }).click();
await page
  .getByRole('dialog')
  .getByRole('button', { name: /Test Wallet/ })
  .click();
await page.getByText('0x9965…A4dc').waitFor();
step('connected through the EIP-6963 picker');

await page.getByRole('button', { name: 'Get 100 test USDC' }).click();
await toast(/Added 100 test USDC/);
step('faucet minted test USDC');

await page.getByRole('button', { name: /Running shoes/ }).click();
await page.getByText(/Earns \$0\.96/).waitFor();
await page.screenshot({ path: `${OUT}/1-shop-quote.png`, fullPage: true });
step('live on-chain quote shows $0.96 (2%)');

await page.getByRole('button', { name: 'Pay $48.00' }).click();
await toast(/reserved for you/);
await page
  .getByText(/Settles in/)
  .first()
  .waitFor();
step('paid $48: reward reserved, refund hold shown');

await rpc('evm_increaseTime', [601]);
await rpc('evm_mine');
await page.getByRole('button', { name: 'Refresh data' }).click();
await page.getByRole('button', { name: 'Settle reward' }).click();
await toast(/Reward delivered/);
await page
  .getByText(/0\.004800 mAAPLc/)
  .first()
  .waitFor();
await page.getByText('delivery ↗').waitFor({ timeout: 20_000 });
step('customer settled the reward: 0.0048 stock in wallet, delivery tx linked');

await page.getByRole('textbox', { name: /Amount/ }).fill('4');
await page.getByText(/No stock reward on this order/).waitFor();
const payBtn = page.getByRole('button', { name: 'Pay $4.00' });
if (!(await payBtn.isDisabled())) throw new Error('Pay must stay disabled until no-reward is accepted');
await page.getByLabel('Pay anyway, without a reward').check();
await payBtn.click();
await toast(/This order has no reward/);
await page.getByText('Order #2 · $4.00').waitFor({ timeout: 20_000 });
step('below-minimum order: blocked until explicit opt-in, then paid and listed');

await page.getByRole('textbox', { name: /Amount/ }).fill('1.2.3x');
await page.waitForTimeout(300);
const typed = await page.getByRole('textbox', { name: /Amount/ }).inputValue();
if (typed !== '1.23') throw new Error(`amount sanitiser produced "${typed}"`);
step('amount input sanitised while typing');

await page.screenshot({ path: `${OUT}/2-shop-after.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${OUT}/3-shop-mobile.png`, fullPage: true });
await page.setViewportSize({ width: 1360, height: 900 });
await page.goto(`${URL}/merchant`);
await page.getByText('Checkout revenue').waitFor();
await page.screenshot({ path: `${OUT}/4-merchant.png`, fullPage: true });
step('merchant console renders live chain data');

await browser.close();
if (problems.length) {
  console.error('\nBrowser errors:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nUI journey passed with zero console errors.\n');
