import { parseAbi } from 'viem';
/** Public-only ABI for customer/merchant wallet calls. No signing keys. */
export const shopifyVaultPublicAbi = parseAbi([
  'function fund(uint256 amount)',
  'function available() view returns(uint256)',
  'function merchant() view returns(address)',
]);
