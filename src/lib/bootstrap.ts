import 'server-only';
import { Pool } from 'pg';
import { sqlBundle } from '@/generated/db-bundle';
import { getPool } from '@/lib/db';
import { setupDatabaseUrl } from '@/lib/db-config';

export async function databaseStatus() {
  const {rows}=await getPool().query<{initialized:boolean;table_count:number}>(
    `SELECT (to_regclass('public.user_account') IS NOT NULL) AS initialized,
       count(*)::int AS table_count
     FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  const result={...rows[0],trip_count:null as number|null};
  if(result.initialized){
    const data=await getPool().query<{total:number}>('SELECT count(*)::int AS total FROM trip');
    result.trip_count=data.rows[0].total;
  }
  return result;
}

function withoutTransactionWrapper(sql: string) {
  // SQL files start with explanatory comments BEFORE BEGIN;, so anchoring at ^BEGIN
  // silently left nested BEGIN/COMMIT wrappers and could partially commit setup.
  // Strip exactly the standalone top-level wrapper lines, retaining SQL comments.
  const lines=sql.split(/\r?\n/);
  const first=lines.findIndex(line=>line.trim().toUpperCase()==='BEGIN;');
  if(first<0)throw new Error('SQL bundle is missing its expected BEGIN wrapper.');
  lines.splice(first,1);
  let last=lines.length-1;
  while(last>=0&&!lines[last].trim())last--;
  if(last<0||lines[last].trim().toUpperCase()!=='COMMIT;')throw new Error('SQL bundle is missing its expected COMMIT wrapper.');
  lines.splice(last,1);
  return lines.join('\n');
}

export async function bootstrapDatabase() {
  const url=setupDatabaseUrl();
  const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:12000});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL statement_timeout = 25000');
      await client.query('SELECT pg_advisory_xact_lock(927160, 2026)');
      const exists=await client.query("SELECT to_regclass('public.user_account') AS found");
      if(exists.rows[0].found) throw new Error('Database is already initialized. Existing data was not modified. Use a fresh Supabase project (or an empty dedicated public schema) for a fresh seed.');
      const existing=await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' LIMIT 1`);
      if(existing.rowCount) throw new Error('The public schema contains unrelated tables. Setup only runs on an empty database.');
      for(const file of sqlBundle.filter(f=>f.filename!=='05_upgrade_from_v2.sql')) await client.query(withoutTransactionWrapper(file.sql));
      await client.query('COMMIT');
      return {ok:true,files:sqlBundle.filter(f=>f.filename!=='05_upgrade_from_v2.sql').map(x=>x.filename),message:'Created 23 tables, business logic, and populated sample records.'};
    }catch(e){await client.query('ROLLBACK');throw e;}
  }finally{client.release();await pool.end();}
}

/** Non-destructive upgrade for an existing v2 PostgreSQL database, authorized by /setup. */
export async function upgradeDatabase() {
  const url=setupDatabaseUrl();
  const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:12000});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    try{
      await client.query('SET LOCAL statement_timeout = 45000');
      await client.query('SELECT pg_advisory_xact_lock(927160, 2026)');
      const existing=await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
      if(existing.rows[0].n!==23)throw new Error('Upgrade requires the existing 23-table Assignment 1 schema. Use setup on an empty database instead.');
      const migration=sqlBundle.find(f=>f.filename==='05_upgrade_from_v2.sql');
      if(!migration)throw new Error('Upgrade script is missing from the deployment bundle.');
      await client.query(withoutTransactionWrapper(migration.sql));
      const security=sqlBundle.find(f=>f.filename==='06_supabase_security.sql');
      if(security) await client.query(withoutTransactionWrapper(security.sql));
      await client.query('COMMIT');
      return {ok:true,message:'Existing 23-table database upgraded without deleting historical records. Passenger routines and seat inventory are installed.'};
    }catch(e){await client.query('ROLLBACK');throw e;}
  }finally{client.release();await pool.end();}
}
