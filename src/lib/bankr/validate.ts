/**
 * Strict validation for the agent borrow request. Pure (no server imports) so it can be unit-tested.
 * Rejects anything that isn't a plausible symbol / token amount / positive bounded USD figure, which
 * keeps malformed or hostile input from ever reaching the prompt we send to the agent.
 */
export type BorrowInput = { stockSymbol: string; collateralUnits: string; borrowUsdc: number };

export type Validated = { ok: true; value: BorrowInput } | { ok: false; error: string };

const SYMBOL_RE = /^[A-Za-z][A-Za-z0-9.]{0,11}$/; // e.g. AAPLc, NVDAc
const DECIMAL_RE = /^\d{1,18}(\.\d{1,18})?$/;

export function validateBorrow(raw: unknown, maxUsdc: number): Validated {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Invalid request body.' };
  const { stockSymbol, collateralUnits, borrowUsdc } = raw as Record<string, unknown>;

  if (typeof stockSymbol !== 'string' || !SYMBOL_RE.test(stockSymbol)) {
    return { ok: false, error: 'Invalid stock symbol.' };
  }
  if (
    typeof collateralUnits !== 'string' ||
    !DECIMAL_RE.test(collateralUnits) ||
    Number(collateralUnits) <= 0
  ) {
    return { ok: false, error: 'Invalid collateral amount.' };
  }
  if (typeof borrowUsdc !== 'number' || !Number.isFinite(borrowUsdc) || borrowUsdc <= 0) {
    return { ok: false, error: 'Invalid borrow amount.' };
  }
  if (borrowUsdc > maxUsdc) {
    return { ok: false, error: `Borrow exceeds the ${maxUsdc} USDC limit for this demo.` };
  }
  return { ok: true, value: { stockSymbol, collateralUnits, borrowUsdc } };
}
