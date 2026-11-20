/**
 * Fetches the live Coinbase Tokenized Stocks API and prints what OWNBACK parses from it.
 * Run this once on a networked machine to confirm the parser matches the live envelope:
 *   npm run prices:check
 */
import { fetchTokenizedStocks, TOKENIZED_STOCKS_API } from '../src/lib/prices';

const quotes = await fetchTokenizedStocks();
console.log(`Parsed ${quotes.length} tokenized stocks from ${TOKENIZED_STOCKS_API}\n`);
console.table(
  quotes.slice(0, 15).map((q) => ({
    symbol: q.symbol,
    nav_price: q.navPrice,
    multiplier: q.multiplier,
    updated: q.navUpdatedAt,
    address: q.address,
  })),
);
