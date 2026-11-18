# Assignment 1 → Assignment 2: implementation decisions

## Unchanged model (23 tables)

`UserAccount`, `PassengerProfile`, `OperatorStaff`, `PlatformAdmin`, `BusOperator`, `OperatorPhone`, `Driver`, `Bus`, `Seat`, `Station`, `Route`, `RouteStop`, `Trip`, `TripSeat`, `TripDriverAssignment`, `Promotion`, `Booking`, `Ticket`, `PaymentMethod`, `Payment`, `Refund`, `Invoice`, `Review`.

## Refinements necessary for demonstrable code

- **SC10:** `Driver.license_class` adds a simplified project-specific eligibility rule: sleeper trip requires class E; other trips use D or E. This is **not a representation of current Vietnamese licensing laws**.
- **SC18:** `Booking.discount_amount_applied` freezes the applied discount when booking. Subsequent modifications of the promotion catalogue do not change a paid booking's total.
- **Derived attribute:** `Trip.available_seats` and `Booking.total_amount` are stored as cached derived values. Triggers maintain them; unlike Assignment 1's purely conceptual model, the implementation retains columns for Part 2.2.2.
- **Ticket lifecycle:** `HELD` represents a temporary seat allocation, `CONFIRMED` a settled reservation, `USED` a traveled ticket, `CANCELLED` a released reservation. Unexpired `HELD` and confirmed/used tickets each occupy a trip seat. Captured payments are sandbox entries only.
- **Single refund/payment:** The Assignment 1 simplification is preserved with `UNIQUE(refund.payment_id)`.

## Semantic constraints map

| Constraint | Main enforcement |
| --- | --- |
| SC01 | `route` CHECK origin ≠ destination |
| SC02–SC03 | DEFERRABLE route and route_stop checking triggers, route_stop composite PK and CHECK |
| SC04 | `trip` CHECK arrival > departure |
| SC05 | Trip and driver assignment triggers (operator/vehicle checks) |
| SC06 | `fn_trip_seat_guard` trigger |
| SC07 | Ticket CHECK pickup < dropoff + `fn_ticket_guard` |
| SC08 | `uq_trip_seat_taken` partial UNIQUE index (concurrency safe) |
| SC09 | `ex_bus_no_overlapping_trips` EXCLUDE constraint |
| SC10 | Driver-assignment guards and simplified licence fields |
| SC11 | Composite FK from ticket → booking, payment/booking state guard |
| SC12 | `sp_expire_bookings` (requires explicit invocation) |
| SC13 | `fn_booking_guard` before status changes to PAID |
| SC14 | Refund amount CHECK and `fn_refund_guard` |
| SC15 | Promotion validity/usage check via `fn_booking_guard` |
| SC16 | `fn_review_guard` |
| SC17 | `fn_staff_supervisor_guard` + self-supervision CHECK |
| SC18 | Immutable settled financial snapshot checks |

## Important limitations to disclose

1. `SC12` does not run on a database timer by itself. The admin UI invokes expiry; production deployment needs a scheduler. Expired `HELD` tickets remain blocked until cleanup.
2. Several rules concern *updates to parent tables* (`Bus.operator_id`, `Route.operator_id`, `Driver.operator_id`, etc.). The demo assumes operator/fleet master-data does not change after scheduling. A production system should add matching parent-table update protections or forbid these changes.
3. The database demonstrates route-level seat reservations. Segment-level seat reuse for non-overlapping pickup/drop-off segments is outside the scope of Assignment 1 and is intentionally not implemented.
4. The UI supports one ticket per newly created booking. The schema supports multiple tickets per booking when inserted transactionally with consistent discount calculations.
5. `PassengerProfile` records are samples, not authenticated customer accounts. The web UI is an **administrator demonstration console**, not a public passenger booking service.
6. The `sp_capture_demo_payment` procedure is a **simulation** and must not be wired to real payment processing.
7. Production-grade idempotency, fine-grained role access, audit logging, rate-limiting, scheduled expiry, and full business-rule closure under every possible direct SQL UPDATE are beyond this course demonstrator.
