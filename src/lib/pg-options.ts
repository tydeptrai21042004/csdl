import 'server-only';
import type { ClientConfig } from 'pg';

/**
 * Verified TLS configuration for all server-side PostgreSQL connections.
 * Supabase's pooler may use a private CA, so include that CA explicitly.
 * node-postgres replaces `ssl` when the URL contains sslmode/sslrootcert;
 * remove those options and provide TLS settings in one place.
 */
export function pgOptions(rawUrl: string): ClientConfig {
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new Error('Invalid PostgreSQL URL. Copy it from Supabase -> Connect.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A postgresql:// connection URL is required.');

  const hostname = url.hostname;
  const supabase = hostname.endsWith('.supabase.com');
  const mode = url.searchParams.get('sslmode')?.toLowerCase();
  if (supabase && mode === 'disable') throw new Error('TLS cannot be disabled for Supabase PostgreSQL.');

  // pg-connection-string otherwise overrides a separately supplied `ssl` object.
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat']) url.searchParams.delete(key);
  const connectionString = url.toString();
  const tlsRequested = supabase || Boolean(mode && mode !== 'disable');
  if (!tlsRequested) return { connectionString };

  // Explicit opt-in for a disposable demo: the PostgreSQL connection remains
  // TLS-encrypted but does NOT authenticate the server certificate. Never
  // use this switch for real bookings or production data. This only affects
  // pg clients created with pgOptions(), not global Node.js TLS settings.
  if (process.env.PG_DEMO_INSECURE_SSL === 'true') {
    return { connectionString, ssl: { rejectUnauthorized: false } };
  }

  const ca = (process.env.SUPABASE_DB_CA_CERT || '').replace(/\\n/g, '\n').trim() ||
    (process.env.SUPABASE_DB_CA_CERT_BASE64
      ? Buffer.from(process.env.SUPABASE_DB_CA_CERT_BASE64, 'base64').toString('utf8').trim()
      : '');
  if (supabase && !ca) {
    throw new Error('Supabase TLS CA missing: set SUPABASE_DB_CA_CERT (PEM) or SUPABASE_DB_CA_CERT_BASE64 in Vercel. Download the certificate in Supabase -> Database Settings -> SSL Configuration.');
  }
  if (ca && (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----'))) {
    throw new Error('Supabase CA certificate is not valid PEM. Check SUPABASE_DB_CA_CERT.');
  }
  // Never silently turn off hostname or certificate verification.
  return { connectionString, ssl: { rejectUnauthorized: true, servername: hostname, ...(ca ? { ca } : {}) } };
}
