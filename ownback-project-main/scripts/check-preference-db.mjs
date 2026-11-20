/** Diagnose preference receipt storage: runs the same INSERT as /api/allocation/approve inside a
 * transaction that is always rolled back. Usage: DATABASE_URL='<Render value>' node scripts/check-preference-db.mjs */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
if (!process.env.DATABASE_URL) throw Error('Set DATABASE_URL to the value used by the server');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = await pool.connect();
try {
  const who = await db.query('SELECT current_user, current_database()');
  console.log('Connected as', who.rows[0]);
  await db.query('BEGIN');
  await db.query(
    `INSERT INTO allocation_preferences
     (wallet,origin,nonce,chain_id,stock,reward_cents,payload_digest,verified_signature,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9/1000.0))
     ON CONFLICT(wallet,nonce) DO NOTHING RETURNING id`,
    [
      '0x' + '1'.repeat(40),
      'https://example.test',
      randomUUID(),
      84532,
      'AAPLc',
      200,
      'a'.repeat(64),
      '0x' + 'ab'.repeat(65),
      Date.now() + 300000,
    ],
  );
  console.log('OK: insert works (rolled back, nothing saved)');
} catch (e) {
  console.log('FAILED:', e.code, e.message);
} finally {
  await db.query('ROLLBACK').catch(() => {});
  db.release();
  await pool.end();
}
