# Intercity V5 — ready-to-run demo fix

This patch is based on `csdl-main(1).zip` provided in this conversation. No PostgreSQL database changes are made by installing the patch.

## What changed
- `src/lib/pg-options.ts` and `scripts/pg-options.mjs`: when `PG_DEMO_INSECURE_SSL=true`, use encrypted PostgreSQL TLS with certificate verification skipped (no CA required). The setting is limited to PostgreSQL; no global TLS override.
- `src/lib/api.ts`: actionable TLS error message.
- `scripts/check-supabase-connection.mjs`: checks both poolers, `user_account`, `station`, `trip`, and trip counts without logging passwords.
- `scripts/test-pg-options.mjs`: verifies both demo TLS and strict verified TLS modes.
- `.env.local`: existing user-supplied Supabase demo connection details; `.env.example` and `.gitignore` added.

## Local
1. Copy all patch files into the repo root, preserving the folder paths.
2. `npm install`
3. `npm run test:tls-config`
4. `npm run db:check`
5. If missing tables AND the database's public schema is empty, `npm run db:init` (ONLY ONCE).
6. `npm run dev`, then open `http://localhost:3000`.

## Vercel
1. Commit/push SOURCE CHANGES only (not `.env.local`).
2. In Vercel > Project > Settings > Environment Variables (Production), import all values from `.env.local` (except its comments). Remove stale incorrect `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_POSTGRES_*` variables; the backend reads `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`.
3. Redeploy AFTER updating env vars and code.
4. Open `https://csdl-taupe.vercel.app/api/health`.
5. If it returns `schema_missing` with `state: empty`, sign in using `ADMIN_PASSWORD` at `/account`, go to `/setup`, enter `SETUP_TOKEN`, and initialize once. This creates 23 tables and synthetic records.
6. If `state: partial`, DO NOT auto initialize; manually inspect existing tables in Supabase SQL Editor.
7. Reload homepage; seed creates future scheduled trips relative to when you initialize.

## Important
`PG_DEMO_INSECURE_SSL=true` intentionally disables server certificate validation ONLY for PostgreSQL and is for disposable demo data only. Encryption remains enabled. Do not use for production or real payments. If the Supabase password has changed or database is paused/unreachable, no .env can guarantee connectivity; use valid current Supabase credentials.
