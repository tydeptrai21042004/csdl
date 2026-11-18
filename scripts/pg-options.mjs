/** Same strict TLS policy as src/lib/pg-options.ts, for standalone CLI scripts. */
export function pgOptions(rawUrl) {
  let url;
  try { url = new URL(rawUrl); }
  catch { throw new Error('Invalid PostgreSQL URL. Copy it from Supabase -> Connect.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A postgresql:// connection URL is required.');
  const hostname = url.hostname;
  const supabase = hostname.endsWith('.supabase.com');
  const mode = url.searchParams.get('sslmode')?.toLowerCase();
  if (supabase && mode === 'disable') throw new Error('TLS cannot be disabled for Supabase PostgreSQL.');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat']) url.searchParams.delete(key);
  const connectionString = url.toString();
  if (!supabase && (!mode || mode === 'disable')) return { connectionString };
  const ca = (process.env.SUPABASE_DB_CA_CERT || '').replace(/\\n/g, '\n').trim() ||
    (process.env.SUPABASE_DB_CA_CERT_BASE64
      ? Buffer.from(process.env.SUPABASE_DB_CA_CERT_BASE64, 'base64').toString('utf8').trim() : '');
  if (supabase && !ca) throw new Error('Supabase TLS CA missing: set SUPABASE_DB_CA_CERT (PEM) or SUPABASE_DB_CA_CERT_BASE64. Download it from Supabase -> Database Settings -> SSL Configuration.');
  if (ca && (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')))
    throw new Error('Supabase CA certificate is not valid PEM.');
  return { connectionString, ssl: { rejectUnauthorized: true, servername: hostname, ...(ca ? { ca } : {}) } };
}
