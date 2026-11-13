import type { AllocationCapabilities, StockSymbol } from './policy';
/** The ONLY executable stock is the one hard-bound to the deployed reward vault.
 * Operators must verify this env value against the live deployment before enabling receipts.
 */
export function allocationCapabilities():AllocationCapabilities{
 const value=process.env.OWNBACK_PILOT_SETTLEMENT_STOCK;
 const stock:StockSymbol|null=value==='AAPLc'||value==='NVDAc'?value:null;
 const id=Number(process.env.NEXT_PUBLIC_CHAIN_ID||'84532');
 return {settlementStock:stock,chainId:id===8453?8453:id===31337?31337:84532};
}
