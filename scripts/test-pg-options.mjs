import assert from 'node:assert/strict';
import { pgOptions } from './pg-options.mjs';

const url = 'postgresql://postgres.project:PLACEHOLDER@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full&uselibpqcompat=true';
const names=['PG_DEMO_INSECURE_SSL','SUPABASE_DB_CA_CERT','SUPABASE_DB_CA_CERT_BASE64'];
const originals=Object.fromEntries(names.map(name=>[name,process.env[name]]));
try {
  for (const name of names) delete process.env[name];
  assert.throws(() => pgOptions(url), /Supabase TLS CA missing/);
  assert.throws(() => pgOptions(url.replace('verify-full','disable')), /TLS cannot be disabled/);
  assert.equal(pgOptions('postgresql://postgres:pw@localhost:5432/test').ssl, undefined);

  // Demo opt-in: no CA required; sensitive URL bits are retained, conflicting
  // connection-string SSL parameters removed, and TLS not disabled.
  process.env.PG_DEMO_INSECURE_SSL='true';
  for (const testUrl of [url,url.replace(':6543/',':5432/')]) {
    const opts=pgOptions(testUrl);
    assert.deepEqual(opts.ssl,{rejectUnauthorized:false});
    assert.ok(!opts.connectionString.includes('sslmode='));
    assert.ok(!opts.connectionString.includes('uselibpqcompat='));
    assert.ok(opts.connectionString.includes('postgres.project'));
  }
  assert.throws(() => pgOptions(url.replace('verify-full','disable')), /TLS cannot be disabled/);
  delete process.env.PG_DEMO_INSECURE_SSL;

  process.env.SUPABASE_DB_CA_CERT = '-----BEGIN CERTIFICATE-----\nTEST-CERTIFICATE-CONTENT\n-----END CERTIFICATE-----';
  const secure=pgOptions(url);
  assert.equal(secure.ssl.rejectUnauthorized,true);
  assert.equal(secure.ssl.servername,'aws-0-us-east-1.pooler.supabase.com');
  assert.match(secure.ssl.ca,/\nTEST-CERTIFICATE-CONTENT\n/);
  assert.ok(!secure.connectionString.includes('sslmode='));
  delete process.env.SUPABASE_DB_CA_CERT;
  process.env.SUPABASE_DB_CA_CERT_BASE64 = Buffer.from('-----BEGIN CERTIFICATE-----\nBASE64\n-----END CERTIFICATE-----').toString('base64');
  assert.match(pgOptions(url).ssl.ca,/BASE64/);
  console.log('PASS: demo TLS for both poolers, no CA required in demo, secure TLS, URL normalization, disabled-TLS guard.');
} finally {
  for (const name of names) {
    if (originals[name] === undefined) delete process.env[name];
    else process.env[name] = originals[name];
  }
}
