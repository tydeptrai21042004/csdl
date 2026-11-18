import { queryRows } from '@/lib/db';
import { apiError, reply } from '@/lib/api';
export const runtime = 'nodejs';
export async function GET() {
 try {
   const rows = await queryRows<{ ok: number }>('SELECT 1 AS ok');
   return reply({ status: rows[0]?.ok === 1 ? 'connected' : 'error', database: 'PostgreSQL' });
 } catch(e) { return apiError(e); }
}
