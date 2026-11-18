# Supabase + Vercel deployment (Assignment 1 / Assignment 2)

This project uses **Supabase as a PostgreSQL database**, not as its authentication SDK. Passenger authentication is stored in the original `user_account` and `passenger_profile` tables. All database access is server-side from Next.js; the browser never connects with a privileged PostgreSQL URI.

## Step 0: Rotate keys shared outside Supabase

Regenerate the Supabase database password. Revoke/rotate exposed Supabase secret and service-role keys, and rotate the exposed JWT secret following Supabase's documented migration process. If rotating the JWT secret invalidates old anon/service_role tokens, refresh the public keys in any other app using that Supabase project. Never paste secret credentials into GitHub, screenshots or public bug reports.

## Step 1: Connection strings

Supabase Dashboard > Connect provides two different pooler modes. Copy the **entire URI** from the dashboard, including the username with the project suffix and `sslmode=require`.

| Vercel variable | Supabase Connect setting | Port | Used by |
| --- | --- | ---: | --- |
| `POSTGRES_URL` | Transaction pooler | 6543 | Next.js website and API |
| `POSTGRES_URL_NON_POOLING` | Session pooler | 5432 | `/setup`, migrations and CLI SQL tests |

`POSTGRES_URL_NON_POOLING` is a legacy integration variable name: with the Supabase URL provided, it points to a **session pooler**, not a raw direct connection. The direct `db.<project-ref>.supabase.co` endpoint may require IPv6. Do not copy the Prisma-specific URL into the Node `pg` configuration.

The app recognizes legacy `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for local compatibility, but `POSTGRES_URL` takes precedence over an old Neon `DATABASE_URL`. To prevent mistakes, delete stale Neon environment variables.

## Step 2: Three app-specific secrets

Generate these values independently using a cryptographically secure generator, or run:

```bash
npm run secrets
```

- `ADMIN_PASSWORD`: password to the administrative website login
- `SESSION_SECRET`: signs the website's admin/passenger sessions
- `SETUP_TOKEN`: unlocks initial SQL schema and seed installation

Do **not** put any of these in variables starting with `NEXT_PUBLIC_`.

## Step 3: Vercel variables

Mandatory, server-side:

```dotenv
POSTGRES_URL="postgresql://postgres.PROJECT_REF:NEW_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
POSTGRES_URL_NON_POOLING="postgresql://postgres.PROJECT_REF:NEW_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
ADMIN_PASSWORD="YOUR_LONG_UNIQUE_PASSWORD"
SESSION_SECRET="64_RANDOM_HEX_CHARACTERS"
SETUP_TOKEN="A_DIFFERENT_64_RANDOM_HEX_CHARACTERS"
```

Optional (currently not used by app code):

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

Not needed by this application: `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_PRISMA_URL`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `SUPABASE_ANON_KEY`. You may keep public keys for other app features, but don't add unnecessary privileged keys to this project's Vercel environment.

## Step 4: Deploy and initialize

1. Push the project contents to GitHub with `package.json` at the repository root.
2. Import to Vercel as Next.js. Set the five required variables for Production and Preview as appropriate. Redeploy if changed.
3. Visit `/api/health` and check the connection result, then `/setup`.
4. Sign in as admin, provide `SETUP_TOKEN`, initialize a **new/empty `public` schema**. The script refuses to overwrite the existing `user_account` table and it does not touch `auth`/`storage` schemas.
5. The installation applies `database/01_schema.sql`, `02_logic.sql`, `03_seed.sql`, and `06_supabase_security.sql` atomically.
6. Verify 23 tables and >=5 sample rows in each using `/lab`. Run guided tests for SC01–SC18 and real trigger/procedure checks.
7. Register a new passenger at `/account`, search trips, reserve seats, capture a sandbox payment and inspect `/my-bookings`.

`/setup` does not support resetting an already initialized database. Use a separate disposable Supabase project for destructive demonstrations.

## Step 5: Verify from a terminal (optional)

```bash
cp .env.example .env.local
# edit .env.local (ignored by Git)
npm install
npm run db:check       # READ ONLY, both database connection modes
npm run check:project # structural validation
npm run db:test        # SQL tests on a seeded database; some transactions are rolled back
npm run build
npm run dev
```

## Supabase API security model

Supabase exposes the `public` schema through its Data API by default. Our database-backed website does **not** use that API. The install enables RLS on all 23 project tables, adds no Data API policies, and revokes app table and business routine permissions from Supabase API roles. The application uses `pg` from Node server functions with a PostgreSQL credential; protect that credential in Vercel. The public publishable key alone cannot grant direct access to the booking records.

If you later switch to Supabase Auth, Storage or direct browser SDK queries, you must deliberately add narrowly scoped RLS policies and redesign the auth integration—do not just disable RLS.

## Troubleshooting

- `getaddrinfo ENOTFOUND`: wrong pooler hostname. Copy from Supabase Dashboard > Connect.
- `password authentication failed`: rotate/recheck the DB password and use `postgres.PROJECT_REF`, not `postgres`, for the pooler username.
- `Cannot use a prepared statement`: transaction pooler may not support prepared statements; this project uses `pg` with unnamed parameterized queries.
- `Database is already initialized`: don't click setup again. Go straight to `/lab`; only run the documented upgrade against a matching older 23-table schema.
- `/api/health` works but `/setup` fails: verify session pooler URI port 5432 and database privileges. Inspect Vercel server function logs without printing secrets.
- `Supabase Table Editor shows locked access`: that is expected for the app's RLS-protected tables when accessing as an unprivileged Data API role; PostgreSQL administrator SQL access still works.

### Verification limitations

Static repository checks validate declarations and syntax, not a live production deployment. Database initialization, build, and end-to-end behavior must be tested with your rotated credentials and a running PostgreSQL instance.
