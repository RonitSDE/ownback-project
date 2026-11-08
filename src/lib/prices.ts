/**
 * Live reference prices from the public Coinbase Tokenized Stocks API (read-only, no key).
 * https://docs.base.org/sdks/tokenized-stocks/overview
 *
 * The parser is deliberately defensive about the envelope shape and fails loudly rather
 * than inventing numbers. Verify against the live response with: npm run prices:check
 */
export const TOKENIZED_STOCKS_API = 'https://api.coinbase.com/v1/tokenized-stocks';

export type StockQuote = {
  symbol: string;
  name: string | null;
  address: string | null;
  navPrice: number;
  navUpdatedAt: string | null;
  multiplier: number | null;
};

type Json = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  if (v && typeof v === 'object' && 'value' in (v as Json)) return num((v as Json).value);
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function findRecords(body: unknown): Json[] {
  if (Array.isArray(body)) return body as Json[];
  if (body && typeof body === 'object') {
    for (const key of ['tokenized_stocks', 'tokens', 'data', 'items', 'results']) {
      const v = (body as Json)[key];
      if (Array.isArray(v)) return v as Json[];
    }
    const firstArray = Object.values(body as Json).find(Array.isArray);
    if (firstArray) return firstArray as Json[];
  }
  return [];
}

export function parseQuotes(body: unknown): StockQuote[] {
  const quotes: StockQuote[] = [];
  for (const r of findRecords(body)) {
    const symbol = str(r.symbol);
    const navPrice = num(r.nav_price);
    if (!symbol || navPrice === null || navPrice <= 0) continue;
    quotes.push({
      symbol,
      name: str(r.name),
      address: str(r.contract_address) ?? str(r.address),
      navPrice,
      navUpdatedAt: str(r.nav_price_updated_at),
      multiplier: num(r.multiplier),
    });
  }
  return quotes;
}

function nextToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Json;
  return str(b.next_page_token) ?? str((b.pagination as Json | undefined)?.next_page_token);
}

export async function fetchTokenizedStocks(init?: RequestInit): Promise<StockQuote[]> {
  const all: StockQuote[] = [];
  let token: string | null = null;
  for (let page = 0; page < 5; page++) {
    const url = new URL(TOKENIZED_STOCKS_API);
    url.searchParams.set('page_size', '100');
    if (token) url.searchParams.set('page_token', token);
    const res = await fetch(url, { ...init, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Tokenized Stocks API returned ${res.status}`);
    const body: unknown = await res.json();
    all.push(...parseQuotes(body));
    token = nextToken(body);
    if (!token) break;
  }
  if (all.length === 0) {
    throw new Error('Tokenized Stocks API returned no parseable records (envelope may have changed)');
  }
  return all;
}

/** USDC (6 decimals) per token, as the on-chain adapter expects. */
export function toUsdc6(price: number): bigint {
  return BigInt(Math.round(price * 1e6));
}

/** Reject absent, future or stale upstream observation dates BEFORE any onchain price write.
 * This does not claim an executable market quote: NAV is testnet reference data only. */
export function requireFreshObservation(
  quote: Pick<StockQuote, 'symbol' | 'navUpdatedAt'>,
  nowSeconds: number,
  maxAgeSeconds: number,
): number {
  if (!quote.navUpdatedAt) throw new Error(`Missing source timestamp for ${quote.symbol}`);
  const millis = Date.parse(quote.navUpdatedAt);
  if (!Number.isFinite(millis)) throw new Error(`Invalid source timestamp for ${quote.symbol}`);
  const observedAt = Math.floor(millis / 1000);
  if (observedAt <= 0 || observedAt > nowSeconds) {
    throw new Error(`Future/invalid source timestamp for ${quote.symbol}`);
  }
  if (nowSeconds - observedAt > maxAgeSeconds) {
    throw new Error(`Stale source price for ${quote.symbol}: age ${nowSeconds - observedAt}s`);
  }
  return observedAt;
}
