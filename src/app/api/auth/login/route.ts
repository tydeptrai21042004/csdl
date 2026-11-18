import { z } from 'zod';
import { createAdminSession, verifyPassword } from '@/lib/auth';
import { apiError, reply } from '@/lib/api';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { password } = z.object({ password: z.string() }).parse(await request.json());
    if (!verifyPassword(password)) return reply({ error: 'Incorrect administrator password.' }, 401);
    await createAdminSession();
    return reply({ ok: true });
  } catch (e) { return apiError(e); }
}
