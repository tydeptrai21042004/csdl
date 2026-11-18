import 'server-only';
import { Pool } from 'pg';
import { databaseUrl } from '@/lib/db-config';

declare global {
  // Reuse the pool in local development / warm serverless instances.
  // eslint-disable-next-line no-var
  var __intercityPgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__intercityPgPool) {
    global.__intercityPgPool = new Pool({
      connectionString: databaseUrl(),
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 15000,
      allowExitOnIdle: true,
    });
  }
  return global.__intercityPgPool;
}

export async function queryRows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

export async function callJson(procedure: string, args: unknown[] = []): Promise<unknown> {
  // Only hardcoded procedure names permitted, never pass user-supplied identifiers.
  const allowed = new Set([
    'sp_create_trip', 'sp_update_trip', 'sp_delete_trip',
    'sp_search_trips', 'sp_operator_summary', 'sp_place_booking',
    'sp_expire_bookings', 'sp_capture_demo_payment',
    'sp_place_multi_booking', 'sp_capture_passenger_demo_payment', 'sp_cancel_passenger_hold', 'sp_request_passenger_refund', 'sp_submit_passenger_review', 'sp_issue_passenger_invoice'
  ]);
  if (!allowed.has(procedure)) throw new Error('Unsupported stored procedure.');
  const placeholders = args.map((_, index) => `$${index + 1}`).join(', ');
  const separator = args.length ? ', ' : '';
  const result = await getPool().query(`CALL ${procedure}(${placeholders}${separator}'{}'::jsonb)`, args);
  return result.rows[0]?.p_result ?? null;
}
