-- Reviewed deployment: run the ENTIRE file once in the FoodBuddy SQL Editor as postgres.
-- This transaction changes only the three new FoodBuddy tables and their ACLs/policies.
-- Intentionally fail atomically if any of these application tables already exist.
-- No existing tables, auth users, or policies are altered or deleted.
BEGIN;
-- Abort rather than creating app tables under an unexpected database owner.
DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this migration in the SQL Editor as postgres.';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'Required Supabase Auth objects are missing.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles
             WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Unexpected privileged API role; review role configuration first.';
  END IF;
  IF has_schema_privilege('anon','public','CREATE')
     OR has_schema_privilege('authenticated','public','CREATE') THEN
    RAISE EXCEPTION 'An API role can create public objects; review schema grants first.';
  END IF;
END;
$preflight$;
CREATE TABLE public.foodbuddy_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL CHECK(length(trim(username)) BETWEEN 1 AND 100)
);
CREATE TABLE public.foodbuddy_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_mode text NOT NULL DEFAULT 'device' CHECK(location_mode IN ('device','zip')),
  zip_code text CHECK(zip_code ~ '^[0-9]{5}$'),
  CHECK(location_mode <> 'zip' OR zip_code IS NOT NULL)
);
CREATE TABLE public.foodbuddy_allergy_selections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allergen_key text NOT NULL CHECK(length(trim(allergen_key)) BETWEEN 1 AND 200),
  allergen_name text NOT NULL CHECK(length(trim(allergen_name)) BETWEEN 1 AND 200),
  selected boolean NOT NULL DEFAULT true,
  PRIMARY KEY(user_id,allergen_key)
);
ALTER TABLE public.foodbuddy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foodbuddy_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.foodbuddy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foodbuddy_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.foodbuddy_allergy_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foodbuddy_allergy_selections FORCE ROW LEVEL SECURITY;
-- PUBLIC is PostgreSQL's implicit all-roles group, not the public schema.
-- Remove default/inherited-from-PUBLIC table privileges, then grant only row-level DML.
-- No global default privileges, schema ownership, or built-in Auth objects are changed.
REVOKE ALL PRIVILEGES ON TABLE public.foodbuddy_profiles,public.foodbuddy_settings,public.foodbuddy_allergy_selections
  FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.foodbuddy_profiles,public.foodbuddy_settings,public.foodbuddy_allergy_selections TO authenticated;
CREATE POLICY owner_only ON public.foodbuddy_profiles FOR ALL TO authenticated
  USING ((SELECT auth.uid())=user_id
         AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true')
  WITH CHECK ((SELECT auth.uid())=user_id
              AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true');
CREATE POLICY owner_only ON public.foodbuddy_settings FOR ALL TO authenticated
  USING ((SELECT auth.uid())=user_id
         AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true')
  WITH CHECK ((SELECT auth.uid())=user_id
              AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true');
CREATE POLICY owner_only ON public.foodbuddy_allergy_selections FOR ALL TO authenticated
  USING ((SELECT auth.uid())=user_id
         AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true')
  WITH CHECK ((SELECT auth.uid())=user_id
              AND (SELECT auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'true');
-- Check effective privileges as well as direct grants. Abort on unexpected inheritance.
-- RLS does not protect TRUNCATE, so it must never be granted to an API role.
DO $verify$
DECLARE target regclass; privilege_name text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.foodbuddy_profiles'::regclass,
    'public.foodbuddy_settings'::regclass,
    'public.foodbuddy_allergy_selections'::regclass
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=target
                   AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity) THEN
      RAISE EXCEPTION 'Unexpected owner or RLS configuration on %',target;
    END IF;
    -- Enumerate privileges supported by this server (also covers MAINTAIN on newer PG).
    FOR privilege_name IN SELECT DISTINCT privilege_type
      FROM aclexplode(acldefault('r','postgres'::regrole)) LOOP
      IF has_table_privilege('anon',target,privilege_name) THEN
        RAISE EXCEPTION 'Unexpected effective anon privilege % on %',privilege_name,target;
      END IF;
      IF privilege_name IN ('SELECT','INSERT','UPDATE','DELETE') THEN
        IF NOT has_table_privilege('authenticated',target,privilege_name) THEN
          RAISE EXCEPTION 'Missing authenticated privilege % on %',privilege_name,target;
        END IF;
      ELSIF has_table_privilege('authenticated',target,privilege_name) THEN
        RAISE EXCEPTION 'Unexpected effective authenticated privilege % on %',privilege_name,target;
      END IF;
    END LOOP;
  END LOOP;
END;
$verify$;
COMMIT;
