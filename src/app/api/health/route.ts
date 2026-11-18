import { databaseStatus } from '@/lib/bootstrap';
import { apiError, reply } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const status = await databaseStatus();
    if (!status.initialized) {
      return reply({ status: 'schema_missing', database: 'PostgreSQL', ...status,
        message: status.state === 'empty'
          ? 'Connected to PostgreSQL, but the schema is empty. Open /setup as admin to initialize schema + seed.'
          : 'Connected to PostgreSQL, but the public schema is incomplete/nonempty. Inspect missing_tables; do not rerun initial setup over existing data.' }, 503);
    }
    return reply({ status: 'connected', database: 'PostgreSQL', ...status });
  } catch (e) { return apiError(e); }
}
