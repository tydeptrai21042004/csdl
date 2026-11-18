-- Supabase security: prevent the public Data API from exposing the 23 Assignment 1 tables.
-- The Next.js server uses PostgreSQL directly, not Supabase REST or Supabase Auth.
-- Run after schema, routines and seed; on a dedicated Supabase project for this application.
BEGIN;
DO $guard$
DECLARE
  entity text;
  role_name text;
  routine_record record;
BEGIN
  -- Row-level security without policies denies Data API access to application tables.
  FOREACH entity IN ARRAY ARRAY[
    'user_account',
    'passenger_profile',
    'platform_admin',
    'bus_operator',
    'operator_staff',
    'operator_phone',
    'driver',
    'bus',
    'seat',
    'station',
    'route',
    'route_stop',
    'trip',
    'trip_seat',
    'trip_driver_assignment',
    'promotion',
    'booking',
    'ticket',
    'payment_method',
    'payment',
    'refund',
    'invoice',
    'review'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', entity);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',entity,role_name);
      END IF;
    END LOOP;
  END LOOP;
  -- A client holding only the public Supabase key must not invoke business routines.
  FOR routine_record IN
      SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND (p.proname LIKE 'sp_%' OR p.proname LIKE 'fn_%')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC',routine_record.signature);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM %I',routine_record.signature,role_name);
      END IF;
    END LOOP;
  END LOOP;
  -- Supabase grants default public schema privileges in some project versions.
  -- Revoke permissions for future app-created objects too.
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',role_name);
    END IF;
  END LOOP;
END $guard$;
COMMIT;
