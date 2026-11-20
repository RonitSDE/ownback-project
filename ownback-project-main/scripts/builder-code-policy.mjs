/** Minimal offline validation for the canonical ERC-8021 schema-0 attribution trailer.
 * Live verification of transaction calldata is performed separately against an RPC.
 */
export const ERC8021_MARKER = '80218021802180218021802180218021';
export function validateBuilderCode(code) {
  if (
    typeof code !== 'string' ||
    code.length < 1 ||
    code.length > 128 ||
    !/^[\x21-\x7e]+$/.test(code) ||
    code.includes(',')
  ) {
    throw new Error('Builder Code missing or invalid (single printable ASCII code, no comma)');
  }
  return code;
}
export function validateBuilderConfig(publicCode, workerCode) {
  const web = validateBuilderCode(publicCode);
  const worker = validateBuilderCode(workerCode);
  if (web !== worker) throw new Error('Web and worker Builder Codes do not match');
  return web;
}
/** Read schema 0 only; a different schema or wrapped smart-account call must be verified using wallet-aware tooling. */
export function codesFromTxCalldata(data) {
  if (typeof data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(data)) return [];
  const hex = data.slice(2).toLowerCase();
  if (hex.length < 36 || !hex.endsWith(ERC8021_MARKER)) return [];
  const schema = hex.slice(-34, -32);
  if (schema !== '00') return [];
  const size = Number.parseInt(hex.slice(-36, -34), 16);
  const start = hex.length - 36 - size * 2;
  if (start < 0) return [];
  const codeBytes = hex.slice(start, start + size * 2);
  const decoded = Buffer.from(codeBytes, 'hex').toString('utf8');
  return decoded ? decoded.split(',') : [];
}
