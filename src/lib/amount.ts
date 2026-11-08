import { parseUnits } from 'viem';

// Kept local (not imported) so this module runs under Node's built-in TS loader in unit tests.
const USDC_DECIMALS = 6;

/** Largest single checkout the UI accepts (test USDC). Keeps typos from becoming huge approvals. */
export const MAX_CHECKOUT_USDC = 100_000;

export type ParsedAmount = { ok: true; units: bigint } | { ok: false; reason: string };

/** Strictly parse a user-typed USDC amount: digits, one optional dot, at most 6 decimals. */
export function parseUsdcInput(raw: string): ParsedAmount {
  const value = raw.trim();
  if (value === '') return { ok: false, reason: 'Enter an amount' };
  if (!/^\d+(\.\d+)?$/.test(value)) return { ok: false, reason: 'Use numbers only, like 48 or 12.50' };
  const decimals = value.split('.')[1]?.length ?? 0;
  if (decimals > USDC_DECIMALS) return { ok: false, reason: 'USDC supports up to 6 decimal places' };
  const units = parseUnits(value, USDC_DECIMALS);
  if (units === 0n) return { ok: false, reason: 'Amount must be more than zero' };
  if (units > BigInt(MAX_CHECKOUT_USDC) * 10n ** BigInt(USDC_DECIMALS)) {
    return { ok: false, reason: `Maximum checkout is $${MAX_CHECKOUT_USDC.toLocaleString('en-US')}` };
  }
  return { ok: true, units };
}

/** Keep the input field sane while typing without rejecting partial input like "12." */
export function sanitizeUsdcTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, USDC_DECIMALS)}` : whole;
}
