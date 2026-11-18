# Neon PostgreSQL + Vercel Deployment (Intercity V5)

## Create the database (Neon Free plan is sufficient for the synthetic dataset)

1. Open https://console.neon.tech/ and create a PostgreSQL project/database.
2. In **Connect**, select the correct branch/database/role.
3. Enable **Connection pooling**. Copy the complete URL as `DATABASE_URL` (the hostname includes `-pooler`).
4. Disable **Connection pooling**. Copy the complete direct URL as `DATABASE_URL_UNPOOLED` (no `-pooler`).
5. Do not reuse a Supabase URL or password; Neon has its own credentials. Both URLs must point to the same Neon branch and database. The app's `pg` client verifies TLS certificates using Node's standard CA trust store; no CA environment variable is required.

## Configure and test locally

```bash
npm run neon:configure  # pastes both URLs, writes .env.local, creates/retains auth secrets
npm install
npm run test:tls-config
npm run db:check
npm run db:init         # ONLY ON AN EMPTY NEON DATABASE
npm run db:test
npm run dev
```

In Next.js, the pooled URL is used by runtime API routes. The direct URL is used for initialization, migration and the CLI SQL tests; Neon transaction pooling does not preserve session state across transactions. The code uses SQL-based `pg` rather than Supabase SDK or Neon HTTP driver.

## Vercel

Add **five server-side** Environment Variables from your generated `.env.local`:
- `DATABASE_URL`: Neon pooled URL
- `DATABASE_URL_UNPOOLED`: Neon direct URL
- `ADMIN_PASSWORD`: generated admin password
- `SESSION_SECRET`: generated session signing secret
- `SETUP_TOKEN`: generated setup token

Remove any stale `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`, and `PG_DEMO_INSECURE_SSL` variables; this project doesn't use them. Redeploy Production after changing env vars.

To initialize without a local command, sign in as application administrator, open `/setup`, enter the setup token, and initialize the **empty** database once. `/api/health` reports `schema_missing` while connected but uninitialized.

## Seeded data (fresh install)

`database/01_schema.sql` -> `02_logic.sql` -> `06_neon_security.sql` -> `03_seed.sql`. The seed creates 23 relational tables, 5 synthetic operators, sample stations, 18 seats/bus and 15 trips (10 future, 5 completed) as of the date seeding runs. The database is real PostgreSQL; ticket purchases are simulated only.

The Neon security DDL must run **before** the seed. The deferred data-integrity triggers from the seed would otherwise block `ALTER TABLE` with SQLSTATE 55006. This ordering is enforced in both the Vercel `/setup` endpoint and the CLI script. The installer checks pending deferred constraints before the final commit.

SQL Lab `/lab` has 40 guided rollback tests and a read-only `SELECT` console. To run arbitrary SQL use Neon Console SQL Editor.

## When there is existing Supabase data

The included seed initializer **does not copy existing Supabase records**. If the old database has real records you need, perform an explicit `pg_dump --format=custom` from the OLD direct URL, then `pg_restore` into an **empty** Neon database over the NEW direct URL (check owner/extension/privilege compatibility). Do not also run `db:init` after restoring a complete dump. Test against an isolated Neon branch first. Existing databases and Neon branches are never dropped automatically by these scripts.

## Troubleshooting

- `DATABASE_URL missing`: copy the pooled URL from Neon.
- `DATABASE_URL_UNPOOLED missing`: copy the direct URL from the same Neon branch.
- `42P01 relation ... does not exist`: the database is empty or incomplete; use `/setup` or `npm run db:init` only if empty.
- `CERTIFICATE_VERIFY_FAILED`: inspect your machine's CA trust store, network interception or incorrect endpoint; this app uses normal verified TLS.
- `0 departures`: if `/api/health` is ready and `trip_count` is positive, inspect `/api/public/trips` and trip dates/filter settings.
- Invalid passwords: verify you pasted the exact Neon role password, not a Supabase credential.
