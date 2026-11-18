# SQL Test Matrix — Browser Demonstration

The `/lab` page contains server-owned tests from `src/lib/lab-cases.ts`. These are **executable**, not screenshots. All write tests are run inside transactions and rolled back, but PostgreSQL sequences are not transactional and can advance.

| Requirement | SQL tests / UI |
|---|---|
| 23 mapped relations | All 23 relational tables; Table explorer |
| 5+ rows in every relation | At least five rows in every table |
| PK / FK / CHECK / UNIQUE / EXCLUDE | Key metadata, SC01, SC04, SC08, SC09, SC11 |
| Total/disjoint ISA | Total/disjoint account specialization |
| Weak RouteStop and route ordering | SC02 and SC03 |
| Bus/operator/driver consistency | SC05, SC06, SC10, SC17 |
| Ticket validity | SC07, SC08, SC11 |
| Booking expiration | SC12 |
| Captured payments/discounts/refunds | SC13, SC14, SC15, SC18 |
| Review eligibility | SC16 |
| Stored procedure CREATE/UPDATE/DELETE | CREATE trip, Complete CREATE → UPDATE → DELETE |
| Business trigger demonstration | SC06 rejection from trip-seat trigger |
| Derived attribute trigger | Derived-attribute trigger: available_seats |
| Two query procedures | Filtered trip search; Operator summary |
| Two cursor functions | Driver workload; Passenger captured spend |
| Bonus workflow | Booking hold → sandbox payment, multi-seat one-booking reservation |
| Passenger website procedures | Ownership-checked capture; cancel hold; request refund; issue invoice; submit review |

## Presentation sequence

1. Start with `/setup` (status: 23 tables).
2. Sign in and open `/lab`; select **All 23 relational tables**, then **At least five rows in every table**.
3. Run **SC06** and explain why cross-table trigger validation is needed.
4. Run **Derived-attribute trigger: available_seats** and explain how `trip_seat` changes update the maintained derived value.
5. Run **Complete CREATE → UPDATE → DELETE**, then use `/trips` to demonstrate same stored procedures interactively.
6. Run the two query procedures and two cursor functions and show `/reports`.
7. Click **Run full suite**, inspect PASS/FAIL messages, and export screenshots only after real tests have passed.

**Caveat:** The test suite is self-contained per test but relies on the original seeded IDs and data state. If you materially edit the data (for example, sell all the demo seats on trip 6), use an isolated fresh Neon branch for the assessed presentation.
