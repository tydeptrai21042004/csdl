/** Neon PostgreSQL TLS settings shared by CLI scripts. */
export function pgOptions(rawUrl) {
  let url;
  try { url = new URL(rawUrl); }
  catch { throw new Error('Invalid database URL. Copy it from Neon Console -> Connect.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A postgresql:// URL is required.');
  const hostname = url.hostname.toLowerCase();
  if (hostname.endsWith('.supabase.com')) throw new Error('Supabase URL detected; use Neon connection strings.');
  const isNeon = hostname.endsWith('.neon.tech');
  const isLocal = ['localhost','127.0.0.1','::1'].includes(hostname);
  const mode = url.searchParams.get('sslmode')?.toLowerCase();
  if (!isLocal && mode === 'disable') throw new Error('Remote PostgreSQL connections must use TLS.');
  const tls = isNeon || (!isLocal && mode !== 'disable') || Boolean(mode && mode !== 'disable');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat','channel_binding']) url.searchParams.delete(key);
  const connectionString = url.toString();
  return tls ? {connectionString,ssl:{rejectUnauthorized:true,servername:hostname},enableChannelBinding:isNeon} : {connectionString};
}
