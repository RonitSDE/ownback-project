/**
 * Reference lending parameters for Coinbase tokenized stocks on Base mainnet.
 * These are display references, not live reads. Check the protocol before borrowing.
 *
 * Morpho: five Steakhouse-curated markets launched Sep 18 2026. Liquidation LTV
 * (LLTV) 62.5% for AAPLc, NVDAc, METAc, SPCXc and 77% for GOOGLc.
 * Aave V4 Equities Hub: seven tokens (AAPLc, AMZNc, GOOGLc, METAc, MSFTc, NVDAc, TSLAc)
 * accepted as collateral for USDC since Sep 25 2026. Stocks are collateral-only.
 */
export const MORPHO_LLTV: Record<string, number> = {
  AAPLc: 0.625,
  NVDAc: 0.625,
  METAc: 0.625,
  SPCXc: 0.625,
  GOOGLc: 0.77,
};

export const AAVE_COLLATERAL = new Set(['AAPLc', 'AMZNc', 'GOOGLc', 'METAc', 'MSFTc', 'NVDAc', 'TSLAc']);

/** OWNBACK's suggested ceiling. Tokens trade 24/7 but the underlying market doesn't: leave room for gaps. */
export const SUGGESTED_MAX_LTV = 0.4;

export const LENDING_LINKS = {
  morpho: 'https://app.morpho.org/base/borrow',
  aave: 'https://app.aave.com/',
};

export const LENDING_NOTE =
  'Mainnet reference only. Morpho LLTV as listed at launch (Sep 2026); Aave V4 Equities Hub collateral list. Coinbase tokenized stocks are available only to eligible persons outside the United States.';
