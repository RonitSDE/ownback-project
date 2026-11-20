import { createPublicClient,http,parseEventLogs,type Hex,type Address } from 'viem';
import { base,baseSepolia,foundry } from 'viem/chains';
import { ownbackAbi } from '@/lib/abi';
import { orderReference } from './core';
const chainId=Number(process.env.COMMERCE_CHAIN_ID ?? '84532');
if (![31337,84532,8453].includes(chainId)) throw new Error('Unsupported commerce chain');
if (chainId === 8453 && (process.env.COMMERCE_LIVE_STOCK_ENABLED !== 'true' || process.env.MAINNET_OPERATIONS_APPROVED !== 'true')) throw new Error('Mainnet commerce is gated until explicit operational approval');
export const commerceChain=chainId===31337?foundry:chainId===8453?base:baseSepolia;
export const commercePublicClient=createPublicClient({chain:commerceChain,transport:http(process.env.COMMERCE_RPC_URL)});
export function settings(){
  const vault=process.env.COMMERCE_VAULT_ADDRESS as Address;
  const merchant=process.env.COMMERCE_MERCHANT_WALLET as Address;
  const campaign=process.env.COMMERCE_CAMPAIGN_ID;
  if (!/^0x[0-9a-fA-F]{40}$/.test(vault ?? '') || !/^0x[0-9a-fA-F]{40}$/.test(merchant ?? '') || !/^\d+$/.test(campaign??'') || !process.env.COMMERCE_RPC_URL) throw new Error('Commerce chain not configured');
  if (process.env.NEXT_PUBLIC_OWNBACK_ADDRESS?.toLowerCase() !== vault.toLowerCase() || process.env.NEXT_PUBLIC_CAMPAIGN_ID !== campaign || Number(process.env.NEXT_PUBLIC_CHAIN_ID) !== chainId) throw new Error('Commerce and storefront contract configuration mismatch');
  const usdc = process.env.COMMERCE_USDC_ADDRESS;
  if (chainId === 8453 && usdc?.toLowerCase() !== '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') throw new Error('Mainnet commerce requires Circle native USDC');
  return { vault,merchant,campaign:campaign!,chainId,usdc:usdc as Address};
}
export function expectedRef(orderId:string){const s=settings();return orderReference(orderId,s.chainId,s.vault,s.campaign);}
export async function verifyPayment(hash: Hex, order:{id:string;wallet:string;total_usdc:string|number;order_ref:string}) {
  const s=settings();const receipt=await commercePublicClient.getTransactionReceipt({hash});
  if(receipt.status!=='success') throw new Error('Unsuccessful payment receipt');
  const head=await commercePublicClient.getBlockNumber();
  if(head < receipt.blockNumber + 2n)throw new Error('Payment awaiting 3 chain confirmations; retry verification shortly');
  const events=parseEventLogs({abi:ownbackAbi,logs:receipt.logs,eventName:'Purchased',strict:true});
  const match=events.find(e=>e.address.toLowerCase()===s.vault.toLowerCase() &&
    e.args.campaignId===BigInt(s.campaign) &&
    e.args.customer.toLowerCase()===order.wallet.toLowerCase() &&
    e.args.amount===BigInt(order.total_usdc) &&
    e.args.orderRef.toLowerCase()===order.order_ref.toLowerCase() &&
    e.args.orderRef.toLowerCase()===expectedRef(order.id).toLowerCase());
  if(!match) throw new Error('Transaction does not pay this commerce order');
  if(receipt.from.toLowerCase()!==order.wallet.toLowerCase()) throw new Error('Wrong transaction sender');
  return { purchaseId:match.args.purchaseId.toString(),block:receipt.blockNumber.toString(),hash };
}
export async function usedOnchain(ref:Hex, payer:Address){
  const s=settings();
  return commercePublicClient.readContract({address:s.vault,abi:ownbackAbi,functionName:'orderRefUsed',args:[BigInt(s.campaign),payer,ref]});
}
export async function checkCampaign(){
  const s=settings();const c=await commercePublicClient.readContract({address:s.vault,abi:ownbackAbi,functionName:'campaigns',args:[BigInt(s.campaign)]});
  if((c as unknown as {merchant?:string}).merchant && (c as unknown as {merchant:string}).merchant.toLowerCase()!==s.merchant.toLowerCase()) throw new Error('Configured campaign merchant mismatch');
  // ABI returns an array of struct outputs in some viem versions.
  if(Array.isArray(c) && String(c[0]).toLowerCase()!==s.merchant.toLowerCase()) throw new Error('Configured campaign merchant mismatch');
  return c;
}
