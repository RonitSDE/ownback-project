import {pool} from '@/lib/commerce/db';
import {merchantDomain} from '@/lib/agentic/ucp';
/** Public discovery is only for shops that actually installed OWNBACK. */
export async function activeAgentShops():Promise<string[]>{
 const {rows}=await pool.query('SELECT shop_domain FROM shopify_installations WHERE active=true AND webhook_ready=true ORDER BY installed_at DESC LIMIT 20');
 const allowed=(process.env.SHOPIFY_AGENT_ALLOWED_SHOPS||process.env.SHOPIFY_ALLOWED_SHOP||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 return rows.map(r=>merchantDomain(r.shop_domain)).filter(shop=>!allowed.length||allowed.includes(shop));
}
export async function requireActiveAgentShop(shop:unknown):Promise<string>{
 const name=merchantDomain(shop);
 if(!(await activeAgentShops()).includes(name))throw Error('This merchant is not connected to OWNBACK');
 return name;
}
