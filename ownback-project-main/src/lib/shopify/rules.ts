export type Purchase = { id:string; paidAt:number; refunded?:boolean; delivered?:boolean };
export type Kind='FIRST'|'COMEBACK'|'NONE';
/** Classify one paid order against a customer's entire observed Shopify purchase history.
    Refunds do not erase history once a reward has been delivered. Only the earliest
    qualifying repeat within seven days can be awarded. */
export function classify(purchases:Purchase[],candidate:string,windowMs=7*86400_000):Kind{
 const valid=purchases.filter(p=>!p.refunded||p.delivered).sort((a,b)=>a.paidAt-b.paidAt||a.id.localeCompare(b.id));
 const first=valid[0];const c=valid.find(p=>p.id===candidate);
 if(!c||!first)return 'NONE';
 if(c.id===first.id)return 'FIRST';
 const repeat=valid.find(p=>p.id!==first.id && p.paidAt>first.paidAt && p.paidAt<=first.paidAt+windowMs);
 return repeat?.id===candidate?'COMEBACK':'NONE';
}
export function rewardAmount(amount:bigint,kind:Kind,maxReward=10_000_000n):bigint{
 const bps=kind==='FIRST'?200n:kind==='COMEBACK'?500n:0n;
 const calc=amount*bps/10_000n;
 return calc>maxReward?maxReward:calc;
}
export function qualifiesForShopifyPayout(input:{status:string;holdAt:number;now:number;isPaid:boolean;refunded:boolean;claimed:boolean}){
 return input.status==='CLAIMED'&&input.holdAt<=input.now&&input.isPaid&&!input.refunded&&input.claimed;
}
