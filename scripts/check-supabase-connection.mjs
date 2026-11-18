/** Read-only Supabase connection diagnostic; never displays credentials. */
import dotenv from 'dotenv';
import pg from 'pg';
import {runtimeConnectionUrl,setupConnectionUrl} from './db-env.mjs';
dotenv.config({path:'.env.local'});dotenv.config();
for (const [name,connectionString] of [['runtime',runtimeConnectionUrl()],['setup',setupConnectionUrl()]]) {
  const client=new pg.Client({connectionString,connectionTimeoutMillis:10000,query_timeout:10000});
  try {
    await client.connect();
    const result=await client.query("SELECT current_database() AS database, current_user AS role, to_regclass('public.user_account') IS NOT NULL AS initialized");
    console.log(name+': connected, database='+result.rows[0].database+', initialized='+result.rows[0].initialized);
  } catch(e) {console.error(name+': connection failed ('+(e.code||'connection error')+'). Check Supabase Connect URLs and network access.'); process.exitCode=1;}
  finally {await client.end().catch(()=>{});}
}
