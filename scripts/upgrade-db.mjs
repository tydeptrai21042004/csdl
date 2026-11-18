import { setupConnectionUrl } from './db-env.mjs';
import {readFileSync} from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({path:'.env.local'});dotenv.config();
const connectionString=setupConnectionUrl();
if(!connectionString)throw new Error('POSTGRES_URL or POSTGRES_URL_NON_POOLING required.');
const scripts=['05_upgrade_from_v2.sql','06_supabase_security.sql'].map(name=>readFileSync('database/'+name,'utf8').replace(/^([\s\S]*?)(^BEGIN;\s*)/m,'$1').replace(/\s*COMMIT;\s*$/,'') );
const client=new pg.Client({connectionString});
try {
  await client.connect();
  await client.query('BEGIN');
  try {for(const sql of scripts)await client.query(sql);await client.query('COMMIT');}
  catch(e){await client.query('ROLLBACK');throw e;}
  console.log('Non-destructive upgrade plus Supabase API hardening installed.');
}
finally{await client.end();}
