import 'server-only';
import { BankrClient } from './client';

/**
 * Server-only Bankr access. The API key lives in BANKR_API_KEY and never reaches the browser.
 * Returns null when no key is set, which the routes treat as "Bankr not configured" rather than
 * an error — the direct path still works.
 */
export function getBankrClient(): BankrClient | null {
  const apiKey = process.env.BANKR_API_KEY;
  if (!apiKey) return null;
  return new BankrClient({ apiKey, baseUrl: process.env.BANKR_API_URL });
}

export function isBankrConfigured(): boolean {
  return Boolean(process.env.BANKR_API_KEY);
}

/**
 * The agent BORROW action spends from the server's Bankr wallet, so it is OFF unless the operator
 * explicitly enables it. A configured read key alone never exposes spending.
 */
export function isBankrBorrowEnabled(): boolean {
  return isBankrConfigured() && process.env.BANKR_BORROW_ENABLED === 'true';
}

/** Hard ceiling on a single agent borrow, in USDC. Guards against a bad client or a typo. */
export function maxBorrowUsdc(): number {
  const raw = Number(process.env.BANKR_MAX_BORROW_USDC ?? '25');
  return Number.isFinite(raw) && raw > 0 ? raw : 25;
}
