import assert from 'node:assert/strict';
import { pgOptions } from './pg-options.mjs';

const url = 'postgresql://postgres.project:PLACEHOLDER@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full&uselibpqcompat=true';
const original = process.env.SUPABASE_DB_CA_CERT;
const originalB64 = process.env.SUPABASE_DB_CA_CERT_BASE64;
delete process.env.SUPABASE_DB_CA_CERT;
delete process.env.SUPABASE_DB_CA_CERT_BASE64;
try {
  assert.throws(() => pgOptions(url), /Supabase TLS CA missing/);
  assert.throws(() => pgOptions(url.replace('verify-full','disable')), /TLS cannot be disabled/);
  assert.equal(pgOptions('postgresql://postgres:pw@localhost:5432/test').ssl, undefined);
  process.env.SUPABASE_DB_CA_CERT = '-----BEGIN CERTIFICATE-----\\nTEST-CERTIFICATE-CONTENT\\n-----END CERTIFICATE-----';
  const options = pgOptions(url);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.servername, 'aws-0-us-east-1.pooler.supabase.com');
  assert.match(options.ssl.ca, /\nTEST-CERTIFICATE-CONTENT\n/);
  assert.ok(!options.connectionString.includes('sslmode'));
  assert.ok(!options.connectionString.includes('uselibpqcompat'));
  delete process.env.SUPABASE_DB_CA_CERT;
  process.env.SUPABASE_DB_CA_CERT_BASE64 = Buffer.from('-----BEGIN CERTIFICATE-----\nBASE64\n-----END CERTIFICATE-----').toString('base64');
  assert.match(pgOptions(url).ssl.ca, /BASE64/);
  console.log('PASS: local SSL behavior, Supabase CA validation, verified TLS, hostname, URL sanitization, and base64 CA.');
} finally {
  if (original === undefined) delete process.env.SUPABASE_DB_CA_CERT;
  else process.env.SUPABASE_DB_CA_CERT = original;
  if (originalB64 === undefined) delete process.env.SUPABASE_DB_CA_CERT_BASE64;
  else process.env.SUPABASE_DB_CA_CERT_BASE64 = originalB64;
}
