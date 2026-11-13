/** Observed only, campaign-local purchase receipts. No causal uplift estimation.
 * Refunded purchases are excluded; elapsed windows for recent cohorts are immature.
 */
export type NativePaid={customer:string;status:number;kind:number;paidAt:number;reward:bigint;amount:bigint};
export type ObservedNative={customers:number;returners:number;repeat7d:number;repeat30d:number;paidOrders:number;firstOrders:number;comebackRewardOrders:number};
export function observedNative(rows:NativePaid[]):ObservedNative{
 const active=rows.filter(p=>(p.status===0||p.status===1)&&p.paidAt>0).sort((a,b)=>a.paidAt-b.paidAt);
 const groups=new Map<string,NativePaid[]>();
 for(const row of active){const key=row.customer.toLowerCase();const group=groups.get(key)||[];group.push(row);groups.set(key,group);}
 let returners=0,repeat7d=0,repeat30d=0;
 for(const rows of groups.values()){
  if(rows.length<2)continue;
  returners++;
  const delta=rows[1].paidAt-rows[0].paidAt;
  if(delta>=0&&delta<=7*86400)repeat7d++;
  if(delta>=0&&delta<=30*86400)repeat30d++;
 }
 return {customers:groups.size,returners,repeat7d,repeat30d,paidOrders:active.length,firstOrders:active.filter(x=>x.kind===1).length,comebackRewardOrders:active.filter(x=>x.kind===2).length};
}
