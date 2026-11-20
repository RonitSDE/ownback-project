/**
 * Durable claim-email intent. NO external network request may run before this
 * transaction commits: once the email provider receives a link, its token must
 * already be redeemable in PostgreSQL.
 */
import type {PoolClient} from 'pg';
import {encryptToken,issueToken,orderHash} from './security';

export type QueuedClaim={queued:boolean;demoToken?:string};
export type ClaimKind='FIRST'|'COMEBACK';

export function claimEmailIdempotencyKey(shop:string,orderId:string){
 // Stable across retry/restart; do not include a random token or PII.
 return `ownback-claim-${orderHash(shop,orderId).slice(2)}`;
}

export async function queueShopifyClaim(
 db:Pick<PoolClient,'query'>,
 input:{shop:string;orderId:string;email:string;orderLabel:string;kind:ClaimKind}
):Promise<QueuedClaim>{
 const {shop,orderId,email,orderLabel,kind}=input;
 const {token,digest}=issueToken();
 // Encrypt the token and recipient; the reward ledger never contains raw email.
 const tokenCiphertext=encryptToken(token);
 const recipientCiphertext=encryptToken(email);
 const locked=await db.query(`UPDATE shopify_reward_orders
   SET status='CLAIM_SENT',claim_token_hash=$3,claim_expires_at=now()+interval '7 days',updated_at=now()
   WHERE shop_domain=$1 AND order_id=$2 AND status IN ('HOLD','READY')
     AND reward_eligible_at<=now()
     AND NOT EXISTS(SELECT 1 FROM shopify_refund_markers WHERE shop_domain=$1 AND order_id=$2)
   RETURNING order_id`,[shop,orderId,digest]);
 if(!locked.rowCount)return {queued:false};
 await db.query(`INSERT INTO shopify_claim_outbox
  (shop_domain,order_id,token_ciphertext,recipient_ciphertext,order_label,reward_kind,idempotency_key,status)
  VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
  [shop,orderId,tokenCiphertext,recipientCiphertext,orderLabel.slice(0,100),kind,claimEmailIdempotencyKey(shop,orderId)]);
 // The caller must use a database transaction. A failure here rolls back the
 // claimed status and the email intent together.
 return {queued:true,demoToken:token};
}
