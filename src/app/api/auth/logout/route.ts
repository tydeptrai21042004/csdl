import { clearAdminSession } from '@/lib/auth';
import { reply } from '@/lib/api';
export const runtime = 'nodejs';
export async function POST() { await clearAdminSession(); return reply({ ok: true }); }
