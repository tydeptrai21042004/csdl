import assert from 'node:assert/strict';
import { pgOptions } from './pg-options.mjs';
import {runtimeConnectionUrl,setupConnectionUrl} from './db-env.mjs';
const pooled='postgresql://neondb_owner:sample@ep-example-1234-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const direct=pooled.replace('-pooler.','.');
const options=pgOptions(pooled);
assert.equal(options.ssl.rejectUnauthorized,true);
assert.equal(options.ssl.servername,'ep-example-1234-pooler.us-east-2.aws.neon.tech');
assert.equal(options.enableChannelBinding,true);
assert.ok(!options.connectionString.includes('sslmode'));
assert.ok(!options.connectionString.includes('channel_binding'));
assert.equal(pgOptions(direct).ssl.rejectUnauthorized,true);
assert.equal(pgOptions('postgresql://postgres:pwd@localhost:5432/test').ssl,undefined);
assert.throws(()=>pgOptions(pooled.replace('sslmode=require','sslmode=disable')),/must use TLS/);
assert.throws(()=>pgOptions('postgresql://postgres:pwd@db.demo.supabase.com:5432/postgres'),/Supabase URL/);
const savedPool=process.env.DATABASE_URL,savedDirect=process.env.DATABASE_URL_UNPOOLED;
try {
  process.env.DATABASE_URL=pooled;
  process.env.DATABASE_URL_UNPOOLED=direct;
  assert.equal(runtimeConnectionUrl(),pooled);
  assert.equal(setupConnectionUrl(),direct);
  process.env.DATABASE_URL_UNPOOLED=pooled;
  assert.throws(()=>setupConnectionUrl(),/unpooled/);
  process.env.DATABASE_URL_UNPOOLED=direct.replace('ep-example-1234.', 'ep-other-1234.');
  assert.throws(()=>setupConnectionUrl(),/SAME/);
} finally {
  if(savedPool===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=savedPool;
  if(savedDirect===undefined)delete process.env.DATABASE_URL_UNPOOLED;else process.env.DATABASE_URL_UNPOOLED=savedDirect;
}
console.log('PASS: Neon pooled/direct URLs, verified TLS, channel binding, localhost, Supabase guard, and URL sanitization.');
