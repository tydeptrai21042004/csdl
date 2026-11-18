import 'server-only';
/** Vercel Supabase integration provides POSTGRES_URL and POSTGRES_URL_NON_POOLING. */
export function databaseUrl(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('PostgreSQL connection is missing. Configure POSTGRES_URL in Vercel.');
  return url;
}
export function setupDatabaseUrl(): string {
  // Never mix a Supabase runtime URI with a leftover Neon setup URI.
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  return process.env.DATABASE_URL_UNPOOLED || databaseUrl();
}
export function databaseConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}
