import { randomUUID } from 'node:crypto';
import { type Hex } from 'viem';
import { pool, withTx, event } from './db';
import { canonicalCart, equalSecret, hashSecret, orderReference, receiptToken, totalFor, PURCHASE_WINDOW_SECONDS } from './core';
import { commercePublicClient, expectedRef, settings, usedOnchain, verifyPayment, checkCampaign } from './chain';
export class CommerceError extends Error {constructor(message:string,public status=400){super(message);}}
export type CommerceOrder = {
 id:string;order_number:string;wallet:string;campaign_id:string;order_ref:Hex;total_usdc:string;
 status:string;fulfillment:string;customer_email:string|null;customer_note:string|null;payment_tx:Hex|null;
 purchase_id:string|null;refund_tx:Hex|null;quote_deadline:string;reserved_until:Date;paid_at:Date|null;created_at:Date;
 receipt_token_hash:string;
};
const readOrderSql='SELECT * FROM commerce_orders WHERE id=$1';
export async function listProducts(){
 const {rows}=await pool.query('SELECT id,slug,name,description,image_url,category,fulfillment_type,price_usdc,stock_on_hand-stock_reserved AS available FROM commerce_products WHERE active=true ORDER BY created_at,id');
 return rows;
}
export async function createOrder(input:{cart:unknown;wallet:string;fulfillment:string;email?:string;note?:string}){
 const lines=canonicalCart(input.cart);
 if(!/^0x[0-9a-fA-F]{40}$/.test(input.wallet))throw new CommerceError('Connect a valid wallet');
 if(!['PICKUP','DIGITAL'].includes(input.fulfillment))throw new CommerceError('Choose pickup or digital');
 const email=input.email?.trim()||null;
 if(email && (email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new CommerceError('Invalid email');
 if(input.note && input.note.length>500)throw new CommerceError('Note is too long');
 const s=settings();await checkCampaign();
 const wallet=input.wallet.toLowerCase();
 const receipt=receiptToken();const id=randomUUID();
 const ref=orderReference(id,s.chainId,s.vault,s.campaign);
 const deadline=Math.floor(Date.now()/1000)+PURCHASE_WINDOW_SECONDS;
 return withTx(async c=>{
  const products=await c.query('SELECT * FROM commerce_products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[lines.map(l=>l.productId)]);
  if(products.rows.length!==lines.length)throw new CommerceError('A product is no longer available',409);
  const selected=lines.map(l=>{
   const p=products.rows.find(p=>p.id===l.productId)!;
   if(p.fulfillment_type!==input.fulfillment)throw new CommerceError('All items must use the selected fulfillment method',409);
   if(!p.active || p.stock_on_hand-p.stock_reserved<l.quantity)throw new CommerceError(`${p.name} is out of stock`,409);
   return {...l,name:p.name,unit_usdc:p.price_usdc};
  });
  const total=totalFor(selected);
  await c.query(`INSERT INTO commerce_orders(id,wallet,campaign_id,order_ref,total_usdc,fulfillment,customer_email,customer_note,receipt_token_hash,quote_deadline,reserved_until)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,to_timestamp($11))`,
    [id,wallet,s.campaign,ref,total.toString(),input.fulfillment,email,input.note||null,hashSecret(receipt),deadline,deadline+300]);
  for(const l of selected){
   await c.query('INSERT INTO commerce_order_items(order_id,product_id,name,quantity,unit_usdc) VALUES($1,$2,$3,$4,$5)',[id,l.productId,l.name,l.quantity,String(l.unit_usdc)]);
   await c.query('UPDATE commerce_products SET stock_reserved=stock_reserved+$1 WHERE id=$2',[l.quantity,l.productId]);
  }
  await event(c,id,'RESERVED',{count:lines.length});
  return {id,token:receipt,wallet,orderRef:ref,amountUsdc:total.toString(),quoteDeadline:deadline,campaignId:s.campaign,chainId:s.chainId,vault:s.vault,merchant:s.merchant};
 });
}
export async function getOrder(id:string,token:string){
 if(!/^[0-9a-f-]{36}$/i.test(id)||!token||token.length>256)throw new CommerceError('Invalid order receipt',401);
 const {rows}=await pool.query(`${readOrderSql}`,[id]);const order=rows[0] as CommerceOrder|undefined;
 if(!order||!equalSecret(token,order.receipt_token_hash))throw new CommerceError('Order not found',404);
 const items=await pool.query('SELECT product_id,name,quantity,unit_usdc FROM commerce_order_items WHERE order_id=$1 ORDER BY name',[id]);
 const events=await pool.query('SELECT kind,details,at FROM commerce_order_events WHERE order_id=$1 ORDER BY id',[id]);
 const {receipt_token_hash:_ignored,...publicOrder}=order;
 return {...publicOrder,items:items.rows,events:events.rows};
}
async function applyVerifiedPayment(id:string,hash:Hex,proof:{purchaseId:string;block:string;hash:Hex}){
 return withTx(async c=>{
  const row=await c.query(`${readOrderSql} FOR UPDATE`,[id]);const db=row.rows[0] as CommerceOrder|undefined;
  if(!db)throw new CommerceError('Unknown order',404);
  if(['PAID','FULFILLED','REFUND_PENDING','REFUNDED','REFUNDED_AFTER_REWARD'].includes(db.status) && db.payment_tx?.toLowerCase()===hash.toLowerCase())return {status:db.status,hash};
  if(db.status!=='AWAITING_PAYMENT')throw new CommerceError('Order needs manual reconciliation',409);
  const reservedItems=await c.query('SELECT * FROM commerce_order_items WHERE order_id=$1 ORDER BY product_id',[id]);
  for(const item of reservedItems.rows){
   const p=await c.query('UPDATE commerce_products SET stock_reserved=stock_reserved-$1, stock_on_hand=stock_on_hand-$1, updated_at=now() WHERE id=$2 AND stock_reserved >= $1 AND stock_on_hand >= $1 RETURNING id',[item.quantity,item.product_id]);
   if(!p.rowCount)throw new CommerceError('Inventory mismatch; payment requires manual fulfillment',409);
  }
  await c.query(`UPDATE commerce_orders SET status='PAID',payment_tx=$1,purchase_id=$2,paid_at=now(),updated_at=now() WHERE id=$3`,[hash.toLowerCase(),proof.purchaseId,id]);
  await event(c,id,'PAYMENT_CONFIRMED',{hash:hash.toLowerCase(),purchaseId:proof.purchaseId,block:proof.block});
  return {status:'PAID',hash,purchaseId:proof.purchaseId};
 });
}
export async function confirmOrder(id:string,token:string,hash:Hex){
 if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new CommerceError('Invalid transaction hash');
 const o=await getOrder(id,token);
 if(o.status==='PAID'||o.status==='FULFILLED'||o.status.startsWith('REFUND')){
  if(o.payment_tx?.toLowerCase()===hash.toLowerCase())return {status:o.status,hash};
  throw new CommerceError('Order already paid with a different transaction',409);
 }
 if(o.status!=='AWAITING_PAYMENT')throw new CommerceError('Order is no longer payable',409);
 const proof=await verifyPayment(hash,o);
 return applyVerifiedPayment(id,hash,proof);
}
export async function confirmIndexedPayment(order:{id:string;wallet:string;total_usdc:string;order_ref:string},hash:Hex){
 const proof=await verifyPayment(hash,order);return applyVerifiedPayment(order.id,hash,proof);
}
export async function releaseOrder(id:string,reason:string){
 const {rows}=await pool.query(readOrderSql,[id]);const order=rows[0] as CommerceOrder|undefined;
 if(!order || order.status!=='AWAITING_PAYMENT')return {released:false,reason:'not pending'};
 const nowBlock=await commercePublicClient.getBlock();
 if(Number(nowBlock.timestamp)<=Number(order.quote_deadline))return {released:false,reason:'quote not expired'};
 if(await usedOnchain(order.order_ref,order.wallet as `0x${string}`))return {released:false,reason:'payment present onchain; needs reconciliation'};
 return withTx(async c=>{
  const r=await c.query(`${readOrderSql} FOR UPDATE`,[id]);if(!r.rows.length||r.rows[0].status!=='AWAITING_PAYMENT')return {released:false,reason:'already processed'};
  // Onchain deadline passed, and confirmed chain state says reference not used.
  const items=await c.query('SELECT product_id,quantity FROM commerce_order_items WHERE order_id=$1 ORDER BY product_id',[id]);
  for(const l of items.rows){await c.query('UPDATE commerce_products SET stock_reserved=stock_reserved-$1 WHERE id=$2 AND stock_reserved >= $1',[l.quantity,l.product_id]);}
  await c.query("UPDATE commerce_orders SET status='CANCELED',cancel_reason=$1,updated_at=now() WHERE id=$2",[reason,id]);
  await event(c,id,'RESERVATION_RELEASED',{reason});return {released:true};
 });
}
export async function reconcileOpen(limit=50){
 const {rows}=await pool.query("SELECT id FROM commerce_orders WHERE status='AWAITING_PAYMENT' AND reserved_until<now() ORDER BY reserved_until LIMIT $1",[limit]);
 const results=[];for(const r of rows){try{results.push({id:r.id,...await releaseOrder(r.id,'Expired unpaid order')});}catch(e){results.push({id:r.id,error:String(e)});}}return results;
}
