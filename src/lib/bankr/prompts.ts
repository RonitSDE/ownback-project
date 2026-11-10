/**
 * Natural-language prompts OWNBACK sends to the Bankr agent. Kept together and explicit so the
 * exact instruction a user's agent executes is auditable, not buried in string concatenation.
 */
export type BorrowRequest = { stockSymbol: string; collateralUnits: string; borrowUsdc: number };

/** "Borrow against my position" — the headline agentic action. */
export function borrowPrompt({ stockSymbol, collateralUnits, borrowUsdc }: BorrowRequest): string {
  return (
    `On Base, use my ${collateralUnits} ${stockSymbol} tokenized stock as collateral on Morpho ` +
    `and borrow ${borrowUsdc} USDC against it. Keep the loan conservative — do not exceed 40% ` +
    `loan-to-value. Confirm the collateral deposit and the borrowed amount.`
  );
}

/** "What's my position worth / how much can I borrow?" — a read-only question, safe with any key. */
export function positionQuestionPrompt(stockSymbol: string): string {
  return (
    `What is my ${stockSymbol} tokenized-stock balance on Base worth right now, and how much USDC ` +
    `could I safely borrow against it on Morpho at 40% loan-to-value?`
  );
}
