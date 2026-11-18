/** Neon connection URI selection for Node CLI scripts. */
function assertNeonUrl(raw, variable, direct) {
  if (!raw) throw new Error(`Missing ${variable}. Copy the Neon ${direct?'direct':'pooled'} connection URL into .env.local.`);
  let url;
  try { url = new URL(raw); } catch { throw new Error(`${variable} is not a valid URL.`); }
  if (!['postgres:','postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')) {
    throw new Error(`${variable} is not a Neon PostgreSQL connection URL.`);
  }
  if (!direct && !url.hostname.includes('-pooler.')) throw new Error(`${variable} must be pooled (-pooler in hostname).`);
  if (direct && url.hostname.includes('-pooler.')) throw new Error(`${variable} must be unpooled (direct).`);
  return raw;
}
function verifySameDatabase() {
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_UNPOOLED) return;
  const a = new URL(process.env.DATABASE_URL), b = new URL(process.env.DATABASE_URL_UNPOOLED);
  if (a.hostname.replace('-pooler.','.') !== b.hostname || a.username !== b.username || a.pathname !== b.pathname)
    throw new Error('Neon pooled/direct URLs must point to the SAME endpoint, database and role.');
}
export function runtimeConnectionUrl() {
  const url=assertNeonUrl(process.env.DATABASE_URL, 'DATABASE_URL', false);
  verifySameDatabase();
  return url;
}
export function setupConnectionUrl() {
  const url=assertNeonUrl(process.env.DATABASE_URL_UNPOOLED, 'DATABASE_URL_UNPOOLED', true);
  verifySameDatabase();
  return url;
}
