# Real website acceptance tests (Supabase + Vercel)

These checks prove the public website reads/writes the same 23-table Assignment 1 PostgreSQL database used by the admin SQL laboratory. Perform them **after initializing a fresh Supabase database**. No real tickets are issued and all payments are simulated.

## Passenger journey

1. Open `/` in a private browser. Confirm at least 10 future departures from the seeded `trip` table, with price, route and live available-seat count. Filter by origin, destination and a valid date.
2. Open a departure via **Choose seats**. Confirm seat codes correspond to seeded physical `seat` / `trip_seat` records. Select two free seats, enter two different traveler names, choose valid pickup and drop-off stops, and enter `SAVE10`.
3. Register at `/account`, sign in, return to the same trip and place the reservation. Confirm a real `booking` row and exactly two `ticket` rows with the same `booking_id` using `/lab`'s SELECT console.
4. Open the same departure from another private browser. Both held seats should be unavailable and `trip.available_seats` should have decreased by two.
5. Open `/my-bookings`. Confirm it lists only the signed-in user's reservations and both traveler tickets. Complete **sandbox payment**. Confirm an actual `payment` with `CAPTURED`, `booking.status='PAID'` and `ticket.status='CONFIRMED'` in the database; the seats must remain occupied.
6. Create an invoice record from a paid booking. Confirm one and only one `invoice` row is associated with the booking.
7. Log out and register a second user. Confirm that `/my-bookings` cannot display or mutate the first user's booking, including when using an explicit first-user `booking_id` on the API.
8. Make a new unpaid booking and choose **Cancel hold**. Verify the booking/tickets become cancelled and the seats become bookable again.
9. For an eligible paid upcoming booking, request a refund and inspect the `refund` row. Admin decision can change request status, but **no external funds move**. Historical completed seeded bookings can be used to demonstrate review eligibility in `/lab`.

## Administration and SQL Assignment 2

1. Log in to the administrator workspace using `ADMIN_PASSWORD`.
2. At `/trips`, create, edit and delete a future trip through `sp_create_trip`, `sp_update_trip`, `sp_delete_trip` (not direct browser SQL).
3. At `/reports`, run a joined search query and grouped operator statistics using input filters. Execute the two cursor/loop functions.
4. At `/lab`, run the 18 SC01–SC18 constraint demonstrations, the full guided SQL test suite, and inspect the sample rows in all 23 tables. Expected database exceptions in negative tests should appear as **PASS**.
5. In the read-only SQL editor, run:

```sql
SELECT b.booking_id, b.status, tk.ticket_id, s.seat_code, tk.traveller_name
FROM booking b
JOIN ticket tk ON tk.booking_id = b.booking_id
JOIN seat s ON s.seat_id = tk.seat_id
ORDER BY b.booking_id DESC, tk.ticket_id DESC
LIMIT 20;
```

6. Run `npm run db:test` with the same Supabase database from a computer with Node.js and npm. It should verify sample counts and SQL business logic.

## Verify no static mock

- Public trip search calls `/api/public/trips`; seat selection calls `/api/public/trips/[id]`.
- Passenger actions call `/api/passenger/...` server handlers; stored procedures write the database.
- Refreshing the page or opening a second browser sees persisted database changes.
- PostgreSQL connection strings are present **only** in server environment variables.

## Known limits

- A local package install, real PostgreSQL transaction execution and a production Vercel build have to run in an environment with npm network access and Supabase credentials.
- The sandbox does not perform bank transactions, verify email addresses or issue actual transportation tickets.
- For classroom demonstration, use synthetic passenger names/email addresses and the prepared demo sample data.
