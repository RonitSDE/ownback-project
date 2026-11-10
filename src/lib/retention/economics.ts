/** OWNBACK v3.7 campaign planning. This model never mutates deployed campaign rates.
 * All inputs are explicit assumptions, not inferred customer profits.
 */
export type EconomicsInput={
  orderValue:number;grossMarginPercent:number;firstRewardPercent:number;
  comebackRewardPercent:number;controlReturnPercent:number;
  rewardedReturnPercent:number;buyers:number;
};
export type EconomicsResult={
 incrementalReturns:number; incrementalRevenue:number; incrementalGrossProfit:number;
 firstRewardCost:number;comebackRewardCost:number;totalRewardCost:number;
 netContribution:number; costPerIncrementalReturn:number|null;
 breakevenRewardedReturnPercent:number|null; projectedContributionPerBuyer:number;
};
export const loopTemplates={
 cafe:{label:'Café · weekly return',firstRewardPercent:2,comebackRewardPercent:6,windowDays:7},
 tickets:{label:'Events · next ticket',firstRewardPercent:1,comebackRewardPercent:4,windowDays:45},
 refill:{label:'Subscription · second order',firstRewardPercent:1,comebackRewardPercent:5,windowDays:30},
 retail:{label:'Retail · seven-day comeback',firstRewardPercent:2,comebackRewardPercent:5,windowDays:7},
} as const;
const finite=(n:number,min:number,max:number,name:string)=>{
 if(!Number.isFinite(n)||n<min||n>max) throw new RangeError(`${name} must be between ${min} and ${max}`);
 return n;
};
export function calculateEconomics(input:EconomicsInput):EconomicsResult{
 const aov=finite(input.orderValue,0.01,1_000_000,'Order value');
 const margin=finite(input.grossMarginPercent,0,100,'Gross margin')/100;
 const first=finite(input.firstRewardPercent,0,100,'First reward')/100;
 const comeback=finite(input.comebackRewardPercent,0,100,'Comeback reward')/100;
 const control=finite(input.controlReturnPercent,0,100,'Control repeat rate')/100;
 const treatment=finite(input.rewardedReturnPercent,0,100,'Rewarded repeat rate')/100;
 const buyers=finite(input.buyers,1,1_000_000,'Buyers');
 const incrementalReturns=buyers*(treatment-control);
 const incrementalRevenue=incrementalReturns*aov;
 const incrementalGrossProfit=incrementalRevenue*margin;
 const firstRewardCost=buyers*aov*first;
 const comebackRewardCost=buyers*treatment*aov*comeback;
 const totalRewardCost=firstRewardCost+comebackRewardCost;
 const netContribution=incrementalGrossProfit-totalRewardCost;
 const breakeven=(margin-comeback)>0?(margin*control+first)/(margin-comeback)*100:null;
 const breakevenRewardedReturnPercent=breakeven!==null&&breakeven<=100?breakeven:null;
 return {incrementalReturns,incrementalRevenue,incrementalGrossProfit,
  firstRewardCost,comebackRewardCost,totalRewardCost,netContribution,
  costPerIncrementalReturn:incrementalReturns>0?totalRewardCost/incrementalReturns:null,
  breakevenRewardedReturnPercent,projectedContributionPerBuyer:netContribution/buyers};
}
export type CohortCounts={ rewardedBuyers:number;rewardedReturners:number;controlBuyers:number;controlReturners:number;assignedBeforeExposure:boolean };
export function compareCohorts(c:CohortCounts){
 for(const [key,n] of Object.entries(c)) if(typeof n==='number'&&(!Number.isSafeInteger(n)||n<0))throw new RangeError(`Invalid ${key}`);
 if(c.rewardedReturners>c.rewardedBuyers||c.controlReturners>c.controlBuyers)throw new RangeError('Returners cannot exceed buyers');
 if(c.rewardedBuyers===0||c.controlBuyers===0)return {available:false as const,reason:'Both cohorts need observed buyers'};
 const rewardedRate=c.rewardedReturners/c.rewardedBuyers;
 const controlRate=c.controlReturners/c.controlBuyers;
 return {available:true as const,rewardedRate,controlRate,percentagePointDifference:(rewardedRate-controlRate)*100,
  sampleSize:c.rewardedBuyers+c.controlBuyers,
  label:c.assignedBeforeExposure?'Directional pilot comparison (not statistical proof)':'Observed association only; cohorts were not pre-assigned'};
}
export function rewardStage(status:string):'reserved'|'eligible'|'settling'|'owned'|'reversed'|'liability'|'needs_review' {
 switch(status){
  case 'HOLD':return 'reserved';
  case 'READY':case 'CLAIM_SENT':case 'CLAIMED':return 'eligible';
  case 'SETTLING':return 'settling';
  case 'DELIVERED':return 'owned';
  case 'REFUNDED':return 'reversed';
  case 'REFUNDED_AFTER_DELIVERY':return 'liability';
  default:return 'needs_review';
 }
}
