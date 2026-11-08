import { formatUnits } from 'viem';

export const USDC_DECIMALS = 6;
export const STOCK_DECIMALS = 8;

export function usd(value: bigint, decimals = USDC_DECIMALS) {
  const n = Number(formatUnits(value, decimals));
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function stockUnits(value: bigint, digits = 6) {
  return Number(formatUnits(value, STOCK_DECIMALS)).toFixed(digits);
}

export function shortAddress(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

export function duration(seconds: number) {
  if (seconds <= 0) return 'now';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

export const KIND = ['No reward', 'First purchase', 'Comeback'] as const;
export const STATUS = ['Paid', 'Rewarded', 'Refunded', 'Refunded after reward'] as const;
