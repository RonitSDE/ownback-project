import { Pool, type PoolClient } from 'pg';
const globalDb = globalThis as typeof globalThis & { __ownbackCommerceDb?: Pool };
export const pool = globalDb.__ownbackCommerceDb ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});
if (process.env.NODE_ENV !== 'production') globalDb.__ownbackCommerceDb = pool;
export async function withTx<T>(fn:(c:PoolClient)=>Promise<T>): Promise<T> {
  const c=await pool.connect();
  try { await c.query('BEGIN'); const out=await fn(c); await c.query('COMMIT'); return out; }
  catch(e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
export async function event(c: PoolClient, orderId: string, kind: string, details: Record<string, unknown> = {}) {
  await c.query('INSERT INTO commerce_order_events(order_id,kind,details) VALUES($1,$2,$3::jsonb)', [orderId,kind,JSON.stringify(details)]);
}
