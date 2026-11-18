# Intercity Bus Booking V5 — Neon PostgreSQL + Next.js + Vercel

Full-stack academic intercity booking website backed by **Neon PostgreSQL**. It preserves the original 23-table relational database, all PL/pgSQL triggers, business routines, SQL Lab and sample booking data. Payments are simulations; the website does **not** sell real tickets.

## Quick start

1. Create a free Neon project at https://console.neon.tech/ and open **Connect**.
2. Run `npm run neon:configure`; paste the **pooled** URL (pooling ON) and then **direct** URL (pooling OFF) for the SAME Neon database. This writes your `.env.local` and creates admin/session/setup secrets. **Your old Supabase URLs will not work.**
3. Run:

```bash
npm install
npm run test:tls-config
npm run db:check
npm run db:init       # run ONCE on an empty Neon DB to create the 23 tables + sample data
npm run db:test
npm run dev
```

4. Browse http://localhost:3000. Admin login uses `ADMIN_PASSWORD` from `.env.local`.

If you already have a populated Neon database, do **not** run `db:init`: it refuses to overwrite records.

## Production: Vercel

Push the source to GitHub. In Vercel project Settings -> Environment Variables set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `SETUP_TOKEN` from `.env.local`. **Never upload `.env.local` to GitHub.** Redeploy. Then open `/api/health` and `/setup` to initialize an empty database if you haven't already run `db:init` locally.

See [Neon deployment steps](docs/NEON_DEPLOYMENT.md) and [migration summary](docs/NEON_MIGRATION.md).

## Website modules

| Path | Role | Features |
|---|---|---|
| `/` | Public | Search bus routes and scheduled departures, prices and live seat counts |
| `/operators` | Public | Operators, vehicles, routes and drivers |
| `/account` | Passenger | Local user registration/sign-in (salted password hashes in PostgreSQL) |
| `/checkout/[id]` | Passenger | Select up to 6 seats, passenger names, route stops and promo codes |
| `/my-bookings` | Passenger | Ticket records, demo payment, cancellations, refund requests, review, invoice |
| `/trips` | Admin | Actual trip INSERT/UPDATE/DELETE via stored procedures |
| `/bookings` | Admin | Manage bookings, payments and expired holds |
| `/operations` | Admin | Browse buses, drivers, stations, reviews, invoices and refunds |
| `/reports` | Admin | Stored SQL reports and cursor functions |
| `/lab` | Admin | All 23 tables, **40 SQL test cases** and a bounded read-only SQL console |
| `/setup` | Admin | Initialize empty Neon schema + seed or upgrade existing v2 database |

The database includes 23 tables, key constraints, 14 stored procedures, 26 triggers, query functions and representative synthetic data (5 operators, 15 sample trips, 18 seats per bus). `btree_gist` is required for schedule exclusion constraints.

## Commands

| Command | Purpose |
|---|---|
| `npm run neon:configure` | Interactive Neon URL setup and application secret generation |
| `npm run db:check` | Check pooled/direct connection and schema status |
| `npm run db:init` | One-time initialization of an empty Neon DB |
| `npm run db:test` | Run real PostgreSQL business/trigger test suite |
| `npm run db:upgrade` | Upgrade an existing compatible 23-table v2 database |
| `npm run db:bundle` | Regenerate SQL for Vercel setup endpoint |
| `npm run test:tls-config` | Test Neon URL and TLS connection options without a database |
| `npm run check:project` | Static SQL + web checks |
| `npm run typecheck` | TypeScript check after installing dependencies |
| `npm run build` | Next.js production build |

## Data migration versus fresh sample database

This ZIP contains **code and synthetic SQL seed**, not a live Neon project or existing Supabase records. To preserve existing records from Supabase, migrate them separately via PostgreSQL tools (read `docs/NEON_DEPLOYMENT.md`), rather than running the fresh demo seed.

The backend uses `pg` with **verified TLS and Node's CA store**: Neon normally needs no custom CA certificate. All DB access remains on the Next.js server; there is no browser-exposed database credential.
