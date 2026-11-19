-- Read-only metadata inspection. Always returns ONE row, even with no public tables.
-- Run the entire statement in the intended project's Supabase SQL Editor.
WITH relations AS (
  SELECT c.relname AS name,
         CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned table'
              WHEN 'f' THEN 'foreign table' WHEN 'v' THEN 'view'
              WHEN 'm' THEN 'materialized view' END AS kind,
         pg_get_userbyid(c.relowner) AS owner,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','f','v','m')
), policies AS (
  SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
  FROM pg_policies WHERE schemaname='public'
)
SELECT current_database() AS database_name,
       current_user AS executing_role,
       to_regnamespace('public') IS NOT NULL AS public_schema_exists,
       to_regclass('auth.users') IS NOT NULL AS auth_users_exists,
       to_regprocedure('auth.uid()') IS NOT NULL AS auth_uid_exists,
       (SELECT count(*) FROM relations WHERE kind IN ('table','partitioned table','foreign table')) AS public_table_count,
       COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.name) FROM relations r),'[]'::jsonb) AS public_relations,
       (SELECT count(*) FROM policies) AS public_policy_count,
       COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname) FROM policies p),'[]'::jsonb) AS public_rls_policies;
