import {createHash} from 'node:crypto';
import {pool} from './db';
export async function enforceLimit(scope:string,identity:string,max:number,windowMinutes:number){
 const key=createHash('sha256').update(`${scope}:${identity.toLowerCase()}`).digest('hex');
 const {rows}=await pool.query(`INSERT INTO commerce_rate_limits(key,window_start,hits)
 VALUES($1,to_timestamp(floor(extract(epoch FROM now())/($2*60))*($2*60)),1)
 ON CONFLICT(key) DO UPDATE SET window_start=CASE WHEN commerce_rate_limits.window_start < now()-make_interval(mins=>$2) THEN EXCLUDED.window_start ELSE commerce_rate_limits.window_start END,
 hits=CASE WHEN commerce_rate_limits.window_start < now()-make_interval(mins=>$2) THEN 1 ELSE commerce_rate_limits.hits+1 END
 RETURNING hits`,[key,windowMinutes]);
 if(Number(rows[0].hits)>max)throw new Error('Rate limit exceeded. Try again later.');
}
