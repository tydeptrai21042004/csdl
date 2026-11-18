import 'server-only';
/** Keep all Intercity traffic on the intended Neon project. */
function validateUrl(rawUrl: string, variable: string): string {
  let parsed: URL;
  try { parsed = new URL(rawUrl); }
  catch { throw new Error(`${variable} must be a valid Neon PostgreSQL URL.`); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname.endsWith('.neon.tech')) {
    throw new Error(`${variable} must point to a Neon PostgreSQL endpoint (*.neon.tech), not Supabase.`);
  }
  if (variable === 'DATABASE_URL' && !parsed.hostname.includes('-pooler.')) {
    throw new Error('DATABASE_URL must use the pooled Neon URL (hostname contains -pooler).');
  }
  if (variable === 'DATABASE_URL_UNPOOLED' && parsed.hostname.includes('-pooler.')) {
    throw new Error('DATABASE_URL_UNPOOLED must be the DIRECT connection from Neon (without -pooler).');
  }
  return rawUrl;
}
function verifySameDatabase(): void {
  const pool = process.env.DATABASE_URL;
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (!pool || !direct) return;
  const a = new URL(pool), b = new URL(direct);
  if (a.hostname.replace('-pooler.', '.') !== b.hostname || a.username !== b.username || a.pathname !== b.pathname) {
    throw new Error('Neon pooled and direct URLs must target the SAME endpoint, role and database.');
  }
}
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing. Set the pooled Neon connection string in Vercel.');
  const url = validateUrl(raw, 'DATABASE_URL');
  verifySameDatabase();
  return url;
}
export function setupDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_UNPOOLED;
  if (!raw) throw new Error('DATABASE_URL_UNPOOLED missing. Set the direct Neon connection string for setup/migrations.');
  const url = validateUrl(raw, 'DATABASE_URL_UNPOOLED');
  verifySameDatabase();
  return url;
}
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_UNPOOLED);
}
