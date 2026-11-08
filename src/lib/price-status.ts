/**
 * Coinbase NAV reference prices freeze while US equity markets are shut (nights, weekends, holidays).
 * A price that stopped updating for that reason is not broken, so we tell users the market is closed
 * instead of calling it stale. Only past the contract's own limit does settlement actually pause.
 */
export const MARKET_CLOSED_AFTER_SECONDS = 6 * 60 * 60;

export type PriceStatus = 'missing' | 'fresh' | 'market-closed' | 'stale';

export function classifyPrice(ageSeconds: number, maxAgeSeconds: number, hasPrice: boolean): PriceStatus {
  if (!hasPrice) return 'missing';
  if (ageSeconds > maxAgeSeconds) return 'stale';
  if (ageSeconds > MARKET_CLOSED_AFTER_SECONDS) return 'market-closed';
  return 'fresh';
}

export const PRICE_STATUS_COPY: Record<
  PriceStatus,
  { label: string; tone: 'green' | 'grey' | 'orange' | 'red' }
> = {
  missing: { label: 'No price yet', tone: 'red' },
  fresh: { label: 'Live', tone: 'green' },
  'market-closed': { label: 'Market closed · last NAV', tone: 'grey' },
  stale: { label: 'Settlement paused · price stale', tone: 'red' },
};
