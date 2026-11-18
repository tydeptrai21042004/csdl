import 'server-only';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const COOKIE_NAME = 'intercity_demo_admin';
const SESSION_DURATION = 60 * 60 * 8;

function requireSecrets() {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must be configured with at least 12 characters.');
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
  }
}
function sign(input: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET!).update(input).digest('hex');
}
function equal(a: string, b: string): boolean {
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function verifyPassword(candidate: string): boolean {
  requireSecrets();
  const actual = createHash('sha256').update(process.env.ADMIN_PASSWORD!).digest('hex');
  const proposed = createHash('sha256').update(candidate).digest('hex');
  return equal(actual, proposed);
}
export async function createAdminSession(): Promise<void> {
  requireSecrets();
  const payload = `${Math.floor(Date.now() / 1000) + SESSION_DURATION}.${randomBytes(16).toString('hex')}`;
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: SESSION_DURATION
  });
}
export async function hasAdminSession(): Promise<boolean> {
  if (!process.env.SESSION_SECRET) return false;
  const token = (await cookies()).get(COOKIE_NAME)?.value || '';
  const match = token.match(/^(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  return equal(sign(`${match[1]}.${match[2]}`), match[3]);
}
export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
