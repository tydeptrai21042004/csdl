# Intercity Bus Booking — full web application + Assignment 2 database

**A real, database-backed academic booking website**, implemented from the 23-table conceptual/relational design in `2233164.pdf` (Assignment 1). This repository deploys the **public React frontend and secure server-side API together as one Next.js project on Vercel**; all records are stored in **Neon PostgreSQL**, not local JSON or hardcoded frontend arrays.

It is a working **educational sandbox**, not a commercial travel service: it does **not issue real transport tickets**, verify operators externally, send email/SMS, or charge money. A successful "sandbox payment" genuinely inserts a test Payment record and confirms tickets in PostgreSQL, but **no funds move**. See `docs/ASSIGNMENT1_TRACEABILITY.md` for complete EERD mapping.

> **Lecturer approval:** Assignment 2 asks for a DBMS "such as MS SQL Server or MySQL". PostgreSQL has the required features, but obtain approval if your class specifically requires one of those SQL dialects. All code in this project uses PostgreSQL and PL/pgSQL.

## What you will see on the deployed website

| Page | Role | Live functionality |
|---|---|---|
| `/` | Public | Search origin, destination, departure date and operator; compare departures and available seats |
| `/checkout/[id]` | Public / Passenger | Seat map by physical bus/deck, select **1–6 seats**, assign a traveler to each, choose RouteStop positions, use a promo, create **one Booking with multiple Tickets** |
| `/account` | Passenger | Register and sign in using email/password stored with salted scrypt password hashes |
| `/my-bookings` | Passenger | View **only own** bookings and tickets; confirm sandbox payment, cancel an unpaid hold, request a refund, issue an invoice, review a completed trip, print trip details |
| `/operators` | Public | Read real BusOperator, OperatorPhone, Route, Bus and Driver metadata |
| `/trips` | Admin | Actual INSERT, UPDATE, DELETE via the **three stored procedures** required by Assignment 2 |
| `/bookings` | Admin | See all bookings, create demonstration bookings, capture sandbox payments, release expired holds |
| `/operations` | Admin | Browse buses, drivers, stations, invoices, reviews and refunds; approve or reject refund requests (administrative decision only) |
| `/reports` | Admin | Query procedures with JOIN/WHERE/HAVING/ORDER BY and two cursor/loop functions |
| `/lab` | Admin | **40 rollback-safe guided tests** (including SC01–SC18 and multi-ticket booking), browser view of **all 23 tables**, and a restricted read-only SELECT editor |
| `/setup` | Admin | Initialize a **fresh empty** Neon database, or non-destructively upgrade an existing v2 project |

The original Assignment 1 schema is retained: 21 entity relations + `OperatorPhone` + `TripDriverAssignment` = **23 tables**. Documented Assignment 2 implementation refinements are `driver.license_class`, `booking.discount_amount_applied` and maintained `trip.available_seats`. There is still **one booking per trip**, but **many tickets can belong to a booking**.

## Deploy on Vercel without running SQL on your computer

1. Extract the ZIP. Create a **new GitHub repository**, and upload the **contents** of this directory so `package.json` is at the repository root.
2. Create a **Neon PostgreSQL project** at https://console.neon.tech and open its **Connect** dialog. Copy the pooled connection string and, if possible, the direct/unpooled connection string. Use a **new empty database** for a fresh install.
3. Import that GitHub repository at https://vercel.com/new. Vercel auto-detects **Next.js**. Use the repository root; leave the output directory unset. The `prebuild` script embeds SQL sources in the server-side deployable bundle.
4. In **Vercel → Project → Settings → Environment Variables**, add:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
   DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DBNAME?sslmode=require
   ADMIN_PASSWORD=UNIQUE_LONG_ADMIN_PASSWORD_AT_LEAST_12_CHARS
   SESSION_SECRET=RANDOM_64_HEX_CHARACTER_VALUE
   SETUP_TOKEN=ANOTHER_RANDOM_64_HEX_CHARACTER_VALUE
   ```

   `DATABASE_URL_UNPOOLED` is recommended for setup; if absent, setup uses `DATABASE_URL`. Real Neon integration credentials may be provisioned through Vercel Marketplace; confirm **these variable names** exist in the project environment. Generate random secrets with `npm run secrets` locally, or a cryptographically secure password generator. **Never use `NEXT_PUBLIC_` for secrets.**
5. **Deploy**. If you added environment variables after the build, **redeploy** from Vercel so server functions receive them.
6. Open the deployed site. Navigate to **Admin workspace** (`/trips` or `/setup`), click **Admin login** in the database toolbar, and sign in with `ADMIN_PASSWORD`.
7. At `/setup`, paste `SETUP_TOKEN`, then click **Initialize empty Neon database**. This installs schema, business triggers, routines, and **synthetic sample data for every table** in a transaction. It refuses a nonempty database; no existing data is deleted.
8. Open `/lab` → **Run full suite**, inspect pass/fail results and Table explorer. The SQL lab executes the **real Neon code**, not screenshots. Some tests intentionally trigger an error and count as PASS when PostgreSQL rejects the invalid operation.
9. Open the public homepage `/`, search for a trip, select seats, **create your own account** at `/account` and complete a multi-seat booking. After the hold is created, go to `/my-bookings` and click **Confirm sandbox payment**. Reopen seat availability from another browser to see the updated record.

### Upgrading an existing V2 Neon database

If your previous project already has the **23 Assignment 1 tables**, deploy this version with the same Neon variables. At `/setup` choose **Upgrade existing database** with your `SETUP_TOKEN`. `database/05_upgrade_from_v2.sql` adds the missing passenger procedures and expands existing seat inventory to up to 18 seats per seed bus; it preserves historical records. It can be rerun without clearing rows. It does **not** create new tables. If your old schema was manually modified, create a fresh Neon branch and test before upgrading production.

## Sample data and realistic test journey

`database/03_seed.sql` populates all 23 relations with **at least five rows**. There are five fictional bus operators, driver and staff records, origin/route-stop stations in Vietnam, 18 seats per seeded bus, five completed historical trips and ten future scheduled trips. Five historical paid bookings include sample tickets, refunds, invoices and reviews. Promo codes include `SAVE10`, `FLAT20`, `SAVE15`, `FLAT30` and `SAVE05`. Dates are relative to the date the seed SQL executes.

**Important:** Seeded passenger emails `guest1@example.test` etc. are **synthetic reference records with no usable login passwords**. To use the real passenger site, **register a new account with your own test email**, which atomically creates `UserAccount` and `PassengerProfile` rows. You may use a non-deliverable test address; this academic project does not verify email or send messages. Do not use genuine sensitive personal or financial information.

**End-to-end example:** Search `Mien Dong Station → Da Lat Station` (clear the date if needed) → choose trip → select seats `A02` and `A03` → set traveler names → pickup at origin/drop-off at destination → enter `SAVE10` → Reserve → My bookings → Confirm sandbox payment → check status and tickets → Issue invoice. Two Ticket rows belong to one Booking, and `Trip.available_seats` decreases by two. Concurrent duplicate seat holds are stopped by a PostgreSQL partial unique index.

## Assignment 2 grading requirements

| Requirement | Source / live UI |
|---|---|
| All Assignment 1 relations, PK/FK/CHECK/UNIQUE, semantic rules | `database/01_schema.sql`, `database/02_logic.sql`; `/lab` |
| At least five meaningful rows in **every table** | `database/03_seed.sql`; `/lab` → seed count check and table browser |
| Stored procedures to INSERT/UPDATE/DELETE **one** table | `sp_create_trip`, `sp_update_trip`, `sp_delete_trip`; `/trips` |
| Business trigger on nondeclarative constraint | `fn_trip_seat_guard`; `/lab` → SC06 |
| Trigger recomputes a derived attribute | `fn_refresh_available_seats`, associated triggers; `/lab` → derived-seats |
| Data-query procedure with JOIN, WHERE, ORDER BY | `sp_search_trips`; `/trips` and `/lab` |
| Aggregate query procedure JOIN, WHERE, GROUP BY, HAVING, ORDER BY | `sp_operator_summary`; `/reports` and `/lab` |
| Two stored functions with cursor + loop + parameter validation | `fn_driver_workload_hours`, `fn_passenger_captured_spend`; `/reports` |
| Application screens connecting to DB and invoking stored procedures | `/trips`, `/reports`, `/lab`, plus public booking flow |
| Testing SQL in browser | `/lab`: guided tests, explorer, SELECT console, JSON/CSV export |

`/lab` deliberately does **not** accept arbitrary DML or DDL typed by a visitor: use its predefined rollback tests to exercise unsafe statements safely. Its query console permits one read-only SELECT/CTE statement with row and timeout limits. This is deliberate security protection, not a mocked result.

## Local optional development / validation

```bash
cp .env.example .env.local
# Fill .env.local with your Neon credentials and unique long secrets
npm install
npm run check:project
npm run db:init    # fresh empty DB only, optional alternative to /setup
npm run db:test    # executes SQL checks against your DATABASE_URL
npm run dev        # http://localhost:3000
```

`npm run db:upgrade` optionally upgrades a v2 database locally. `npm run typecheck` and `npm run build` are also run in GitHub Actions when you push to GitHub.

### Limits and security

- Payment is **simulated**, not Stripe/VNPay/MoMo. `Payment.status='CAPTURED'` is a **test state**, not evidence that real money was charged.
- Refund `APPROVED` means an **administrator recorded an approval**, not a completed bank transfer. The physical ticket remains in its original state until an explicitly defined refund/settlement process is added.
- Shared `ADMIN_PASSWORD` protects an academic administration workspace; this is distinct from passenger sign-in and is **not a commercial role-based staff authorization implementation**.
- Password hashing, signed HTTP-only sessions, server-side input validation, database ownership checks and PostgreSQL invariants are implemented. Email verification, rate limiting, MFA, full audit logging, external carrier sync, real payment processing, and fraud prevention are outside scope; **do not publicly market the app as a production-ready commercial travel service**.
- All SQL lab mutation tests roll back; PostgreSQL identity sequence values may still advance.
- If editing the original seeded IDs significantly, start a new Neon branch to reproduce the guided tests.
- Database access happens **only inside Next.js server route handlers**; the browser never receives a database URL.

## Documentation

- `docs/ASSIGNMENT1_TRACEABILITY.md` — 23-table map, end-user journey, relationship semantics
- `docs/SQL_TEST_MATRIX.md` — guided SQL test coverage
- `docs/ASSUMPTIONS_AND_CONSTRAINTS.md` — EER mapping and SQL semantic policy choices
- `docs/WEBSITE_ACCEPTANCE_TESTS.md` — repeatable end-to-end test for live booking, payment, seat inventory and SQL lab
- `database/05_upgrade_from_v2.sql` — optional non-destructive upgrade

**Verification transparency:** The repository includes offline structure/syntax checks and live database tests. No existing Neon database or Vercel project is bundled; passing live SQL and Vercel build/test checks requires running them with valid credentials and access to npm packages.

## V4: prove the project actually works (not screenshots or mocked APIs)

This package contains a **real executable full-stack acceptance test**: `scripts/smoke-web.mjs`. It runs against a real Next.js server and a real PostgreSQL database. It makes the same HTTP requests as the passenger-facing website and checks the returned database records.

The GitHub Actions workflow (`.github/workflows/validate.yml`) creates a temporary **PostgreSQL 16** service, runs SQL setup and seed scripts, executes the database regression checks, builds production Next.js, starts the production server, and performs the following API tests:

1. Public HTML is served; `/api/health` connects to PostgreSQL.
2. Seeded stations, bus operators, payment methods, trips, routes and seats are returned.
3. Unauthorized passengers/admins are rejected from private APIs.
4. A new passenger is registered, authenticated and issued a signed session cookie.
5. One booking reserves two seats, creates two tickets, and applies a promotion.
6. The physical seat map and `available_seats` decrease by two.
7. A second passenger cannot double-book an occupied seat.
8. A non-owner cannot pay for the first passenger's booking.
9. Sandbox payment confirms both tickets and persists their statuses.
10. Invoice and eligible refund requests are inserted in the correct database tables.
11. Canceling another pending hold releases its seat without losing the paid seats.
12. Administrator signs in and **all 40 SQL laboratory cases are executed against PostgreSQL**, with rollback for mutation tests.

You can check the **green GitHub Actions job** before relying on the Vercel deployment. If it is red, open the failing step; do not claim the application works until the error is addressed. This is a real test plan, not precomputed results.

**Important:** These E2E tests INSERT actual records. The script intentionally refuses to execute unless `SMOKE_ALLOW_MUTATIONS=YES_ISOLATED_TEST_DATABASE` is supplied. Use it **only** with a disposable CI database or a separate Neon branch. Never point it at customer, class presentation, or shared production data.

To test a production Vercel deployment without mutations, check `/api/health`, search upcoming trips, inspect seat availability and run the rollback SQL lab. Use a dedicated staging Neon branch for the complete HTTP acceptance workflow.

### Verification status at delivery

- Offline code parsing, bundling and static structure tests are available, but **the full Next.js build and PostgreSQL E2E workflow require dependency installation and a running PostgreSQL server**.
- This deliverable is **not claimed to have passed live tests** in the authoring environment. Let the CI pipeline demonstrate the result on your GitHub repository.
- Vercel and Neon are not included in the archive; their credentials are supplied by you during deployment.

### Check your Vercel URL without modifying any database rows

```bash
DEPLOY_URL=https://your-project.vercel.app npm run verify:deploy
```

This safe read-only probe requires no login and validates the rendered public homepage, actual PostgreSQL connection, seeded operator/station catalog, scheduled trips and physical seat inventory. It reports a failure if a page/API returns an error or returns empty/incorrect database-backed data. It is **not a replacement for the GitHub Actions write-flow integration tests**.
