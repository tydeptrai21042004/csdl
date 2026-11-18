/** Shared connection URI selection for CLI scripts (loaded after dotenv). */
export function runtimeConnectionUrl() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set POSTGRES_URL (Supabase Transaction pooler) in .env.local or Vercel.');
  return url;
}
export function setupConnectionUrl() {
  // Prefer the same provider for setup and runtime; avoid stale Neon credentials.
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  return process.env.DATABASE_URL_UNPOOLED || runtimeConnectionUrl();
}
