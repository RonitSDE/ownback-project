import { NextResponse } from 'next/server';
/** Bankr execution is deliberately disabled: a server API key controls the operator wallet,
 * not the connected shopper wallet. A production write integration requires customer-specific
 * Bankr authorization, position verification, independent LTV checks and onchain receipts. */
export const runtime = 'nodejs';
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: 'CUSTOMER_AUTHORIZATION_REQUIRED',
      message:
        'Automated borrowing is not enabled. Use Bankr research or connect your own wallet at an eligible lending venue.',
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}
