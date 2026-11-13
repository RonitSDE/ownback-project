/** OWNBACK v3.10: deterministic, read-only reward allocation policy.
 * IMPORTANT: Existing production vaults are immutable SINGLE-STOCK settlement lanes.
 * A proposal never constitutes a firm stock quote, customer eligibility decision or trade.
 */
export const STOCK_RESEARCH = {
  AAPLc: { name: 'Apple tokenized exposure', sector: 'consumer-electronics',
    assetReference: 'https://www.base.org/stocks',
    implementationReference: 'https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks' },
  NVDAc: { name: 'Nvidia tokenized exposure', sector: 'semiconductors',
    assetReference: 'https://www.base.org/stocks',
    implementationReference: 'https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks' },
} as const;
export type StockSymbol = keyof typeof STOCK_RESEARCH;
export type Theme = 'technology' | 'consumer-electronics' | 'semiconductors' | 'robotics' | 'energy';
export type AllocationInput = {
  /** Illustrative size of a single already-earned merchant-funded reward; never a wallet debit. */
  rewardUsd: number;
  theme: Theme;
  preferredStock: 'AUTO' | StockSymbol;
  excludedSymbols: StockSymbol[];
  maxSingleWeightPercent: number;
  cashReservePercent: number;
};
export type AllocationCapabilities = { settlementStock: StockSymbol | null; chainId: 8453 | 84532 | 31337 };
export type AllocationProposal = {
  status: 'proposed' | 'refused'; reasons: string[];
  stock: StockSymbol | null; stockWeightPercent: number; reservePercent: number;
  rewardUsd: number; chainId: number; settlementStock: StockSymbol | null;
  facts: string[]; assumptions: string[]; opinions: string[];
  sources: { title: string; url: string }[];
  executionStatus: 'NOT_EXECUTED';
  approvalMeaning: string;
};
const themes: Theme[] = ['technology', 'consumer-electronics', 'semiconductors', 'robotics', 'energy'];
const symbolList: StockSymbol[] = ['AAPLc', 'NVDAc'];
const positiveCents = (n: number) => Number.isFinite(n) && n >= 0.01 && n <= 10 && Math.abs(Math.round(n * 100) - n * 100) < 1e-8;
function plainRecord(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw);
}
export function validateAllocationInput(raw: unknown): { ok: true; input: AllocationInput } | { ok: false; error: string } {
  if (!plainRecord(raw)) return { ok: false, error: 'Invalid policy request.' };
  const { rewardUsd, theme, preferredStock, excludedSymbols, maxSingleWeightPercent, cashReservePercent } = raw;
  if (typeof rewardUsd !== 'number' || !positiveCents(rewardUsd)) return { ok: false, error: 'Reward must be $0.01–$10.00 in whole cents (illustrative, not funded).' };
  if (typeof theme !== 'string' || !themes.includes(theme as Theme)) return { ok: false, error: 'Unsupported theme.' };
  if (preferredStock !== 'AUTO' && !symbolList.includes(preferredStock as StockSymbol)) return { ok: false, error: 'Unsupported preferred stock.' };
  if (!Array.isArray(excludedSymbols) || excludedSymbols.length > 2 || new Set(excludedSymbols).size !== excludedSymbols.length || !excludedSymbols.every(x => symbolList.includes(x)))
    return { ok: false, error: 'Invalid asset exclusions.' };
  if (typeof maxSingleWeightPercent !== 'number' || !Number.isInteger(maxSingleWeightPercent) || maxSingleWeightPercent < 1 || maxSingleWeightPercent > 100)
    return { ok: false, error: 'Concentration limit must be 1–100%.' };
  if (typeof cashReservePercent !== 'number' || !Number.isInteger(cashReservePercent) || cashReservePercent < 0 || cashReservePercent > 99)
    return { ok: false, error: 'Reserve must be 0–99%.' };
  return { ok: true, input: { rewardUsd, theme: theme as Theme, preferredStock: preferredStock as AllocationInput['preferredStock'], excludedSymbols: [...excludedSymbols] as StockSymbol[], maxSingleWeightPercent, cashReservePercent } };
}
export function buildAllocationProposal(input: AllocationInput, capabilities: AllocationCapabilities): AllocationProposal {
  const reasons: string[] = [];
  const themeStock: Record<Theme, StockSymbol[]>= {
    technology: ['AAPLc', 'NVDAc'], 'consumer-electronics': ['AAPLc'], semiconductors: ['NVDAc'], robotics: [], energy: []
  };
  const available = themeStock[input.theme].filter(s => !input.excludedSymbols.includes(s));
  if (themeStock[input.theme].length === 0) reasons.push(`The current pilot has no independently enabled assets for ${input.theme}.`);
  if (available.length === 0 && themeStock[input.theme].length) reasons.push('Every asset matching the requested theme is excluded.');
  if (input.cashReservePercent > 0) reasons.push('The existing single-stock vault cannot retain a separate customer cash reserve.');
  if (input.maxSingleWeightPercent < 100) reasons.push(`A ${input.maxSingleWeightPercent}% concentration ceiling needs multiple settlement assets; the active reward vault can settle only one.`);
  const stock = input.preferredStock === 'AUTO' ? (capabilities.settlementStock && available.includes(capabilities.settlementStock) ? capabilities.settlementStock : null) : input.preferredStock;
  if (stock && !available.includes(stock)) reasons.push('The selected stock conflicts with the theme or exclusions.');
  if (!capabilities.settlementStock) reasons.push('No settlement stock is configured. An agent cannot promise deliverable inventory.');
  if (capabilities.settlementStock && stock && stock !== capabilities.settlementStock)
    reasons.push(`The configured vault settles ${capabilities.settlementStock}, not ${stock}. A new audited and funded settlement lane is required.`);
  if (!stock && capabilities.settlementStock && available.length) reasons.push('No compatible settlement stock could be selected.');
  const chosen = stock && available.includes(stock) ? stock : null;
  return {
    status: reasons.length ? 'refused' : 'proposed', reasons,
    stock: chosen, stockWeightPercent: reasons.length ? 0 : 100,
    reservePercent: input.cashReservePercent, rewardUsd: input.rewardUsd,
    chainId: capabilities.chainId, settlementStock: capabilities.settlementStock,
    facts: [
      'The v3.10 pilot supports only one token per configured reward vault.',
      'Stock rewards remain subject to merchant funding, refunded-order checks, recipient eligibility, real inventory, and an independent fresh-price check.',
      'A signed allocation preference does not transfer funds or execute a purchase.'
    ],
    assumptions: [
      `A $${input.rewardUsd.toFixed(2)} reward is illustrative; no paid order or funded entitlement was verified in this proposal.`,
      'Company category labels are editorial classifications, not investment advice or independent suitability analysis.'
    ],
    opinions: ['Single-asset concentration carries issuer and market risk. The customer may choose not to proceed.'],
    sources: chosen ? [
      { title: 'Base — supported tokenized stocks (verify listing and eligibility)', url: STOCK_RESEARCH[chosen].assetReference },
      { title: 'Base developer docs — token behavior and oracle restrictions', url: STOCK_RESEARCH[chosen].implementationReference }
    ] : [ { title: 'Base — tokenized stocks information', url: 'https://www.base.org/stocks' } ],
    executionStatus: 'NOT_EXECUTED',
    approvalMeaning: 'A wallet-signed, one-time preference receipt only. This is NOT an investment order, spending mandate, trade authorization, or claim on stock.'
  };
}
/** Stable, strictly canonicalized consent message, identical on the client and server. */
export function allocationApprovalMessage(params: {
  origin: string; wallet: string; nonce: string; expiresAt: number; proposal: AllocationProposal; input: AllocationInput;
}) {
  const { origin, wallet, nonce, expiresAt, proposal, input } = params;
  return `OWNBACK v3.10 — RECORD PREFERENCE ONLY\nOrigin: ${origin}\nWallet: ${wallet.toLowerCase()}\nChain ID: ${proposal.chainId}\nStock: ${proposal.stock ?? 'NONE'}\nRequested theme: ${input.theme}\nPreferred token: ${input.preferredStock}\nExcluded tokens: ${[...input.excludedSymbols].sort().join(',') || 'none'}\nMaximum single-company weight: ${input.maxSingleWeightPercent}%\nMaximum illustrative reward: $${proposal.rewardUsd.toFixed(2)}\nStock weight: ${proposal.stockWeightPercent}%\nCash reserve: ${proposal.reservePercent}%\nNonce: ${nonce}\nExpires: ${expiresAt}\nThis does NOT authorize transfers, trading, borrowing, investing, or claiming any stock. No transaction will be executed.`;
}
