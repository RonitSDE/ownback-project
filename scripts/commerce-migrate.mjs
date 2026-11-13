import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL missing');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{await pool.query(readFileSync(resolve('commerce/schema.sql'),'utf8'));await pool.query(readFileSync(resolve('commerce/shopify.sql'),'utf8'));await pool.query(readFileSync(resolve('commerce/allocations.sql'),'utf8')); console.log('Commerce + Shopify + allocation pilot schema initialized');}finally{await pool.end();}
