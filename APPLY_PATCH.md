# Intercity Bus V5 — patch for Supabase TLS and 42P01

This ZIP contains ONLY changed/added files, with paths relative to the repository root.

1. Extract into your `csdl` repository root, overwriting the matching files.
2. Read `docs/TLS_AND_SCHEMA_FIX.md`.
3. Obtain the Supabase database CA (PEM) from Dashboard -> Database Settings -> SSL Configuration.
4. Add `SUPABASE_DB_CA_CERT` (entire PEM) OR `SUPABASE_DB_CA_CERT_BASE64` as a server-only Vercel environment variable. Keep valid URLs for both poolers.
5. Push to GitHub and redeploy on Vercel.
6. Check `/api/health`. If `state: empty`, sign in as administrator at `/setup` and initialize the empty database with SETUP_TOKEN. Do not initialize on partial/nonempty databases.
7. Check `/api/public/trips` and run SQL lab.

This ZIP contains no passwords or CA keys. Never commit `.env.local`. Rotate previously exposed database/admin/session/setup credentials.

Offline tests: `npm run test:tls-config` and `npm run check:project` passed in the authoring environment; TypeScript syntax transpilation passed. Dependencies could not be installed here, so Next.js build and live database setup still require verification on your machine/Vercel.
