# SC04 - PostgreSQL error 22000 instead of 23514

SC04 updates trip 6 with `arrival_at < departure_at`. A trip can have assigned drivers, so
`fn_guard_trip` may construct `tstzrange(departure_at,arrival_at)` while checking overlaps.
An inverted range produces SQLSTATE 22000 before the table timing `CHECK` is evaluated.
The exclusion index can also attempt to evaluate the same invalid range.

The fix creates `a_trip_timing_guard`, a BEFORE INSERT/UPDATE trigger that raises
SQLSTATE 23514 on inverted or equal endpoints, before the existing `ck_trip_guard`
(trigger names fire alphabetically in PostgreSQL) and before index constraints.
The existing CHECK and GiST EXCLUDE remain untouched.

## Existing Neon DB: required one-time action

1. Update Vercel with the corrected source and deploy.
2. Open **Neon Console > SQL Editor** for the existing database `neondb`.
3. Execute `database/07_fix_sc04_existing_neon.sql` (only DDL; no data changes).
4. Open `/lab`, re-run **SC04**, then the full test suite.

A Vercel redeploy alone does **not** update stored PostgreSQL functions/triggers
in an already initialized database. Do **not** run `db:init` again.

## Fresh database

The corrected `02_logic.sql` and `src/generated/db-bundle.ts` include this guard
for future first-time initializations.

## Validation

Run `npm run test:sc04` and `npm run check:sql` before deploying.
