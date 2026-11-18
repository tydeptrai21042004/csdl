-- Upgrade an already-initialized v2 installation to the customer-facing website.
-- Keeps the SAME 23 tables, all existing customers/bookings, and historical prices.
-- Idempotent: no DROP, no TRUNCATE, no replacement of original transaction rows.
BEGIN;
DO $$ BEGIN IF to_regclass('public.user_account') IS NULL THEN RAISE EXCEPTION 'Initialize a fresh database first'; END IF; END $$;
-- Passenger-facing transactions; ownership is verified INSIDE PostgreSQL under row locks.
-- These complement, but never replace, the three required Trip CRUD procedures.
CREATE OR REPLACE PROCEDURE sp_capture_passenger_demo_payment(IN p_booking bigint,IN p_passenger bigint,IN p_method bigint,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v_owner bigint; v_details jsonb;
BEGIN
 SELECT passenger_account_id INTO v_owner FROM booking WHERE booking_id=p_booking FOR UPDATE;
 IF v_owner IS NULL OR v_owner<>p_passenger THEN RAISE EXCEPTION 'Booking does not belong to your account' USING ERRCODE='23514'; END IF;
 CALL sp_capture_demo_payment(p_booking,p_method,v_details);
 p_result:=v_details;
END $$;
CREATE OR REPLACE PROCEDURE sp_cancel_passenger_hold(IN p_booking bigint,IN p_passenger bigint,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v booking%ROWTYPE;
BEGIN
 SELECT * INTO v FROM booking WHERE booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR v.passenger_account_id<>p_passenger THEN RAISE EXCEPTION 'Booking was not found for this passenger' USING ERRCODE='23514'; END IF;
 IF v.status<>'PENDING' THEN RAISE EXCEPTION 'Only unpaid seat holds can be cancelled; for paid tickets request a refund' USING ERRCODE='23514'; END IF;
 UPDATE booking SET status='CANCELLED' WHERE booking_id=p_booking;
 UPDATE ticket SET status='CANCELLED' WHERE booking_id=p_booking AND status='HELD';
 p_result:=jsonb_build_object('booking_id',p_booking,'status','CANCELLED','message','Seat hold released');
END $$;
CREATE OR REPLACE PROCEDURE sp_request_passenger_refund(IN p_booking bigint,IN p_passenger bigint,IN p_reason text,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v booking%ROWTYPE; v_payment bigint; v_amount numeric; v_depart timestamptz; v_id bigint;
BEGIN
 SELECT * INTO v FROM booking WHERE booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR v.passenger_account_id<>p_passenger THEN RAISE EXCEPTION 'Booking not found for passenger' USING ERRCODE='23514'; END IF;
 IF v.status<>'PAID' THEN RAISE EXCEPTION 'Only paid bookings can request refunds' USING ERRCODE='23514'; END IF;
 SELECT departure_at INTO v_depart FROM trip WHERE trip_id=v.trip_id;
 IF v_depart<=now()+interval '24 hours' THEN RAISE EXCEPTION 'Refund requests close 24 hours before departure' USING ERRCODE='23514'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason))<8 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Please provide a reason of 8 to 500 characters' USING ERRCODE='22023'; END IF;
 SELECT payment_id,amount INTO v_payment,v_amount FROM payment WHERE booking_id=p_booking AND payment_status='CAPTURED' ORDER BY payment_id LIMIT 1;
 IF v_payment IS NULL OR EXISTS(SELECT 1 FROM refund WHERE payment_id=v_payment) THEN RAISE EXCEPTION 'Refund request already exists or no captured payment is available' USING ERRCODE='23514'; END IF;
 INSERT INTO refund(payment_id,amount,refund_status,reason) VALUES(v_payment,v_amount,'REQUESTED',btrim(p_reason)) RETURNING refund_id INTO v_id;
 p_result:=jsonb_build_object('refund_id',v_id,'refund_status','REQUESTED','message','Refund request recorded; no funds have been returned');
END $$;
CREATE OR REPLACE PROCEDURE sp_submit_passenger_review(IN p_booking bigint,IN p_passenger bigint,IN p_rating int,IN p_comment text,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v_id bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM booking WHERE booking_id=p_booking AND passenger_account_id=p_passenger) THEN
  RAISE EXCEPTION 'Booking does not belong to the signed-in passenger' USING ERRCODE='23514'; END IF;
 IF p_rating<1 OR p_rating>5 OR p_rating IS NULL THEN RAISE EXCEPTION 'Rating must be 1 to 5' USING ERRCODE='22023'; END IF;
 INSERT INTO review(booking_id,rating,comment) VALUES(p_booking,p_rating,left(btrim(COALESCE(p_comment,'')),500)) RETURNING review_id INTO v_id;
 p_result:=jsonb_build_object('review_id',v_id,'message','Review submitted');
END $$;

-- Multi-seat reservation: a single booking may issue several actual-traveller tickets,
-- as expressly required by Assignment 1 (Booking 1:N Ticket).
CREATE OR REPLACE PROCEDURE sp_place_multi_booking(IN p_passenger bigint,IN p_trip bigint,IN p_seats jsonb,
 IN p_pickup int,IN p_dropoff int,IN p_promo_code text,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$
DECLARE v_booking bigint; v_count int; v_total numeric(12,2):=0; v_discount numeric(12,2):=0;
 v_promo promotion%ROWTYPE; v_trip trip%ROWTYPE; v_seat record; v_fare numeric(12,2);
BEGIN
 IF jsonb_typeof(p_seats) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Seats must be a JSON array' USING ERRCODE='22023'; END IF;
 v_count:=jsonb_array_length(p_seats);
 IF v_count<1 OR v_count>6 THEN RAISE EXCEPTION 'Select between 1 and 6 seats per booking' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT (elem->>'seat_id')::bigint) FROM jsonb_array_elements(p_seats) AS x(elem))<>v_count THEN
  RAISE EXCEPTION 'Cannot select a seat twice in one booking' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(51001,p_trip::integer);
 UPDATE booking SET status='EXPIRED' WHERE trip_id=p_trip AND status='PENDING' AND expires_at<=now();
 UPDATE ticket SET status='CANCELLED' WHERE trip_id=p_trip AND status='HELD'
  AND booking_id IN (SELECT booking_id FROM booking WHERE trip_id=p_trip AND status='EXPIRED');
 IF NOT EXISTS(SELECT 1 FROM passenger_profile pp JOIN user_account ua ON ua.account_id=pp.account_id
   WHERE pp.account_id=p_passenger AND ua.status='ACTIVE') THEN RAISE EXCEPTION 'Passenger account is not active' USING ERRCODE='23514'; END IF;
 SELECT * INTO v_trip FROM trip WHERE trip_id=p_trip FOR UPDATE;
 IF NOT FOUND OR v_trip.status<>'SCHEDULED' OR v_trip.departure_at<=now() THEN RAISE EXCEPTION 'Trip is no longer available' USING ERRCODE='23514'; END IF;
 FOR v_seat IN SELECT * FROM jsonb_to_recordset(p_seats) AS x(seat_id bigint,traveller_name text) LOOP
   IF v_seat.seat_id IS NULL OR v_seat.traveller_name IS NULL OR length(btrim(v_seat.traveller_name))<2 OR length(v_seat.traveller_name)>120 THEN
    RAISE EXCEPTION 'Each seat requires a valid traveller name' USING ERRCODE='22023'; END IF;
   SELECT COALESCE(ts.fare_override,t.base_fare) INTO v_fare FROM trip_seat ts JOIN trip t ON t.trip_id=ts.trip_id
    WHERE ts.trip_id=p_trip AND ts.seat_id=v_seat.seat_id AND NOT ts.is_blocked;
   IF NOT FOUND OR EXISTS(SELECT 1 FROM ticket tk WHERE tk.trip_id=p_trip AND tk.seat_id=v_seat.seat_id AND tk.status IN ('HELD','CONFIRMED','USED')) THEN
    RAISE EXCEPTION 'Selected seat is unavailable; refresh seat selection' USING ERRCODE='23505'; END IF;
   v_total:=v_total+v_fare;
 END LOOP;
 IF p_promo_code IS NOT NULL AND length(btrim(p_promo_code))>0 THEN
  SELECT * INTO v_promo FROM promotion WHERE promo_code=upper(btrim(p_promo_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion code not found' USING ERRCODE='22023'; END IF;
  IF v_promo.discount_type='PERCENT' THEN v_discount:=round(v_total*v_promo.discount_value/100,2);
  ELSE v_discount:=LEAST(v_total,v_promo.discount_value); END IF;
 END IF;
 INSERT INTO booking(passenger_account_id,trip_id,promotion_id,expires_at)
 VALUES(p_passenger,p_trip,v_promo.promotion_id,now()+interval '15 minutes') RETURNING booking_id INTO v_booking;
 FOR v_seat IN SELECT * FROM jsonb_to_recordset(p_seats) AS x(seat_id bigint,traveller_name text) LOOP
   SELECT COALESCE(ts.fare_override,t.base_fare) INTO v_fare FROM trip_seat ts JOIN trip t ON t.trip_id=ts.trip_id
    WHERE ts.trip_id=p_trip AND ts.seat_id=v_seat.seat_id;
   INSERT INTO ticket(booking_id,trip_id,seat_id,traveller_name,pickup_stop_order,dropoff_stop_order,fare_at_booking)
    VALUES(v_booking,p_trip,v_seat.seat_id,btrim(v_seat.traveller_name),p_pickup,p_dropoff,v_fare);
 END LOOP;
 UPDATE booking SET discount_amount_applied=v_discount WHERE booking_id=v_booking;
 p_result:=jsonb_build_object('booking_id',v_booking,'ticket_count',v_count,'subtotal',v_total,'discount',v_discount,
    'total_amount',v_total-v_discount,'expires_in_minutes',15,'status','PENDING');
END $$;

-- A passenger can issue one invoice for their settled booking; invoice has its own lifecycle.
CREATE OR REPLACE PROCEDURE sp_issue_passenger_invoice(IN p_booking bigint,IN p_passenger bigint,
 IN p_billing_name text,IN p_tax_code text,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v booking%ROWTYPE; v_id bigint;
BEGIN
 SELECT * INTO v FROM booking WHERE booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR v.passenger_account_id<>p_passenger THEN RAISE EXCEPTION 'Booking not found for passenger' USING ERRCODE='23514'; END IF;
 IF v.status<>'PAID' THEN RAISE EXCEPTION 'Invoice can only be issued for paid bookings' USING ERRCODE='23514'; END IF;
 IF p_billing_name IS NULL OR length(btrim(p_billing_name))<2 OR length(p_billing_name)>150 THEN
  RAISE EXCEPTION 'Billing name must be 2 to 150 characters' USING ERRCODE='22023'; END IF;
 IF length(COALESCE(p_tax_code,''))>60 THEN RAISE EXCEPTION 'Tax code is too long' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM invoice WHERE booking_id=p_booking) THEN
  RAISE EXCEPTION 'This booking already has an issued invoice' USING ERRCODE='23514'; END IF;
 INSERT INTO invoice(booking_id,billing_name,tax_code) VALUES(p_booking,btrim(p_billing_name),NULLIF(btrim(p_tax_code),'')) RETURNING invoice_id INTO v_id;
 p_result:=jsonb_build_object('invoice_id',v_id,'message','Invoice record created');
END $$;

-- Expand the bus inventory only where seat codes have not been installed yet.
INSERT INTO seat(bus_id,seat_code,deck_no,seat_class)
SELECT b.bus_id,'A'||lpad(x.n::text,2,'0'),CASE WHEN b.deck_count=2 AND x.n>9 THEN 2 ELSE 1 END,
 CASE WHEN x.n IN (1,2,10,11) THEN 'VIP' ELSE 'STANDARD' END
FROM bus b CROSS JOIN generate_series(1,18) AS x(n)
WHERE NOT EXISTS(SELECT 1 FROM seat s WHERE s.bus_id=b.bus_id AND s.seat_code='A'||lpad(x.n::text,2,'0'));
INSERT INTO trip_seat(trip_id,seat_id)
SELECT t.trip_id,s.seat_id FROM trip t JOIN seat s ON s.bus_id=t.bus_id
WHERE NOT EXISTS(SELECT 1 FROM trip_seat ts WHERE ts.trip_id=t.trip_id AND ts.seat_id=s.seat_id);
COMMIT;
