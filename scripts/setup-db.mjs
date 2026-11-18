import { setupConnectionUrl } from './db-env.mjs';
// Execute all schema files on a fresh database; they are intentionally not idempotent.
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
dotenv.config({path:'.env.local'}); dotenv.config();
const connectionString=setupConnectionUrl();
if(!connectionString) {console.error('Set POSTGRES_URL in .env.local first.');process.exit(1);}
const client=new pg.Client({connectionString});
const files=['01_schema.sql','02_logic.sql','03_seed.sql','06_supabase_security.sql'];
try {
 await client.connect();
 const exists=await client.query("SELECT to_regclass('public.user_account') AS present");
 if(exists.rows[0].present) {throw new Error('Database already contains user_account. For safety, use a fresh Supabase project or a separate empty schema rather than overwriting records.');}
 await client.query('BEGIN');
 try {
  for(const file of files) {
   console.log(`Applying database/${file} ...`);
   const sql=readFileSync(resolve('database',file),'utf8')
     .replace(/^([\s\S]*?)(^BEGIN;\s*)/m, '$1')
     .replace(/\s*COMMIT;\s*$/, '');
   await client.query(sql);
  }
  await client.query('COMMIT');
 } catch(err) {await client.query('ROLLBACK');throw err;}
 console.log('Database initialized atomically: 23 relations, triggers, procedures, functions, sample data.');
} catch(e) {console.error('Initialization FAILED:',e.message);process.exitCode=1;}
finally{await client.end();}
