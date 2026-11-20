/** Read-only merchant campaign policy suggestion. NEVER updates reward contract or assumes lift. */
export type RetentionAgentInput={
  firstOrders:number;expectedRepeatOrders:number;averageOrderUsd:number;
  firstRewardPercent:number;desiredComebackPercent:number;grossMarginPercent:number;
  merchantBudgetUsd:number;
};
export type RetentionAdvice={
  verdict:'PROPOSED'|'REFUSED';proposedComebackPercent:number|null;
  firstRewardCommitmentUsd:number; projectedTotalCommitmentUsd:number|null;
  unusedBudgetUsd:number|null; reasons:string[]; safeguards:string[];
};
const roundCent=(v:number)=>Math.round(v*100)/100;
const valid=(n:number)=>Number.isFinite(n)&&n>=0;
export function proposeRetentionPolicy(input:RetentionAgentInput):RetentionAdvice{
 const safeguards=[
  'Proposal only; deployed cashback rules and merchant budgets remain unchanged.',
  'All return-order assumptions are hypothetical. Observed repeat orders do not prove incremental lift.',
  'Check merchant gross margin, returns, inventory, transaction fees and reward settlement independently.'
 ];
 const refuse=(reason:string,firstCost=0):RetentionAdvice=>({verdict:'REFUSED',proposedComebackPercent:null,
  firstRewardCommitmentUsd:roundCent(firstCost),projectedTotalCommitmentUsd:null,unusedBudgetUsd:null,reasons:[reason],safeguards});
 const {firstOrders,expectedRepeatOrders,averageOrderUsd,firstRewardPercent,desiredComebackPercent,grossMarginPercent,merchantBudgetUsd}=input;
 if(![firstOrders,expectedRepeatOrders,averageOrderUsd,firstRewardPercent,desiredComebackPercent,grossMarginPercent,merchantBudgetUsd].every(valid) ||
  !Number.isSafeInteger(firstOrders)||firstOrders<1||!Number.isSafeInteger(expectedRepeatOrders)||
  averageOrderUsd<=0||firstRewardPercent>100||desiredComebackPercent>100||grossMarginPercent>100)
  return refuse('Invalid campaign assumptions.');
 const firstPerOrder=Math.min(10,averageOrderUsd*firstRewardPercent/100);
 const firstCost=roundCent(firstOrders*firstPerOrder);
 if(merchantBudgetUsd<firstCost)return refuse('Budget cannot fund the forecast first-purchase rewards. Reduce the first reward or increase explicitly approved funding.',firstCost);
 if(firstRewardPercent>=grossMarginPercent)return refuse('The first-order reward rate consumes the entire assumed gross margin.',firstCost);
 if(expectedRepeatOrders===0)return refuse('No expected return orders were provided; cannot justify or size a comeback reward.',firstCost);
 // The proposed return reward is no more than the merchant-requested rate, margin buffer or remaining budget.
 const allowedPercent=Math.min(desiredComebackPercent,Math.max(0,grossMarginPercent-firstRewardPercent),
  100*Math.max(0,merchantBudgetUsd-firstCost)/(expectedRepeatOrders*averageOrderUsd),100);
 const proposed=Math.floor(allowedPercent*100)/100; // round down to 1 basis point
 const returnPerOrder=Math.min(10,averageOrderUsd*proposed/100);
 const cost=roundCent(firstCost+expectedRepeatOrders*returnPerOrder);
 if(proposed<=0||cost>merchantBudgetUsd+0.001)return refuse('No affordable positive return reward fits the provided budget and margin assumptions.',firstCost);
 return {verdict:'PROPOSED',proposedComebackPercent:proposed,firstRewardCommitmentUsd:firstCost,
   projectedTotalCommitmentUsd:cost,unusedBudgetUsd:roundCent(Math.max(0,merchantBudgetUsd-cost)),
   reasons:proposed<desiredComebackPercent?['The desired comeback rate was reduced to fit stated spending and gross-margin limits.']:['Desired comeback rate fits the stated spending and gross-margin limits.'],safeguards};
}
