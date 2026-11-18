-- PostgreSQL stored functions, business triggers, derived triggers and procedures.
-- All procedural code runs inside PostgreSQL (not in Next.js).
BEGIN;

-- Assignment 1: total/disjoint UserAccount ISA, checked at transaction commit.
CREATE OR REPLACE FUNCTION fn_check_one_account_subtype() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_count int;
BEGIN
 v_id := CASE WHEN TG_OP='DELETE' THEN OLD.account_id ELSE NEW.account_id END;
 IF NOT EXISTS(SELECT 1 FROM user_account WHERE account_id=v_id) THEN RETURN NULL; END IF;
 SELECT (SELECT count(*) FROM passenger_profile WHERE account_id=v_id)
       +(SELECT count(*) FROM operator_staff WHERE account_id=v_id)
       +(SELECT count(*) FROM platform_admin WHERE account_id=v_id) INTO v_count;
 IF v_count<>1 THEN RAISE EXCEPTION 'Account % must belong to exactly one subtype, found %',v_id,v_count USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ck_user_isa AFTER INSERT OR UPDATE ON user_account DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_one_account_subtype();
CREATE CONSTRAINT TRIGGER ck_passenger_isa AFTER INSERT OR UPDATE OR DELETE ON passenger_profile DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_one_account_subtype();
CREATE CONSTRAINT TRIGGER ck_staff_isa AFTER INSERT OR UPDATE OR DELETE ON operator_staff DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_one_account_subtype();
CREATE CONSTRAINT TRIGGER ck_admin_isa AFTER INSERT OR UPDATE OR DELETE ON platform_admin DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_one_account_subtype();

-- SC02/SC03: endpoints and monotonically increasing offsets for weak RouteStop.
CREATE OR REPLACE FUNCTION fn_check_route_stops() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_route route%ROWTYPE; v_first bigint; v_last bigint; v_bad boolean;
BEGIN
 v_id := CASE WHEN TG_TABLE_NAME='route' THEN COALESCE(NEW.route_id,OLD.route_id)
              ELSE (CASE WHEN TG_OP='DELETE' THEN OLD.route_id ELSE NEW.route_id END) END;
 SELECT * INTO v_route FROM route WHERE route_id=v_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT station_id INTO v_first FROM route_stop WHERE route_id=v_id ORDER BY stop_order ASC LIMIT 1;
 SELECT station_id INTO v_last FROM route_stop WHERE route_id=v_id ORDER BY stop_order DESC LIMIT 1;
 IF v_first IS DISTINCT FROM v_route.origin_station_id OR v_last IS DISTINCT FROM v_route.destination_station_id THEN
   RAISE EXCEPTION 'Route % stops must begin at its origin and end at its destination',v_id USING ERRCODE='23514';
 END IF;
 SELECT EXISTS(SELECT 1 FROM (
   SELECT offset_minutes,lag(offset_minutes) OVER(ORDER BY stop_order) AS prev
   FROM route_stop WHERE route_id=v_id
 ) s WHERE prev IS NOT NULL AND offset_minutes<prev) INTO v_bad;
 IF v_bad THEN RAISE EXCEPTION 'Route % stop minute offsets must not decrease',v_id USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ck_route_stops_route AFTER INSERT OR UPDATE ON route DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_route_stops();
CREATE CONSTRAINT TRIGGER ck_route_stops_child AFTER INSERT OR UPDATE OR DELETE ON route_stop DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_route_stops();

-- SC17: same-operator staff hierarchy, no indirect supervision cycles.
CREATE OR REPLACE FUNCTION fn_staff_supervisor_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_supervisor_operator bigint; v_cycle boolean;
BEGIN
 IF NEW.supervisor_id IS NULL THEN RETURN NEW; END IF;
 SELECT operator_id INTO v_supervisor_operator FROM operator_staff WHERE account_id=NEW.supervisor_id;
 IF v_supervisor_operator IS DISTINCT FROM NEW.operator_id THEN
   RAISE EXCEPTION 'Supervisor and staff must belong to the same operator' USING ERRCODE='23514';
 END IF;
 WITH RECURSIVE chain AS (
   SELECT account_id, supervisor_id,ARRAY[account_id] AS seen FROM operator_staff WHERE account_id=NEW.supervisor_id
   UNION ALL
   SELECT o.account_id,o.supervisor_id,chain.seen||o.account_id
   FROM operator_staff o JOIN chain ON o.account_id=chain.supervisor_id
   WHERE NOT o.account_id=ANY(chain.seen)
 ) SELECT EXISTS(SELECT 1 FROM chain WHERE account_id=NEW.account_id) INTO v_cycle;
 IF v_cycle THEN RAISE EXCEPTION 'Staff supervision cannot contain cycles' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_staff_supervisor BEFORE INSERT OR UPDATE OF operator_id,supervisor_id ON operator_staff FOR EACH ROW EXECUTE FUNCTION fn_staff_supervisor_guard();

-- SC05/SC09/SC10: assignment compatibility and driver availability.
-- Bus interval conflict is a declarative EXCLUDE constraint in 01_schema.sql.
CREATE OR REPLACE FUNCTION fn_guard_trip() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_operator bigint; v_bus_operator bigint; v_conflict boolean;
BEGIN
 SELECT operator_id INTO v_operator FROM route WHERE route_id=NEW.route_id;
 SELECT operator_id INTO v_bus_operator FROM bus WHERE bus_id=NEW.bus_id;
 IF v_operator IS DISTINCT FROM v_bus_operator THEN
   RAISE EXCEPTION 'Selected bus belongs to a different operator than route %',NEW.route_id USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' THEN
   IF (NEW.bus_id<>OLD.bus_id OR NEW.route_id<>OLD.route_id) AND
      EXISTS(SELECT 1 FROM booking WHERE trip_id=OLD.trip_id) THEN
    RAISE EXCEPTION 'Cannot change route or bus after a trip has bookings' USING ERRCODE='23514';
   END IF;
   IF (NEW.departure_at<>OLD.departure_at OR NEW.arrival_at<>OLD.arrival_at) AND
      EXISTS(SELECT 1 FROM booking WHERE trip_id=OLD.trip_id) THEN
    RAISE EXCEPTION 'Cannot change trip schedule after bookings exist' USING ERRCODE='23514';
   END IF;
   IF NEW.status='CANCELLED' AND OLD.status<>'CANCELLED' AND
      EXISTS(SELECT 1 FROM booking WHERE trip_id=OLD.trip_id AND status IN ('PENDING','PAID')) THEN
    RAISE EXCEPTION 'Cancel or refund active bookings before cancelling their trip' USING ERRCODE='23514';
   END IF;
   SELECT EXISTS(
    SELECT 1 FROM trip_driver_assignment a JOIN driver d ON d.driver_id=a.driver_id
    WHERE a.trip_id=OLD.trip_id AND NEW.status<>'CANCELLED'
      AND (d.operator_id<>v_operator OR d.license_expiry<NEW.departure_at::date
      OR (SELECT bus_type FROM bus WHERE bus_id=NEW.bus_id)='SLEEPER' AND d.license_class<>'E'
      OR EXISTS(SELECT 1 FROM trip_driver_assignment a2 JOIN trip t2 ON t2.trip_id=a2.trip_id
        WHERE a2.driver_id=a.driver_id AND t2.trip_id<>NEW.trip_id AND t2.status<>'CANCELLED'
          AND tstzrange(t2.departure_at,t2.arrival_at,'[)') && tstzrange(NEW.departure_at,NEW.arrival_at,'[)')))
   ) INTO v_conflict;
   IF v_conflict THEN RAISE EXCEPTION 'Trip update conflicts with its driver assignments' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_trip_guard BEFORE INSERT OR UPDATE OF route_id,bus_id,departure_at,arrival_at,status ON trip FOR EACH ROW EXECUTE FUNCTION fn_guard_trip();

CREATE OR REPLACE FUNCTION fn_driver_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_trip trip%ROWTYPE; v_driver driver%ROWTYPE; v_operator bigint; v_bus_type text;
BEGIN
 -- Lock by driver ID to serialize competing appointments for the same driver.
 PERFORM pg_advisory_xact_lock(51002,NEW.driver_id::integer);
 SELECT * INTO v_trip FROM trip WHERE trip_id=NEW.trip_id;
 SELECT * INTO v_driver FROM driver WHERE driver_id=NEW.driver_id;
 SELECT operator_id INTO v_operator FROM route WHERE route_id=v_trip.route_id;
 SELECT bus_type INTO v_bus_type FROM bus WHERE bus_id=v_trip.bus_id;
 IF v_driver.operator_id<>v_operator THEN RAISE EXCEPTION 'Driver must belong to trip operator' USING ERRCODE='23514'; END IF;
 IF v_driver.license_expiry<v_trip.departure_at::date THEN RAISE EXCEPTION 'Driver licence expired at departure' USING ERRCODE='23514'; END IF;
 -- Simplified assignment classification for this course project, not a legal licensing matrix.
 IF v_bus_type='SLEEPER' AND v_driver.license_class<>'E' THEN RAISE EXCEPTION 'Sleeper trip requires E-class driver in the demo policy' USING ERRCODE='23514'; END IF;
 IF v_trip.status<>'CANCELLED' AND EXISTS(
   SELECT 1 FROM trip_driver_assignment a JOIN trip t ON t.trip_id=a.trip_id
   WHERE a.driver_id=NEW.driver_id AND t.trip_id<>NEW.trip_id AND t.status<>'CANCELLED'
     AND tstzrange(t.departure_at,t.arrival_at,'[)') && tstzrange(v_trip.departure_at,v_trip.arrival_at,'[)')
 ) THEN RAISE EXCEPTION 'Driver % has an overlapping trip', NEW.driver_id USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_driver_assignment BEFORE INSERT OR UPDATE OF trip_id,driver_id ON trip_driver_assignment FOR EACH ROW EXECUTE FUNCTION fn_driver_assignment_guard();
CREATE OR REPLACE FUNCTION fn_driver_license_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM trip_driver_assignment a JOIN trip t ON t.trip_id=a.trip_id JOIN bus b ON b.bus_id=t.bus_id
  WHERE a.driver_id=OLD.driver_id AND t.status<>'CANCELLED'
    AND (NEW.license_expiry<t.departure_at::date OR (b.bus_type='SLEEPER' AND NEW.license_class<>'E')))
 THEN RAISE EXCEPTION 'Driver licence change invalidates an assigned trip' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_driver_license_update BEFORE UPDATE OF license_class,license_expiry ON driver
 FOR EACH ROW EXECUTE FUNCTION fn_driver_license_update_guard();

-- SC06: trip-seat must be physically on the trip's selected bus.
CREATE OR REPLACE FUNCTION fn_trip_seat_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_trip_bus bigint; v_seat_bus bigint;
BEGIN
 SELECT bus_id INTO v_trip_bus FROM trip WHERE trip_id=NEW.trip_id;
 SELECT bus_id INTO v_seat_bus FROM seat WHERE seat_id=NEW.seat_id;
 IF v_trip_bus IS DISTINCT FROM v_seat_bus THEN RAISE EXCEPTION 'Seat % does not belong to bus assigned to trip %',NEW.seat_id,NEW.trip_id USING ERRCODE='23514'; END IF;
 IF NEW.is_blocked AND EXISTS(SELECT 1 FROM ticket WHERE trip_id=NEW.trip_id AND seat_id=NEW.seat_id AND status IN ('HELD','CONFIRMED','USED')) THEN
   RAISE EXCEPTION 'Cannot block a seat with an active ticket' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_trip_seat BEFORE INSERT OR UPDATE ON trip_seat FOR EACH ROW EXECUTE FUNCTION fn_trip_seat_guard();
CREATE OR REPLACE FUNCTION fn_seed_trip_seats() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO trip_seat(trip_id,seat_id) SELECT NEW.trip_id,s.seat_id FROM seat s WHERE s.bus_id=NEW.bus_id;
 RETURN NULL;
END $$;
CREATE TRIGGER seed_trip_seats AFTER INSERT ON trip FOR EACH ROW EXECUTE FUNCTION fn_seed_trip_seats();
-- Block changing a physical seat's bus when trip inventory exists.
CREATE OR REPLACE FUNCTION fn_seat_bus_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM trip_seat WHERE seat_id=OLD.seat_id) THEN
  RAISE EXCEPTION 'Cannot reassign physical seat % after trip inventory was generated',OLD.seat_id USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_seat_bus_immutable BEFORE UPDATE OF bus_id ON seat FOR EACH ROW WHEN (OLD.bus_id IS DISTINCT FROM NEW.bus_id) EXECUTE FUNCTION fn_seat_bus_immutable();

-- Guard ownership changes after scheduling, preventing SC05 breakage from master-data edits.
CREATE OR REPLACE FUNCTION fn_owner_locked_after_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_used boolean;
BEGIN
 IF TG_TABLE_NAME='route' THEN
   SELECT EXISTS(SELECT 1 FROM trip WHERE route_id=OLD.route_id) INTO v_used;
 ELSIF TG_TABLE_NAME='bus' THEN
   SELECT EXISTS(SELECT 1 FROM trip WHERE bus_id=OLD.bus_id) INTO v_used;
 ELSIF TG_TABLE_NAME='driver' THEN
   SELECT EXISTS(SELECT 1 FROM trip_driver_assignment WHERE driver_id=OLD.driver_id) INTO v_used;
 ELSE v_used:=false;
 END IF;
 IF v_used THEN RAISE EXCEPTION 'Cannot reassign operator after this resource has been scheduled' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_route_owner BEFORE UPDATE OF operator_id ON route
 FOR EACH ROW WHEN(NEW.operator_id IS DISTINCT FROM OLD.operator_id) EXECUTE FUNCTION fn_owner_locked_after_schedule();
CREATE TRIGGER ck_bus_owner BEFORE UPDATE OF operator_id ON bus
 FOR EACH ROW WHEN(NEW.operator_id IS DISTINCT FROM OLD.operator_id) EXECUTE FUNCTION fn_owner_locked_after_schedule();
CREATE TRIGGER ck_driver_owner BEFORE UPDATE OF operator_id ON driver
 FOR EACH ROW WHEN(NEW.operator_id IS DISTINCT FROM OLD.operator_id) EXECUTE FUNCTION fn_owner_locked_after_schedule();


-- If the operator edits the bus of an unbooked trip, rebuild the trip-specific seats.
CREATE OR REPLACE FUNCTION fn_rebuild_trip_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM trip_seat WHERE trip_id=NEW.trip_id;
 INSERT INTO trip_seat(trip_id,seat_id)
 SELECT NEW.trip_id,s.seat_id FROM seat s WHERE s.bus_id=NEW.bus_id;
 RETURN NULL;
END $$;
CREATE TRIGGER rebuild_trip_inventory AFTER UPDATE OF bus_id ON trip FOR EACH ROW
 WHEN(OLD.bus_id IS DISTINCT FROM NEW.bus_id)
 EXECUTE FUNCTION fn_rebuild_trip_inventory();


-- Derived attribute used to satisfy Assignment 2 §2.2.2.
CREATE OR REPLACE FUNCTION fn_refresh_available_seats(p_trip_id bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE trip t SET available_seats=(
  SELECT count(*)::int FROM trip_seat ts
  WHERE ts.trip_id=p_trip_id AND NOT ts.is_blocked
    AND NOT EXISTS (SELECT 1 FROM ticket tk WHERE tk.trip_id=ts.trip_id AND tk.seat_id=ts.seat_id
      AND tk.status IN ('HELD','CONFIRMED','USED'))
 ) WHERE t.trip_id=p_trip_id;
END $$;
CREATE OR REPLACE FUNCTION fn_trip_seat_capacity_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM fn_refresh_available_seats(OLD.trip_id);
 ELSE PERFORM fn_refresh_available_seats(NEW.trip_id);
      IF TG_OP='UPDATE' AND NEW.trip_id<>OLD.trip_id THEN PERFORM fn_refresh_available_seats(OLD.trip_id); END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER capacity_trip_seat AFTER INSERT OR UPDATE OR DELETE ON trip_seat FOR EACH ROW EXECUTE FUNCTION fn_trip_seat_capacity_changed();

-- SC07/SC11/SC18: pickup/dropoff validation, price snapshot preservation.
CREATE OR REPLACE FUNCTION fn_ticket_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_route_id bigint; v_pickup int; v_dropoff int; v_booking_status text;
BEGIN
 SELECT t.route_id,b.status INTO v_route_id,v_booking_status FROM booking b JOIN trip t ON t.trip_id=b.trip_id WHERE b.booking_id=NEW.booking_id;
 SELECT stop_order INTO v_pickup FROM route_stop
  WHERE route_id=v_route_id AND stop_order=NEW.pickup_stop_order AND pickup_allowed;
 SELECT stop_order INTO v_dropoff FROM route_stop
  WHERE route_id=v_route_id AND stop_order=NEW.dropoff_stop_order AND dropoff_allowed;
 IF v_pickup IS NULL OR v_dropoff IS NULL THEN RAISE EXCEPTION 'Pickup/dropoff stop is not permitted on this route' USING ERRCODE='23514'; END IF;
 IF NEW.status IN ('HELD','CONFIRMED','USED') AND EXISTS (
   SELECT 1 FROM trip_seat WHERE trip_id=NEW.trip_id AND seat_id=NEW.seat_id AND is_blocked
 ) THEN RAISE EXCEPTION 'A blocked seat cannot be held or confirmed' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND v_booking_status='PAID' THEN
   RAISE EXCEPTION 'Cannot add tickets to a settled booking' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.fare_at_booking<>OLD.fare_at_booking OR NEW.trip_id<>OLD.trip_id
      OR NEW.seat_id<>OLD.seat_id OR NEW.booking_id<>OLD.booking_id) AND v_booking_status='PAID' THEN
   RAISE EXCEPTION 'Confirmed ticket financial and seat snapshot cannot be changed' USING ERRCODE='23514';
  END IF;
  IF v_booking_status='PAID' AND NEW.status='CANCELLED' AND OLD.status<>'CANCELLED'
     AND NOT EXISTS(SELECT 1 FROM ticket tk WHERE tk.booking_id=NEW.booking_id AND tk.ticket_id<>OLD.ticket_id AND tk.status<>'CANCELLED') THEN
    RAISE EXCEPTION 'Paid booking cannot lose its last qualifying ticket' USING ERRCODE='23514';
  END IF;
  IF OLD.status IN ('CANCELLED','USED') AND NEW.status<>OLD.status THEN
   RAISE EXCEPTION 'Cannot reactivate or alter final ticket status' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.status='CONFIRMED' AND v_booking_status<>'PAID' THEN
   RAISE EXCEPTION 'A ticket can only be confirmed after its booking is paid' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_ticket BEFORE INSERT OR UPDATE ON ticket FOR EACH ROW EXECUTE FUNCTION fn_ticket_guard();
CREATE OR REPLACE FUNCTION fn_ticket_delete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM booking WHERE booking_id=OLD.booking_id AND status='PAID') THEN
   RAISE EXCEPTION 'Cannot delete a ticket belonging to a paid booking' USING ERRCODE='23514';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER ck_ticket_delete BEFORE DELETE ON ticket FOR EACH ROW EXECUTE FUNCTION fn_ticket_delete_guard();

CREATE OR REPLACE FUNCTION fn_refresh_booking_total(p_booking_id bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE booking b SET total_amount=GREATEST(0,COALESCE((SELECT sum(tk.fare_at_booking) FROM ticket tk WHERE tk.booking_id=p_booking_id AND tk.status<>'CANCELLED'),0)-b.discount_amount_applied)
 WHERE b.booking_id=p_booking_id;
END $$;
CREATE OR REPLACE FUNCTION fn_ticket_derived_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   PERFORM fn_refresh_available_seats(OLD.trip_id);
   PERFORM fn_refresh_booking_total(OLD.booking_id);
 ELSE
   PERFORM fn_refresh_available_seats(NEW.trip_id);
   PERFORM fn_refresh_booking_total(NEW.booking_id);
   IF TG_OP='UPDATE' AND NEW.trip_id<>OLD.trip_id THEN PERFORM fn_refresh_available_seats(OLD.trip_id); END IF;
   IF TG_OP='UPDATE' AND NEW.booking_id<>OLD.booking_id THEN PERFORM fn_refresh_booking_total(OLD.booking_id); END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER derived_ticket AFTER INSERT OR UPDATE OR DELETE ON ticket FOR EACH ROW EXECUTE FUNCTION fn_ticket_derived_changed();

-- SC13/SC15/SC18: settled payments and immutable discount snapshot.
CREATE OR REPLACE FUNCTION fn_booking_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_captured numeric(12,2); v_promo promotion%ROWTYPE; v_uses int;
BEGIN
 IF TG_OP='INSERT' AND NEW.promotion_id IS NOT NULL THEN
   SELECT * INTO v_promo FROM promotion WHERE promotion_id=NEW.promotion_id FOR UPDATE;
   IF NOT FOUND OR NEW.booked_at NOT BETWEEN v_promo.valid_from AND v_promo.valid_until THEN
     RAISE EXCEPTION 'Promotion is not valid at booking time' USING ERRCODE='23514';
   END IF;
   SELECT count(*) INTO v_uses FROM booking WHERE promotion_id=NEW.promotion_id AND status NOT IN ('CANCELLED','EXPIRED');
   IF v_uses>=v_promo.usage_limit THEN RAISE EXCEPTION 'Promotion usage limit reached' USING ERRCODE='23514'; END IF;
 END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.status='PAID' AND (NEW.discount_amount_applied<>OLD.discount_amount_applied OR NEW.total_amount<>OLD.total_amount OR NEW.promotion_id IS DISTINCT FROM OLD.promotion_id) THEN
      RAISE EXCEPTION 'Historical paid-booking financial snapshot is immutable' USING ERRCODE='23514';
   END IF;
   IF NEW.status='PAID' AND OLD.status<>'PAID' THEN
     SELECT COALESCE(sum(amount),0) INTO v_captured FROM payment WHERE booking_id=NEW.booking_id AND payment_status='CAPTURED';
     IF v_captured<NEW.total_amount THEN RAISE EXCEPTION 'Captured payments % are less than payable amount %',v_captured,NEW.total_amount USING ERRCODE='23514'; END IF;
     IF NOT EXISTS(SELECT 1 FROM ticket WHERE booking_id=NEW.booking_id AND status<>'CANCELLED') THEN
       RAISE EXCEPTION 'Paid booking must contain at least one ticket' USING ERRCODE='23514';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_booking BEFORE INSERT OR UPDATE ON booking FOR EACH ROW EXECUTE FUNCTION fn_booking_guard();
CREATE OR REPLACE FUNCTION fn_booking_discount_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM fn_refresh_booking_total(NEW.booking_id); RETURN NULL; END $$;
CREATE TRIGGER booking_discount_recalc AFTER UPDATE OF discount_amount_applied ON booking
  FOR EACH ROW WHEN(NEW.discount_amount_applied IS DISTINCT FROM OLD.discount_amount_applied)
  EXECUTE FUNCTION fn_booking_discount_changed();

-- SC13/SC18: captured transactions backing a paid booking are immutable.
CREATE OR REPLACE FUNCTION fn_payment_immutable_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.payment_status='CAPTURED' AND EXISTS(SELECT 1 FROM booking WHERE booking_id=OLD.booking_id AND status='PAID') THEN
   RAISE EXCEPTION 'Cannot modify or delete captured payment used for a paid booking' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_paid_payment_immutable BEFORE UPDATE OR DELETE ON payment
 FOR EACH ROW EXECUTE FUNCTION fn_payment_immutable_guard();

-- SC14: refund amount cannot exceed eligible captured amount.
CREATE OR REPLACE FUNCTION fn_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_amount numeric(12,2); v_status text;
BEGIN
 SELECT amount,payment_status INTO v_amount,v_status FROM payment WHERE payment_id=NEW.payment_id;
 IF v_status<>'CAPTURED' THEN RAISE EXCEPTION 'Refund requires a captured payment' USING ERRCODE='23514'; END IF;
 IF NEW.amount>v_amount THEN RAISE EXCEPTION 'Refund exceeds captured payment amount' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_refund BEFORE INSERT OR UPDATE ON refund FOR EACH ROW EXECUTE FUNCTION fn_refund_guard();

-- SC16: reviews only for completed trips and legitimate passengers/tickets.
CREATE OR REPLACE FUNCTION fn_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM booking b JOIN trip tr ON tr.trip_id=b.trip_id
  WHERE b.booking_id=NEW.booking_id AND tr.status='COMPLETED' AND b.status='PAID'
    AND EXISTS(SELECT 1 FROM ticket tk WHERE tk.booking_id=b.booking_id AND tk.status IN ('CONFIRMED','USED'))
 ) THEN RAISE EXCEPTION 'Review requires completed trip and a qualifying paid ticket' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ck_review BEFORE INSERT OR UPDATE ON review FOR EACH ROW EXECUTE FUNCTION fn_review_guard();

-- Assignment 2 §2.1: stored-procedure CRUD for exactly one chosen table: Trip.
CREATE OR REPLACE PROCEDURE sp_create_trip(IN p_route_id bigint,IN p_bus_id bigint,IN p_departure timestamptz,IN p_arrival timestamptz,IN p_fare numeric,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v_id bigint;
BEGIN
 IF p_route_id IS NULL OR p_bus_id IS NULL OR p_departure IS NULL OR p_arrival IS NULL OR p_fare IS NULL THEN RAISE EXCEPTION 'Trip route, bus, times and fare are required' USING ERRCODE='22023'; END IF;
 IF p_departure<=now() THEN RAISE EXCEPTION 'New trips must depart in the future' USING ERRCODE='22023'; END IF;
 IF p_arrival<=p_departure THEN RAISE EXCEPTION 'Arrival must be after departure' USING ERRCODE='22023'; END IF;
 IF p_fare<0 THEN RAISE EXCEPTION 'Fare must not be negative' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM route WHERE route_id=p_route_id) THEN RAISE EXCEPTION 'Route % does not exist',p_route_id USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM bus WHERE bus_id=p_bus_id) THEN RAISE EXCEPTION 'Bus % does not exist',p_bus_id USING ERRCODE='22023'; END IF;
 INSERT INTO trip(route_id,bus_id,departure_at,arrival_at,base_fare) VALUES(p_route_id,p_bus_id,p_departure,p_arrival,p_fare) RETURNING trip_id INTO v_id;
 p_result:=jsonb_build_object('trip_id',v_id,'message','Trip created; seats populated automatically');
END $$;
CREATE OR REPLACE PROCEDURE sp_update_trip(IN p_trip_id bigint,IN p_route_id bigint,IN p_bus_id bigint,IN p_departure timestamptz,IN p_arrival timestamptz,IN p_fare numeric,IN p_status text,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$
BEGIN
 IF p_trip_id IS NULL THEN RAISE EXCEPTION 'Trip ID is required' USING ERRCODE='22023'; END IF;
 IF p_arrival<=p_departure THEN RAISE EXCEPTION 'Arrival must be after departure' USING ERRCODE='22023'; END IF;
 IF p_fare<0 THEN RAISE EXCEPTION 'Fare must not be negative' USING ERRCODE='22023'; END IF;
 UPDATE trip SET route_id=p_route_id,bus_id=p_bus_id,departure_at=p_departure,arrival_at=p_arrival,base_fare=p_fare,status=p_status WHERE trip_id=p_trip_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trip % was not found',p_trip_id USING ERRCODE='P0002'; END IF;
 p_result:=jsonb_build_object('trip_id',p_trip_id,'message','Trip updated');
END $$;
CREATE OR REPLACE PROCEDURE sp_delete_trip(IN p_trip_id bigint,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v_status text;
BEGIN
 SELECT status INTO v_status FROM trip WHERE trip_id=p_trip_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trip % was not found',p_trip_id USING ERRCODE='P0002'; END IF;
 IF v_status<>'SCHEDULED' THEN RAISE EXCEPTION 'Only scheduled trips can be deleted' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM booking WHERE trip_id=p_trip_id) THEN
   RAISE EXCEPTION 'Cannot delete trip % because booking history exists',p_trip_id USING ERRCODE='23514';
 END IF;
 DELETE FROM trip_driver_assignment WHERE trip_id=p_trip_id;
 DELETE FROM trip_seat WHERE trip_id=p_trip_id;
 DELETE FROM trip WHERE trip_id=p_trip_id;
 p_result:=jsonb_build_object('trip_id',p_trip_id,'message','Unbooked scheduled trip deleted');
END $$;

-- Assignment 2 §2.3: data-retrieval procedures (with parameter-driven WHERE and HAVING).
CREATE OR REPLACE PROCEDURE sp_search_trips(IN p_search text,IN p_status text,IN p_operator_id bigint,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$
BEGIN
 SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO p_result
 FROM (
  SELECT t.trip_id,t.route_id,t.bus_id,r.operator_id,o.operator_name,
   s_from.station_name AS origin,s_to.station_name AS destination,
   bus.license_plate,t.departure_at,t.arrival_at,t.base_fare,t.status,t.available_seats
  FROM trip t JOIN route r ON r.route_id=t.route_id
  JOIN bus_operator o ON o.operator_id=r.operator_id
  JOIN bus ON bus.bus_id=t.bus_id
  JOIN station s_from ON s_from.station_id=r.origin_station_id
  JOIN station s_to ON s_to.station_id=r.destination_station_id
  WHERE (p_status IS NULL OR t.status=p_status)
    AND (p_operator_id IS NULL OR r.operator_id=p_operator_id)
    AND (p_search IS NULL OR s_from.station_name ILIKE '%'||p_search||'%'
      OR s_to.station_name ILIKE '%'||p_search||'%' OR o.operator_name ILIKE '%'||p_search||'%')
  ORDER BY t.departure_at,t.trip_id LIMIT 200
 ) x;
END $$;
CREATE OR REPLACE PROCEDURE sp_operator_summary(IN p_from date,IN p_to date,IN p_min_trips int,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_min_trips IS NULL OR p_min_trips<0 THEN
   RAISE EXCEPTION 'Invalid summary date range or minimum trips' USING ERRCODE='22023';
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO p_result
 FROM (
   SELECT o.operator_id,o.operator_name,count(t.trip_id)::int AS trip_count,
     COALESCE(sum(t.available_seats),0)::int AS available_seats,
     COALESCE(sum(rev.captured_revenue),0)::numeric(12,2) AS captured_revenue
   FROM bus_operator o JOIN route r ON r.operator_id=o.operator_id
   JOIN trip t ON t.route_id=r.route_id
   LEFT JOIN LATERAL (
     SELECT sum(p.amount) AS captured_revenue FROM booking b
     JOIN payment p ON p.booking_id=b.booking_id
     WHERE b.trip_id=t.trip_id AND p.payment_status='CAPTURED'
   ) rev ON true
   WHERE t.departure_at::date BETWEEN p_from AND p_to
   GROUP BY o.operator_id,o.operator_name
   HAVING count(t.trip_id)>=p_min_trips
   ORDER BY captured_revenue DESC,trip_count DESC,o.operator_name
 ) x;
END $$;

-- Assignment 2 §2.4: 2 distinct parameterized cursor functions with validation and LOOP.
CREATE OR REPLACE FUNCTION fn_driver_workload_hours(p_driver_id bigint,p_from date,p_to date) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE c REFCURSOR; v_depart timestamptz; v_arrive timestamptz; v_hours numeric:=0;
BEGIN
 IF p_driver_id IS NULL OR NOT EXISTS(SELECT 1 FROM driver WHERE driver_id=p_driver_id) THEN RAISE EXCEPTION 'Valid driver required' USING ERRCODE='22023'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from THEN RAISE EXCEPTION 'Invalid workload date range' USING ERRCODE='22023'; END IF;
 OPEN c FOR SELECT t.departure_at,t.arrival_at FROM trip_driver_assignment a JOIN trip t ON t.trip_id=a.trip_id
  WHERE a.driver_id=p_driver_id AND t.status<>'CANCELLED' AND t.departure_at::date BETWEEN p_from AND p_to;
 LOOP
  FETCH c INTO v_depart,v_arrive; EXIT WHEN NOT FOUND;
  v_hours:=v_hours+extract(epoch FROM (v_arrive-v_depart))/3600;
 END LOOP;
 CLOSE c;
 RETURN round(v_hours,2);
END $$;
CREATE OR REPLACE FUNCTION fn_passenger_captured_spend(p_passenger_id bigint,p_from date,p_to date) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE c REFCURSOR; v_amount numeric; v_spent numeric:=0;
BEGIN
 IF p_passenger_id IS NULL OR NOT EXISTS(SELECT 1 FROM passenger_profile WHERE account_id=p_passenger_id) THEN RAISE EXCEPTION 'Valid passenger required' USING ERRCODE='22023'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from THEN RAISE EXCEPTION 'Invalid passenger-spend date range' USING ERRCODE='22023'; END IF;
 OPEN c FOR SELECT p.amount FROM payment p JOIN booking b ON b.booking_id=p.booking_id
  WHERE b.passenger_account_id=p_passenger_id AND p.payment_status='CAPTURED'
    AND p.paid_at::date BETWEEN p_from AND p_to ORDER BY p.paid_at;
 LOOP FETCH c INTO v_amount; EXIT WHEN NOT FOUND; v_spent:=v_spent+v_amount; END LOOP;
 CLOSE c;
 RETURN round(v_spent,2);
END $$;

-- Business demo procedures; payment capture is a simulated sandbox event, never real card processing.
CREATE OR REPLACE PROCEDURE sp_expire_bookings(INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v_count int;
BEGIN
 WITH expired AS (UPDATE booking SET status='EXPIRED' WHERE status='PENDING' AND expires_at<=now() RETURNING booking_id)
 SELECT count(*) INTO v_count FROM expired;
 UPDATE ticket SET status='CANCELLED' WHERE status='HELD' AND booking_id IN (SELECT booking_id FROM booking WHERE status='EXPIRED');
 p_result:=jsonb_build_object('expired_count',v_count,'message','Expired reservations released');
END $$;
CREATE OR REPLACE PROCEDURE sp_place_booking(IN p_passenger bigint,IN p_trip bigint,IN p_seat bigint,IN p_name text,IN p_pickup int,IN p_dropoff int,IN p_promo_code text,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$
DECLARE v_booking bigint;v_fare numeric(12,2);v_discount numeric(12,2):=0;v_promo promotion%ROWTYPE;v_trip_status text;v_departure timestamptz;
BEGIN
 IF p_passenger IS NULL OR p_trip IS NULL OR p_seat IS NULL OR p_name IS NULL OR length(btrim(p_name))<2 THEN
  RAISE EXCEPTION 'Passenger, trip, seat and traveller name are required' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(51001,p_trip::integer);
 UPDATE booking SET status='EXPIRED' WHERE trip_id=p_trip AND status='PENDING' AND expires_at<=now();
 UPDATE ticket SET status='CANCELLED' WHERE trip_id=p_trip AND status='HELD'
   AND booking_id IN (SELECT booking_id FROM booking WHERE trip_id=p_trip AND status='EXPIRED');
 IF NOT EXISTS(SELECT 1 FROM passenger_profile pp JOIN user_account u ON u.account_id=pp.account_id WHERE pp.account_id=p_passenger AND u.status='ACTIVE') THEN
  RAISE EXCEPTION 'Passenger account is not active' USING ERRCODE='23514'; END IF;
 SELECT status,departure_at INTO v_trip_status,v_departure FROM trip WHERE trip_id=p_trip FOR UPDATE;
 IF v_trip_status IS DISTINCT FROM 'SCHEDULED' OR v_departure<=now() THEN RAISE EXCEPTION 'Trip is not available for new bookings' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(ts.fare_override,t.base_fare) INTO v_fare FROM trip_seat ts JOIN trip t ON t.trip_id=ts.trip_id
  WHERE ts.trip_id=p_trip AND ts.seat_id=p_seat AND NOT ts.is_blocked;
 IF NOT FOUND THEN RAISE EXCEPTION 'Seat does not exist or is blocked on this trip' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM ticket WHERE trip_id=p_trip AND seat_id=p_seat AND status IN ('HELD','CONFIRMED','USED')) THEN
  RAISE EXCEPTION 'Seat is already held or booked' USING ERRCODE='23505'; END IF;
 IF p_promo_code IS NOT NULL AND btrim(p_promo_code)<>'' THEN
  SELECT * INTO v_promo FROM promotion WHERE promo_code=upper(btrim(p_promo_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion code not found' USING ERRCODE='22023'; END IF;
  IF v_promo.discount_type='PERCENT' THEN v_discount:=round(v_fare*v_promo.discount_value/100,2);
  ELSE v_discount:=LEAST(v_fare,v_promo.discount_value); END IF;
 END IF;
 INSERT INTO booking(passenger_account_id,trip_id,promotion_id,expires_at)
 VALUES(p_passenger,p_trip,v_promo.promotion_id,now()+interval '15 minutes') RETURNING booking_id INTO v_booking;
 INSERT INTO ticket(booking_id,trip_id,seat_id,traveller_name,pickup_stop_order,dropoff_stop_order,fare_at_booking)
 VALUES(v_booking,p_trip,p_seat,btrim(p_name),p_pickup,p_dropoff,v_fare);
 UPDATE booking SET discount_amount_applied=v_discount WHERE booking_id=v_booking;
 p_result:=jsonb_build_object('booking_id',v_booking,'fare',v_fare,'discount',v_discount,'total_amount',v_fare-v_discount,'expires_in_minutes',15);
END $$;
CREATE OR REPLACE PROCEDURE sp_capture_demo_payment(IN p_booking bigint,IN p_method bigint,INOUT p_result jsonb)
LANGUAGE plpgsql AS $$ DECLARE v_booking booking%ROWTYPE; v_payment bigint;
BEGIN
 SELECT * INTO v_booking FROM booking WHERE booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR v_booking.status<>'PENDING' THEN RAISE EXCEPTION 'Booking is missing or not pending' USING ERRCODE='23514'; END IF;
 IF v_booking.expires_at<=now() THEN RAISE EXCEPTION 'Booking expired; release it before another reservation' USING ERRCODE='23514'; END IF;
 IF v_booking.total_amount<=0 THEN RAISE EXCEPTION 'Demo capture requires a positive payable amount' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payment_method WHERE method_id=p_method) THEN RAISE EXCEPTION 'Unknown payment method' USING ERRCODE='22023'; END IF;
 INSERT INTO payment(booking_id,method_id,amount,payment_status,transaction_ref,paid_at)
 VALUES(p_booking,p_method,v_booking.total_amount,'CAPTURED','SANDBOX-'||gen_random_uuid()::text,now()) RETURNING payment_id INTO v_payment;
 UPDATE booking SET status='PAID' WHERE booking_id=p_booking;
 UPDATE ticket SET status='CONFIRMED' WHERE booking_id=p_booking AND status='HELD';
 p_result:=jsonb_build_object('booking_id',p_booking,'payment_id',v_payment,'status','PAID','amount',v_booking.total_amount,'sandbox',true);
END $$;

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
COMMIT;
