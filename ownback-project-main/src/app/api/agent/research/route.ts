import { NextResponse } from 'next/server';
import { getBankrClient } from '@/lib/bankr/server';
import { researchPrompt, validSymbol, makeJobToken, verifyJobToken } from '@/lib/bankr/research';
import { clientIp, rateLimit, sweepRateLimits } from '@/lib/server/rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function secret() {
  return process.env.BANKR_JOB_TOKEN_SECRET || '';
}
function enabled() {
  return process.env.BANKR_RESEARCH_ENABLED === 'true';
}
export async function POST(req: Request) {
  if (!enabled() || !secret() || secret().length < 32)
    return NextResponse.json({ message: 'Bankr research token secret is not configured.' }, { status: 503 });
  const client = getBankrClient();
  if (!client) return NextResponse.json({ message: 'Bankr is not configured.' }, { status: 503 });
  sweepRateLimits();
  const limit = rateLimit(`bankr-research:${clientIp(req)}`, 3, 60000);
  if (!limit.ok)
    return NextResponse.json(
      { message: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  const text = await req.text();
  if (text.length > 500) return NextResponse.json({ message: 'Request too long.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 });
  }
  if (!validSymbol(body.stockSymbol))
    return NextResponse.json({ message: 'Unsupported symbol.' }, { status: 400 });
  try {
    const started = await client.prompt(researchPrompt(body.stockSymbol));
    const expires = Math.floor(Date.now() / 1000) + 600;
    return NextResponse.json(
      {
        jobId: started.jobId,
        expires,
        token: `${expires}.${makeJobToken(started.jobId, expires, secret())}`,
        status: 'pending',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ message: 'Bankr research request unavailable.' }, { status: 502 });
  }
}
export async function GET(req: Request) {
  const u = new URL(req.url),
    jobId = u.searchParams.get('jobId') || '',
    token = u.searchParams.get('token') || '';
  if (!enabled() || !/^job_[A-Za-z0-9_-]{1,120}$/.test(jobId) || !secret())
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  const [e, hash] = token.split('.');
  const expiry = Number(e);
  if (!verifyJobToken(jobId, expiry, hash || '', secret()))
    return NextResponse.json({ message: 'Invalid or expired research link.' }, { status: 403 });
  const client = getBankrClient();
  if (!client) return NextResponse.json({ message: 'Bankr unavailable.' }, { status: 503 });
  try {
    const job = await client.job(jobId);
    return NextResponse.json(
      {
        status: job.status,
        analysis: job.status === 'completed' ? job.response || 'Research finished without text.' : undefined,
        message: job.status === 'failed' ? 'Research failed.' : undefined,
        executionVerified: false,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ message: 'Could not retrieve research.' }, { status: 502 });
  }
}
