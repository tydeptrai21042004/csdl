import { setupConnectionUrl } from './db-env.mjs';
import {readFileSync} from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
import { pgOptions } from './pg-options.mjs';
dotenv.config({path:'.env.local'});dotenv.config();
const connectionString=setupConnectionUrl();
if(!connectionString)throw new Error('DATABASE_URL_UNPOOLED required.');
const scripts=['05_upgrade_from_v2.sql','06_neon_security.sql'].map(name=>readFileSync('database/'+name,'utf8').replace(/^([\s\S]*?)(^BEGIN;\s*)/m,'$1').replace(/\s*COMMIT;\s*$/,'') );
const client=new pg.Client(pgOptions(connectionString));
try {
  await client.connect();
  await client.query('BEGIN');
  try {for(const sql of scripts)await client.query(sql);await client.query('COMMIT');}
  catch(e){await client.query('ROLLBACK');throw e;}
  console.log('Non-destructive upgrade plus Neon database access control installed.');
}
finally{await client.end();}
