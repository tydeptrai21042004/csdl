# Neon fresh database setup fix: SQLSTATE 55006

## Failure

`PostgreSQL setup failed (55006): cannot ALTER TABLE "user_account" because it has pending trigger events`

## Cause

The previous installer executed `03_seed.sql` **before** `06_neon_security.sql`. The seed queues `DEFERRABLE INITIALLY DEFERRED` constraint triggers; later security SQL runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` inside the same transaction and PostgreSQL refuses.

## Change

All fresh setup paths now execute one atomic transaction in this order:

1. `01_schema.sql`
2. `02_logic.sql`
3. `06_neon_security.sql`
4. `03_seed.sql`
5. `SET CONSTRAINTS ALL IMMEDIATE` (execute queued integrity checks)
6. `COMMIT`

This changes no business SQL formula, table definition or seeded records. If anything fails, the transaction rolls back. No destructive cleanup script is required.

## Deploy and initialize

1. Deploy the fixed source to Vercel. Confirm its existing `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_PASSWORD`, `SESSION_SECRET` and `SETUP_TOKEN` are still configured.
2. Run `npm run test:bootstrap-order` locally or in CI (requires no database).
3. Open `/api/health`, then `/setup`. If `table_count` is 0 / schema is `empty`, sign in as Admin and choose **Initialize empty database** with your setup token.
4. Verify `/api/health` reports an initialized schema, and `/api/public/trips` shows the scheduled sample trips.
5. On a local clone, you can alternatively use `npm run db:check`, `npm run db:init`, `npm run db:test` (only for an empty database).

If status is `partial` or existing application tables are present, **do not run fresh initialization**; stop and inspect the tables first.

`src/generated/db-bundle.ts` is regenerated via `npm run db:bundle` and `npm run build` (prebuild). It is also included in the ZIP for deployments that use prebuilt source.

## Verification scope

Local checks verify SQL file order, static schema counts, JS syntax and the generated SQL bundle. A live Neon test and full Next.js build still require a reachable database and npm dependencies.
