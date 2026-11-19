-- POST-DEPLOYMENT TEST ONLY. Run as postgres after applying the migration.
-- Inserts only synthetic transaction-local fixtures; final ROLLBACK removes all of them.
-- This file is NOT part of the migration and has not been executed by the assistant.
BEGIN;
SELECT set_config('foodbuddy.test_a',gen_random_uuid()::text,true);
SELECT set_config('foodbuddy.test_b',gen_random_uuid()::text,true);
INSERT INTO auth.users(id) VALUES(current_setting('foodbuddy.test_a')::uuid),(current_setting('foodbuddy.test_b')::uuid);
INSERT INTO public.foodbuddy_profiles(user_id,username) VALUES
 (current_setting('foodbuddy.test_a')::uuid,'Synthetic A'),(current_setting('foodbuddy.test_b')::uuid,'Synthetic B');
INSERT INTO public.foodbuddy_settings(user_id) VALUES(current_setting('foodbuddy.test_a')::uuid),(current_setting('foodbuddy.test_b')::uuid);
INSERT INTO public.foodbuddy_allergy_selections(user_id,allergen_key,allergen_name) VALUES
 (current_setting('foodbuddy.test_a')::uuid,'fixture-a','Fixture A'),(current_setting('foodbuddy.test_b')::uuid,'fixture-b','Fixture B');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('foodbuddy.test_a'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('foodbuddy.test_a'),'role','authenticated','is_anonymous',false)::text,true);
DO $test$
DECLARE target text; affected integer; visible integer; insert_sql text;
BEGIN
  FOREACH target IN ARRAY ARRAY['foodbuddy_profiles','foodbuddy_settings','foodbuddy_allergy_selections'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',target) INTO visible;
    IF visible<>1 THEN RAISE EXCEPTION 'Read isolation failed: %',target; END IF;
    EXECUTE format('UPDATE public.%I SET user_id=user_id WHERE user_id=$1',target) USING current_setting('foodbuddy.test_b')::uuid;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Cross-account update allowed: %',target; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',target) USING current_setting('foodbuddy.test_b')::uuid;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Cross-account delete allowed: %',target; END IF;
    BEGIN
      EXECUTE format('UPDATE public.%I SET user_id=$1 WHERE user_id=auth.uid()',target) USING current_setting('foodbuddy.test_b')::uuid;
      RAISE EXCEPTION 'Ownership transfer allowed: %',target;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    insert_sql := CASE target
      WHEN 'foodbuddy_profiles' THEN 'INSERT INTO public.foodbuddy_profiles(user_id,username) VALUES($1,''Synthetic A'')'
      WHEN 'foodbuddy_settings' THEN 'INSERT INTO public.foodbuddy_settings(user_id) VALUES($1)'
      ELSE 'INSERT INTO public.foodbuddy_allergy_selections(user_id,allergen_key,allergen_name) VALUES($1,''fixture-a'',''Fixture A'')' END;
    BEGIN
      EXECUTE insert_sql USING current_setting('foodbuddy.test_b')::uuid;
      RAISE EXCEPTION 'Cross-account insert allowed: %',target;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    EXECUTE format('UPDATE public.%I SET user_id=user_id WHERE user_id=auth.uid()',target);
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'Own update rejected: %',target; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE user_id=auth.uid()',target);
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'Own delete rejected: %',target; END IF;
    EXECUTE insert_sql USING current_setting('foodbuddy.test_a')::uuid;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'Own insert rejected: %',target; END IF;
  END LOOP;
END;
$test$;
-- A different authenticated account sees only B's rows.
SELECT set_config('request.jwt.claim.sub',current_setting('foodbuddy.test_b'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('foodbuddy.test_b'),'role','authenticated','is_anonymous',false)::text,true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.foodbuddy_profiles WHERE username='Synthetic B')<>1
     OR (SELECT count(*) FROM public.foodbuddy_profiles)<>1 THEN RAISE EXCEPTION 'Account switch leaked profile'; END IF;
  IF (SELECT count(*) FROM public.foodbuddy_allergy_selections WHERE allergen_key='fixture-b')<>1
     OR (SELECT count(*) FROM public.foodbuddy_allergy_selections)<>1 THEN RAISE EXCEPTION 'Account switch leaked allergies'; END IF;
END;
$test$;
-- Supabase anonymous-auth sessions also have role authenticated, but are denied by RLS.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('foodbuddy.test_b'),'role','authenticated','is_anonymous',true)::text,true);
DO $test$
DECLARE target text; visible integer; affected integer;
BEGIN
  FOREACH target IN ARRAY ARRAY['foodbuddy_profiles','foodbuddy_settings','foodbuddy_allergy_selections'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',target) INTO visible;
    IF visible<>0 THEN RAISE EXCEPTION 'Anonymous-auth read allowed: %',target; END IF;
    EXECUTE format('UPDATE public.%I SET user_id=user_id',target);
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Anonymous-auth update allowed: %',target; END IF;
    EXECUTE format('DELETE FROM public.%I',target);
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Anonymous-auth delete allowed: %',target; END IF;
  END LOOP;
  BEGIN
    INSERT INTO public.foodbuddy_settings(user_id) VALUES(current_setting('foodbuddy.test_b')::uuid);
    RAISE EXCEPTION 'Anonymous-auth insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$test$;
RESET ROLE;
SET LOCAL ROLE anon;
-- The unauthenticated database role has no DML grants on any private table.
DO $test$
DECLARE target text; command text;
BEGIN
  FOREACH target IN ARRAY ARRAY['foodbuddy_profiles','foodbuddy_settings','foodbuddy_allergy_selections'] LOOP
    FOREACH command IN ARRAY ARRAY[
      format('SELECT count(*) FROM public.%I',target),
      format('INSERT INTO public.%I(user_id) VALUES(NULL)',target),
      format('UPDATE public.%I SET user_id=user_id',target),
      format('DELETE FROM public.%I',target)
    ] LOOP
      BEGIN
        EXECUTE command;
        RAISE EXCEPTION 'anon command allowed: %',command;
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END LOOP;
  END LOOP;
END;
$test$;
RESET ROLE;
ROLLBACK;
