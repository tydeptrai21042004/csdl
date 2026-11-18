-- Neon-specific access control: app uses a single trusted database owner role.
-- Neon does not provide Supabase's anon/authenticated/service_role roles or Data API.
-- Only server-side Next.js may connect to this database; passwords stay in Vercel.
-- The creator/owner of these tables bypasses RLS (not FORCE RLS), so the app
-- retains access while newly added untrusted roles do not have public grants.
BEGIN;
DO $secure$
DECLARE
  tab text;
  routine_record record;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'user_account','passenger_profile','platform_admin','bus_operator',
    'operator_staff','operator_phone','driver','bus','seat','station',
    'route','route_stop','trip','trip_seat','trip_driver_assignment',
    'promotion','booking','ticket','payment_method','payment',
    'refund','invoice','review'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',tab);
  END LOOP;
  FOR routine_record IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
     WHERE n.nspname='public' AND (p.proname LIKE 'sp_%' OR p.proname LIKE 'fn_%')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON ROUTINE %s FROM PUBLIC',routine_record.signature);
  END LOOP;
END $secure$;
COMMIT;
