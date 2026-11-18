# Traceability to Assignment 1: Intercity Bus Ticket Booking System

The specification is the user-supplied 25-page Assignment 1 report (`2233164.pdf`), **not** a separate invented travel-booking business. Section 1.2 describes a multi-operator reservation site, one scheduled trip per booking, multiple travelers/tickets per booking, selectable route stops, price snapshots, payments, promotions, invoices, refunds and reviews. The SQL here maps that model.

## Each of the 23 relations has a website or administrative entry point

| Assignment 1 schema | Business purpose | Where it is visible or changed |
|---|---|---|
| R01 UserAccount | account superclass | `/account` registration/login; `/lab` records |
| R02 PassengerProfile | traveler account subtype | `/account`, `/my-bookings`; login identity for booking ownership |
| R03 OperatorStaff | staffing, supervisors | `/lab` Table explorer; SC17 test |
| R04 PlatformAdmin | ISA administration subtype | `/lab` Table explorer and ISA tests |
| R05 BusOperator | transport company | `/operators`, `/` search, `/operations` joins |
| R06 OperatorPhone | multivalued phone attribute | `/operators` contact numbers |
| R07 Driver | operator's licensed drivers | `/operations` driver tab; `/reports` workload |
| R08 Bus | physical vehicle | `/operations` fleet tab, `/checkout/[id]` bus type/deck |
| R09 Seat | named physical bus seat | `/checkout/[id]` live seat map |
| R10 Station | origin/destination and stops | `/` search, `/operators` routes, `/operations` stations |
| R11 Route | recurring route definition | `/` search, `/operators`, `/trips` |
| R12 RouteStop | **weak entity**, stop order key | `/checkout/[id]` boarding/alighting choices; SC02/03/07 |
| R13 Trip | scheduled departure | `/` listings; `/trips` stored-procedure CRUD |
| R14 TripSeat | per-trip physical seat state | `/checkout/[id]` availability, fares and blocking; SC06/08 |
| R15 TripDriverAssignment | N:M driver assignment | `/lab` explorer; `/reports` cursor hours |
| R16 Promotion | fare discount | `/checkout/[id]` promo code and historical snapshot |
| R17 Booking | passenger's reserved trip | `/checkout/[id]`, `/my-bookings`, `/bookings` |
| R18 Ticket | per-seat actual traveler, stops | `/my-bookings` ticket details and print |
| R19 PaymentMethod | selectable payment channel | `/my-bookings` sandbox payment selector |
| R20 Payment | captured/failed payment attempt | `/my-bookings` capture, `/bookings`, `/lab` |
| R21 Refund | one refund per successful payment | `/my-bookings` request, `/operations` admin review |
| R22 Invoice | optional billing record | `/my-bookings` issue invoice; `/operations` explorer |
| R23 Review | one review per qualifying booking | `/my-bookings` post-trip review; `/operations` |

## Correct EER relationship behavior

- **User ISA**: `UserAccount` + `PassengerProfile` are inserted in the same transaction; deferred trigger requires exactly one subtype. Sample staff/admin entities remain available as specified.
- **Route vs Trip**: routes are reusable itineraries, while trips are scheduled departures allocated a physical bus; the trip's assigned route and bus must share an operator.
- **RouteStop is weak**: `(route_id, stop_order)` identifies a stop; pickup precedes dropoff, and both must belong to that route.
- **Seat vs TripSeat**: Seat identifies a physical location in a bus. TripSeat controls availability and fare override on one departure; held/confirmed tickets lock seats uniquely for that trip.
- **Booking 1:N Ticket**: a single booking has one scheduled trip; multi-seat checkout writes up to six ticket rows, each with its own actual traveler and fare snapshot.
- **Booking–Promotion**: discounts are validated at booking time and `discount_amount_applied` stores a historical snapshot; later promo changes cannot change a settled booking.
- **Booking–Payment–Refund**: demo capture moves booking to PAID with at least one ticket; refund requests are one-per-payment and limited by the captured amount.
- **Optional Invoice/Review**: invoice can be issued once for a paid booking; review requires a completed trip with a paid qualifying ticket.
- **Driver N:M Trip**: driver assignments with `role` and `assigned_at` are retained; coursework cursor calculations operate on those rows.

## Complete customer workflow

1. Public browser searches actual future Trips via stations and operators.
2. Visitor opens a Trip and sees its actual TripSeat inventory and RouteStop list.
3. Traveler selects 1–6 seats, provides names, boarding/alighting stops and optional discount.
4. Account registration inserts UserAccount + PassengerProfile under total/disjoint ISA and starts a signed session.
5. A PostgreSQL stored procedure atomically validates every seat, expires stale holds, locks the trip, creates one Booking and multiple Ticket records, then computes the ticket price snapshots and discount amount. Competing reservations fail safely.
6. The passenger can inspect/cancel the pending hold or complete a **sandbox-only** payment. A confirmed payment becomes a Payment record, updates Booking to PAID, and changes Ticket statuses to CONFIRMED.
7. The passenger can see trip history, issue Invoice, request Refund when allowed, and write a Review after eligible completed trips. Admin can record refund approval/rejection. No real funds transfer.
8. An administrator can query all 23 tables and run the 18 semantic constraint demonstrations in the SQL lab.

## Assignment 2 additions that intentionally refine Assignment 1

Three columns described in the original v2 implementation remain: `driver.license_class` (SC10 qualification), `booking.discount_amount_applied` (SC18 immutable promotion amount), and `trip.available_seats` (a stored derived attribute maintained by the mandated trigger). No entity/relation was dropped or added: **23 relations remain**. The frontend and added booking routines make the original one-booking/many-ticket relationship usable by an end user; they do not change that relationship.

**Distinction:** The seed data is synthetic, and simulated payment/refund status changes are not external payment provider operations. The website is functional at the database/application layer, but is not a commercial ticket-distribution system.
