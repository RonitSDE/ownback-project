import { pool } from '@/lib/commerce/db';
import { decryptToken, validatedShop } from './security';
export async function storedToken(domain: string) {
  const shop = validatedShop(domain);
  const { rows } = await pool.query(
    'SELECT token_ciphertext FROM shopify_installations WHERE shop_domain=$1 AND active=true',
    [shop],
  );
  if (!rows[0]) throw Error('Shopify store disconnected');
  return decryptToken(rows[0].token_ciphertext as string);
}
export type ShopifyLiveOrder = {
  id: string;
  name: string;
  email: string | null;
  cancelledAt: string | null;
  displayFinancialStatus: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  totalRefundedSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { id: string } | null;
};
/** Authoritative verification before issuing a claim or any financial settlement. */
export async function getLiveOrder(shop: string, id: string): Promise<ShopifyLiveOrder> {
  if (!/^\d+$/.test(id)) throw Error('Invalid Shopify order ID');
  const token = await storedToken(shop);
  const query = `query OWNBACKOrder($id: ID!) {
 order(id:$id) { id name email cancelledAt displayFinancialStatus
   totalPriceSet { shopMoney { amount currencyCode } }
   totalRefundedSet { shopMoney { amount currencyCode } }
   customer { id } }
 }`;
  const res = await fetch(`https://${validatedShop(shop)}/admin/api/2026-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables: { id: `gid://shopify/Order/${id}` } }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw Error(`Shopify Admin API HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors?.length || !data.data?.order)
    throw Error('Shopify order not accessible with granted scopes');
  return data.data.order as ShopifyLiveOrder;
}
export function isLiveOrderPaid(o: ShopifyLiveOrder) {
  return (
    o.displayFinancialStatus === 'PAID' && !o.cancelledAt && Number(o.totalRefundedSet.shopMoney.amount) === 0
  );
}
