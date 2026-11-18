import 'server-only';
import { Pool } from 'pg';
import { sqlBundle } from '@/generated/db-bundle';
import { getPool } from '@/lib/db';
import { setupDatabaseUrl } from '@/lib/db-config';
import { pgOptions } from '@/lib/pg-options';

// Security DDL must run before seed DML: otherwise deferred constraint triggers
// from 03_seed.sql block ALTER TABLE in 06_neon_security.sql (SQLSTATE 55006).
const INITIALIZATION_ORDER = [
  '01_schema.sql', '02_logic.sql', '06_neon_security.sql', '03_seed.sql'
] as const;

export const EXPECTED_TABLES = [
  'user_account','passenger_profile','platform_admin','bus_operator','operator_staff',
  'operator_phone','driver','bus','seat','station','route','route_stop',
  'trip','trip_seat','trip_driver_assignment','promotion','booking','ticket',
  'payment_method','payment','refund','invoice','review'
] as const;

export async function databaseStatus() {
  const { rows } = await getPool().query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`);
  const names = new Set(rows.map(row => row.table_name));
  const missing = EXPECTED_TABLES.filter(name => !names.has(name));
  const initialized = missing.length === 0;
  const state = rows.length === 0 ? 'empty' : initialized ? 'ready' : 'partial';
  let trip_count: number | null = null;
  if (names.has('trip')) {
    const count = await getPool().query<{ total: number }>('SELECT count(*)::int AS total FROM public.trip');
    trip_count = count.rows[0].total;
  }
  return { initialized, state, table_count: rows.length, trip_count, missing_tables: missing };
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
  const pool=new Pool({...pgOptions(url),max:1,connectionTimeoutMillis:18000});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL statement_timeout = 45000');
      await client.query('SELECT pg_advisory_xact_lock(927160, 2026)');
      const exists=await client.query("SELECT to_regclass('public.user_account') AS found");
      if(exists.rows[0].found) throw new Error('Database is already initialized. Existing data was not modified. Use a fresh Neon database/branch (or an empty dedicated public schema) for a fresh seed.');
      const existing=await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' LIMIT 1`);
      if(existing.rowCount) throw new Error('The public schema contains unrelated tables. Setup only runs on an empty database.');
      // Apply all security ALTER TABLE statements before inserting any seed data.
      // Seed DML queues INITIALLY DEFERRED constraint triggers (user ISA, route stops).
      // Running security ALTER TABLE after the seed would fail with SQLSTATE 55006.
      for (const filename of INITIALIZATION_ORDER) {
        const file = sqlBundle.find(entry => entry.filename === filename);
        if (!file) throw new Error(`Required setup SQL file ${filename} is missing from the deployment bundle.`);
        await client.query(withoutTransactionWrapper(file.sql));
      }
      // Validate queued deferred constraint triggers before committing, while keeping
      // schema, permissions and all seed rows in the same atomic transaction.
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      await client.query('COMMIT');
      return {ok:true,files:[...INITIALIZATION_ORDER],message:'Created 23 tables, business logic, Neon security, and populated sample records.'};
    }catch(e){await client.query('ROLLBACK');throw e;}
  }finally{client.release();await pool.end();}
}

/** Non-destructive upgrade for an existing v2 PostgreSQL database, authorized by /setup. */
export async function upgradeDatabase() {
  const url=setupDatabaseUrl();
  const pool=new Pool({...pgOptions(url),max:1,connectionTimeoutMillis:18000});
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
      const security=sqlBundle.find(f=>f.filename==='06_neon_security.sql');
      if(security) await client.query(withoutTransactionWrapper(security.sql));
      await client.query('COMMIT');
      return {ok:true,message:'Existing 23-table database upgraded without deleting historical records. Passenger routines and seat inventory are installed.'};
    }catch(e){await client.query('ROLLBACK');throw e;}
  }finally{client.release();await pool.end();}
}
