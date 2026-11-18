-- Non-destructive SQL demonstration. Run after seeding.
-- Run these in the Neon SQL editor (one statement at a time for review).

-- 23 relations all populated with >=5 rows.
SELECT 'user_account' AS table_name,count(*) FROM user_account
UNION ALL SELECT 'passenger_profile',count(*) FROM passenger_profile
UNION ALL SELECT 'operator_staff',count(*) FROM operator_staff
UNION ALL SELECT 'platform_admin',count(*) FROM platform_admin
UNION ALL SELECT 'bus_operator',count(*) FROM bus_operator
UNION ALL SELECT 'operator_phone',count(*) FROM operator_phone
UNION ALL SELECT 'driver',count(*) FROM driver
UNION ALL SELECT 'bus',count(*) FROM bus
UNION ALL SELECT 'seat',count(*) FROM seat
UNION ALL SELECT 'station',count(*) FROM station
UNION ALL SELECT 'route',count(*) FROM route
UNION ALL SELECT 'route_stop',count(*) FROM route_stop
UNION ALL SELECT 'trip',count(*) FROM trip
UNION ALL SELECT 'trip_seat',count(*) FROM trip_seat
UNION ALL SELECT 'trip_driver_assignment',count(*) FROM trip_driver_assignment
UNION ALL SELECT 'promotion',count(*) FROM promotion
UNION ALL SELECT 'booking',count(*) FROM booking
UNION ALL SELECT 'ticket',count(*) FROM ticket
UNION ALL SELECT 'payment_method',count(*) FROM payment_method
UNION ALL SELECT 'payment',count(*) FROM payment
UNION ALL SELECT 'refund',count(*) FROM refund
UNION ALL SELECT 'invoice',count(*) FROM invoice
UNION ALL SELECT 'review',count(*) FROM review ORDER BY table_name;

-- Search stored procedure: WHERE + JOIN + ORDER BY.
CALL sp_search_trips('Mien Dong',NULL,NULL,'[]'::jsonb);
-- Grouped summary: WHERE + GROUP BY + HAVING + ORDER BY.
CALL sp_operator_summary(current_date-90,current_date+90,1,'[]'::jsonb);
-- Two distinct cursor functions.
SELECT fn_driver_workload_hours(1,current_date-90,current_date+90);
SELECT fn_passenger_captured_spend(201,current_date-90,current_date+90);

-- Derived trigger: block an available seat in an unbooked upcoming trip, verify change,
-- then roll back, preserving the sample data.
BEGIN;
SELECT trip_id,available_seats FROM trip WHERE trip_id=6;
UPDATE trip_seat SET is_blocked=true WHERE trip_id=6 AND seat_id=2;
SELECT trip_id,available_seats FROM trip WHERE trip_id=6;
ROLLBACK;

-- Trigger failure example: seat 6 belongs to bus 2, trip 6 uses bus 1.
-- EXPECTED ERROR: 'Seat 6 does not belong to bus assigned to trip 6'.
-- BEGIN; INSERT INTO trip_seat(trip_id,seat_id) VALUES(6,6); ROLLBACK;

-- UNIQUE/active-seat violation example: trip 1 seat 1 is already used.
-- For a direct stress test insert a second booking first and try Ticket with same seat;
-- expected SQLSTATE 23505 from uq_trip_seat_taken.

-- CRUD examples: create a future trip and update/delete using procedures (manual test).
-- CALL sp_create_trip(1,1,now()+interval '80 days',now()+interval '80 days 6 hours',300000,'{}'::jsonb);
-- use the returned trip_id, then:
-- CALL sp_update_trip(<id>,1,1,now()+interval '81 days',now()+interval '81 days 6 hours',310000,'SCHEDULED','{}'::jsonb);
-- CALL sp_delete_trip(<id>,'{}'::jsonb);
