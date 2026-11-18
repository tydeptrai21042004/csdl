# Fix Supabase TLS + PostgreSQL 42P01 on Vercel

The application uses Node.js `pg`, not Supabase JS. There are two **independent** errors:

- `SELF_SIGNED_CERT_IN_CHAIN`: `pg` rejects Supabase's pooler certificate chain when its CA is not trusted.
- `42P01` (`station`, `user_account`): connected PostgreSQL database does not contain the application schema. Deploying Next.js does **not** run the SQL seed scripts.

## Apply code patch

Copy the changed and added files from the supplied patch ZIP into the repository root (preserve paths), commit and push. The patch does not contain passwords or the project's CA certificate.

## Configure TLS

1. Supabase Dashboard -> Database Settings -> SSL Configuration: download the CA certificate for this project.
2. Vercel -> Project -> Settings -> Environment Variables: set `SUPABASE_DB_CA_CERT` to the **full PEM text**, or `SUPABASE_DB_CA_CERT_BASE64` to the base64-encoded PEM. Do not use `NEXT_PUBLIC_`.
3. Ensure `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING` are the two URLs from the same Supabase project. Use transaction port 6543 and session port 5432 respectively. Do not substitute direct IPv6-only URLs.
4. Leave `sslmode=verify-full` in the URLs; the shared pg helper strips conflicting query options before using `ssl: {ca, rejectUnauthorized: true, servername}`. Changing just `sslmode=require` to `uselibpqcompat=true` skips server verification and is **not** the recommended production fix.
5. Redeploy Vercel after adding server environment variables.

For local development: `cp .env.example .env.local`; paste certificate with escaped `\n` sequences into `SUPABASE_DB_CA_CERT`, or use its base64 form. Rotate all previously shared secrets.

**Do not** use `NODE_TLS_REJECT_UNAUTHORIZED=0` or `ssl: {rejectUnauthorized: false}`.

## Initialize a fresh/empty database

1. Open `/api/health`. A 503 with `status: schema_missing`, `state: empty` means TLS/SQL access works but no application tables exist. A `partial` state means the public schema is nonempty and incomplete; do not run initialization over it.
2. Go to `/setup`, click **Admin login** (login uses `ADMIN_PASSWORD` and does not need `user_account`), supply `SETUP_TOKEN` and press **Initialize empty Supabase database**. This applies `01_schema.sql`, `02_logic.sql`, `03_seed.sql`, `06_supabase_security.sql` within one transaction.
3. After success, `/api/health` returns 200 with `initialized: true`, `table_count: 23`, and `trip_count: 15`. `/api/public/trips` should show upcoming scheduled trips if seed was just run.
4. Open `/lab` and run the guided SQL test suite.

**If state is `partial`:** inspect `missing_tables` and the schema in Supabase SQL Editor, or create a *fresh project* and run setup there. Never use a destructive `DROP SCHEMA`, `TRUNCATE`, or auto-reseed on a database containing data that matters.

## Safe SQL checks in Supabase SQL Editor

```sql
SELECT to_regclass('public.user_account') AS user_account,
       to_regclass('public.station') AS station,
       to_regclass('public.trip') AS trip;

SELECT count(*)::int AS tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

After initialization:

```sql
SELECT status, count(*) FROM public.trip GROUP BY status ORDER BY status;
SELECT count(*) AS upcoming FROM public.trip
WHERE status='SCHEDULED' AND departure_at>now();
```

## Testing

```bash
npm install
npm run check:project
npm run typecheck
npm run build
npm run db:check
# Run only after initialized, on a dedicated test database:
npm run db:test
```

A successful local build does **not** prove connectivity to your private Supabase database; verify `/api/health` on the new Vercel deployment after setting its environment variables.
