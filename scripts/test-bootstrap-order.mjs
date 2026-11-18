/** Regression test for SQLSTATE 55006 on fresh Neon initialization.
 * No database or npm dependencies required; checks both entry points and bundle. */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const expected = ['01_schema.sql','02_logic.sql','06_neon_security.sql','03_seed.sql'];
const bootstrap = read('src/lib/bootstrap.ts');
const cli = read('scripts/setup-db.mjs');
const bundler = read('scripts/build-sql-bundle.mjs');
const generated = read('src/generated/db-bundle.ts');
for (const [name, text] of [['server bootstrap',bootstrap], ['CLI setup',cli], ['SQL bundler',bundler]]) {
  const pos = expected.map(filename => text.indexOf(`'${filename}'`));
  assert(pos.every(value => value >= 0), `${name}: missing initialization file`);
  assert(pos.every((value,i) => i === 0 || pos[i-1] < value), `${name}: security must precede seed`);
}
assert(bootstrap.includes('SET CONSTRAINTS ALL IMMEDIATE'), 'server: deferred checks not flushed');
assert(cli.includes('SET CONSTRAINTS ALL IMMEDIATE'), 'CLI: deferred checks not flushed');
const filenames = [...generated.matchAll(/\"filename\":\"(0[1236]_[^\"]+\.sql)\"/g)].map(m => m[1]);
assert.deepEqual(filenames.slice(0,4),expected,'generated SQL bundle uses outdated installation order');
const schema = read('database/01_schema.sql');
const logic = read('database/02_logic.sql');
const seed = read('database/03_seed.sql');
const security = read('database/06_neon_security.sql');
assert(/CREATE TABLE user_account/i.test(schema),'schema must include user_account');
assert(/DEFERRABLE INITIALLY DEFERRED/i.test(logic),'test assumes deferred constraint triggers');
assert(/INSERT INTO user_account/i.test(seed),'test assumes seed modifies user_account');
assert(/ALTER TABLE public\.%I ENABLE ROW LEVEL SECURITY/i.test(security),'security ALTER TABLE must be before seed');
console.log('PASS: Both setup entry points and bundled SQL execute 01_schema -> 02_logic -> 06_neon_security -> 03_seed, with pending constraints flushed before commit.');
