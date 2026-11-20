import { NextResponse } from 'next/server';
import { chain, isConfigured } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Process liveness for Render. Stale prices stay on /api/health so they don't restart the site. */
export function GET() {
  return NextResponse.json({
    status: 'live',
    chainId: chain.id,
    chain: chain.name,
    configured: isConfigured,
  });
}
