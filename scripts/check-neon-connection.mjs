/** Read-only Neon connection diagnostic; never displays credentials. */
import dotenv from 'dotenv';
import pg from 'pg';
import { pgOptions } from './pg-options.mjs';
import {runtimeConnectionUrl,setupConnectionUrl} from './db-env.mjs';
dotenv.config({path:'.env.local'});dotenv.config();
for (const [name,connectionString] of [['runtime',runtimeConnectionUrl()],['setup',setupConnectionUrl()]]) {
  let client;
  try {
    client=new pg.Client({...pgOptions(connectionString),connectionTimeoutMillis:10000,query_timeout:10000});
    await client.connect();
    const result=await client.query("SELECT current_database() AS database, current_user AS role, to_regclass('public.user_account') IS NOT NULL AS initialized");
    console.log(name+': connected, database='+result.rows[0].database+', initialized='+result.rows[0].initialized);
  } catch(e) {console.error(name+': connection failed ('+(e.code||'configuration error')+'): '+String(e.message||'').replace(/postgres(?:ql)?:\/\/\S+/gi,'[DB URL REDACTED]')); process.exitCode=1;}
  finally {if (client) await client.end().catch(()=>{});}
}
