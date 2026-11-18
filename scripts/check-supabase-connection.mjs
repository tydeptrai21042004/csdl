/** Read-only connection & schema diagnostic; never print credentials. */
import dotenv from 'dotenv';
import pg from 'pg';
import { pgOptions } from './pg-options.mjs';
import { runtimeConnectionUrl, setupConnectionUrl } from './db-env.mjs';
dotenv.config({path:'.env.local'}); dotenv.config();
let failed = false;
for (const [name, connectionString] of [
  ['runtime (6543)', runtimeConnectionUrl()],
  ['setup (5432)', setupConnectionUrl()]
]) {
  let client;
  try {
    client=new pg.Client({...pgOptions(connectionString),connectionTimeoutMillis:10000,query_timeout:10000});
    await client.connect();
    const result=await client.query(`SELECT current_database() AS database, current_user AS role,
      to_regclass('public.user_account') IS NOT NULL AS user_account_exists,
      to_regclass('public.station') IS NOT NULL AS station_exists,
      to_regclass('public.trip') IS NOT NULL AS trip_exists`);
    const v=result.rows[0];
    console.log(`${name}: CONNECTED, database=${v.database}, user_account=${v.user_account_exists}, station=${v.station_exists}, trip=${v.trip_exists}`);
    if (!v.user_account_exists || !v.station_exists || !v.trip_exists) {
      console.log('  -> Missing tables. On an EMPTY public schema initialize once at /setup (or npm run db:init).');
    } else {
      const counts=await client.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE departure_at>now() AND status='SCHEDULED')::int AS future_scheduled
        FROM public.trip`);
      console.log(`  -> Seed/trips: ${counts.rows[0].total} total, ${counts.rows[0].future_scheduled} future scheduled`);
    }
  } catch (e) {
    failed=true;
    const msg=String(e.message||'').replace(/postgres(?:ql)?:\/\/\S+/gi,'[DB URL REDACTED]');
    console.error(`${name}: FAILED (${e.code||'configuration error'}): ${msg}`);
  } finally {if (client) await client.end().catch(()=>{});}
}
if (failed) process.exitCode=1;
