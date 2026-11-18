import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { hasAdminSession } from '@/lib/auth';

export function reply(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export async function requireAdmin() {
  return (await hasAdminSession()) ? null : reply({ error: 'Administrator login required.' }, 401);
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) return reply({ error: error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; ') }, 400);
  const e = error as { message?: string; code?: string; constraint?: string };
  // Never echo arbitrary SQL/error details such as connection strings to public clients.
  if (e?.code === '42P01' || e?.code === '42883') {
    console.error('Database schema missing/incomplete:', e.code, e.message);
    return reply({ error: 'PostgreSQL connected, but the Intercity database schema or stored procedures are missing. Sign in as administrator, open /setup, and initialize schema + seed on an EMPTY database. Never overwrite a populated database.' }, 503);
  }
  if (e?.code === 'SELF_SIGNED_CERT_IN_CHAIN' || e?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || e?.message?.includes('certificate verify failed')) {
    console.error('PostgreSQL TLS configuration:', e.code || 'CA_MISSING');
    return reply({ error: 'Neon PostgreSQL TLS verification failed. Use the Neon Console connection strings and check the deployment Node.js trusted CA store.' }, 503);
  }
  if (e?.code === '23505') return reply({ error: 'Duplicate or already reserved record. Choose another seat, bus, or identifier.' }, 409);
  if (e?.code === '23P01') return reply({ error: 'Scheduling conflict: the bus is already assigned during these hours.' }, 409);
  if (e?.code === '23503') return reply({ error: 'This record is referenced elsewhere and cannot be changed/deleted.' }, 409);
  if (e?.code === '23514' || e?.code === '22023' || e?.code === 'P0002') return reply({ error: e.message || 'Business validation failed.' }, 400);
  console.error('Backend error:', e?.code || '', e?.message || String(error));
  return reply({ error: 'Unexpected server/database error. Check the server logs and database configuration.' }, 500);
}
