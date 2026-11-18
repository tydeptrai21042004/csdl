import 'server-only';
import type { ClientConfig } from 'pg';

/**
 * Neon PostgreSQL uses a publicly trusted TLS certificate. Use Node's normal
 * trust store and enforce hostname verification; no Supabase CA is needed.
 * Explicit SSL options take precedence over URL parameters in node-postgres,
 * so remove conflicting URL flags before handing the URL to `pg`.
 */
export function pgOptions(rawUrl: string): ClientConfig {
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new Error('Invalid database URL. Copy the connection string from Neon Console -> Connect.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must start with postgresql://.');
  const hostname = url.hostname.toLowerCase();
  if (hostname.endsWith('.supabase.com')) throw new Error('Supabase URL detected. Use your Neon project connection string instead.');
  const isNeon = hostname.endsWith('.neon.tech');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase();
  if (!isLocal && sslmode === 'disable') throw new Error('Remote PostgreSQL connections must use TLS.');
  const tls = isNeon || (!isLocal && sslmode !== 'disable') || Boolean(sslmode && sslmode !== 'disable');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat','channel_binding']) url.searchParams.delete(key);
  const connectionString = url.toString();
  if (!tls) return { connectionString };
  return {
    connectionString,
    ssl: { rejectUnauthorized: true, servername: hostname },
    // node-postgres >=8.14 supports TLS SCRAM channel binding via this option.
    enableChannelBinding: isNeon,
  } as ClientConfig;
}
