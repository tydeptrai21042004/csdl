import { setupConnectionUrl } from './db-env.mjs';
// Execute all schema files on a fresh database; they are intentionally not idempotent.
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { pgOptions } from './pg-options.mjs';
dotenv.config({path:'.env.local'}); dotenv.config();
const connectionString=setupConnectionUrl();
if(!connectionString) {console.error('Set DATABASE_URL_UNPOOLED in .env.local first.');process.exit(1);}
const client=new pg.Client(pgOptions(connectionString));
// Run ALTER TABLE security statements before seed DML queues deferred constraint triggers.
// This avoids SQLSTATE 55006 (cannot ALTER TABLE with pending trigger events).
const files=['01_schema.sql','02_logic.sql','06_neon_security.sql','03_seed.sql'];
try {
 await client.connect();
 const exists=await client.query("SELECT to_regclass('public.user_account') AS present");
 if(exists.rows[0].present) throw new Error('Database already contains user_account. Refusing to overwrite existing data.');
 const existing=await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' LIMIT 1");
 if(existing.rowCount)throw new Error('Public schema contains existing tables. Initialize a fresh empty Neon database instead.');
 await client.query('BEGIN');
 try {
  for(const file of files) {
   console.log(`Applying database/${file} ...`);
   const sql=readFileSync(resolve('database',file),'utf8')
     .replace(/^([\s\S]*?)(^BEGIN;\s*)/m, '$1')
     .replace(/\s*COMMIT;\s*$/, '');
   await client.query(sql);
  }
  // Execute deferred data-integrity checks before the final transaction COMMIT.
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  await client.query('COMMIT');
 } catch(err) {await client.query('ROLLBACK');throw err;}
 console.log('Database initialized atomically: 23 relations, triggers, procedures, functions, sample data.');
} catch(e) {console.error('Initialization FAILED:',e.message);process.exitCode=1;}
finally{await client.end();}
