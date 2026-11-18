-- SC04 hotfix for an existing Neon database. Safe to rerun.
-- Do not use the read-only SQL Lab; use Neon Console > SQL Editor.
-- Keeps existing trip CHECK and overlap EXCLUDE constraints unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION fn_check_trip_timing() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.arrival_at <= NEW.departure_at THEN
   RAISE EXCEPTION 'Trip arrival must follow departure' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_trip_timing_guard ON trip;
CREATE TRIGGER a_trip_timing_guard
  BEFORE INSERT OR UPDATE OF departure_at,arrival_at ON trip
  FOR EACH ROW EXECUTE FUNCTION fn_check_trip_timing();

COMMIT;
