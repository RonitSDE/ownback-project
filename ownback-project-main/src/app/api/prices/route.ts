import { NextResponse } from 'next/server';
import { fetchTokenizedStocks, TOKENIZED_STOCKS_API } from '@/lib/prices';

export const runtime = 'nodejs';
export const revalidate = 300;

/** Server-side proxy for the Coinbase Tokenized Stocks API (avoids browser CORS, caches 5 min). */
export async function GET() {
  try {
    const stocks = await fetchTokenizedStocks({ next: { revalidate: 300 } } as RequestInit);
    return NextResponse.json({
      ok: true,
      source: TOKENIZED_STOCKS_API,
      fetchedAt: new Date().toISOString(),
      stocks,
    });
  } catch (err) {
    // No fallback numbers: the UI shows "unavailable" rather than a made-up price.
    return NextResponse.json(
      { ok: false, source: TOKENIZED_STOCKS_API, error: (err as Error).message },
      { status: 502 },
    );
  }
}
