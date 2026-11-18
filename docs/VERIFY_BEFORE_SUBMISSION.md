# Verification checklist before Assignment 2 submission

Do not treat repository file counts, TypeScript parsing, sample UI illustrations, or "deployed" status by themselves as proof of functionality.

## A. Automated: GitHub Actions

Push the repository to GitHub. Verify the **Build and real PostgreSQL end-to-end verification** workflow is green. It sets up disposable PostgreSQL 16, runs the real SQL files and sample data, builds Next.js, and tests HTTP + SQL lab against PostgreSQL. A red job means the software has not passed acceptance criteria.

## B. Deployed staging application

Set `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `SETUP_TOKEN` on Vercel. Deploy and initialize a fresh Neon branch at `/setup`.

- Open `/api/health` and verify `status: connected`.
- Visit `/` and verify the departure list is populated from the seeded `Trip` records.
- Filter by city/date/operator and check seat availability on `/checkout/[id]`.
- Register a new passenger at `/account` (the seed account passwords are intentionally unusable).
- Book **two distinct seats** on one trip, then reopen the same trip in a second browser tab; those two seats must be unavailable.
- Pay using a **sandbox** payment method. The booking changes to `PAID` and both tickets to `CONFIRMED`.
- Generate an invoice and request a refund before the eligible deadline; verify both in My Bookings.
- Reserve a third seat and cancel the unpaid hold; capacity must increase by one.
- Sign in to the admin toolbar; inspect `/trips`, `/operations`, `/reports`, and `/lab`. Run all 40 SQL tests, including SC01–SC18.

## C. Scope and limitations

A test booking is stored persistently in PostgreSQL, but bank/card processing is deliberately simulated. No real payment is accepted and no operator will honor these ticket records. Shared academic admin login, absence of verified email, and no production-grade abuse prevention mean this is a complete **database course demonstration**, not a commercial transport service.

## D. Failure diagnostics

- `GET /api/health` returns HTTP 500: check the Vercel server logs and Neon connection variables.
- `/setup` fails: make sure the Neon branch is empty and the direct connection string is configured.
- Build fails: open GitHub Actions' "Build production Next.js" step and fix the compiler error before deploying.
- Seed fails: inspect the DB setup failure log; no tables should be partially committed because setup wraps files in a transaction.
- A guided `/lab` test fails: record its test ID, PostgreSQL error code, and error message. Do not call this a pass unless the expected constraint behavior was demonstrated.
