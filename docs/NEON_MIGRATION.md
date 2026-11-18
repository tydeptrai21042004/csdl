# Migrated from Supabase to Neon

- Provider is **Neon PostgreSQL** (Vercel still hosts the Next.js website).
- Runtime: `DATABASE_URL` (pooled Neon PgBouncer endpoint, `-pooler`).
- Setup, migration and full SQL testing: `DATABASE_URL_UNPOOLED` (direct Neon endpoint).
- Replaced Supabase-only `06_supabase_security.sql` with `06_neon_security.sql`, keeping RLS on all 23 tables and removing anonymous `PUBLIC` database grants. Neon has no Supabase-specific `anon`/`authenticated`/`service_role` roles.
- SQL logic, check constraints, triggers and synthetic seed data remain PostgreSQL-native.
- TLS: public CA chain verified using Node.js without a custom CA certificate. Channel binding enabled for Neon with supported node-postgres versions.
- No `SUPABASE_*`, `POSTGRES_*`, `NEXT_PUBLIC_SUPABASE_*` or `PG_DEMO_INSECURE_SSL` variables are required. The server accepts only the two Neon connection variables.
- No SQL migration executed against any database when building this project ZIP; you must attach your own Neon project connection URLs.
- No automatic copying of existing Supabase data. See `docs/NEON_DEPLOYMENT.md` for a deliberate export/import path if needed.
