-- Read-only post-deployment checks. Expected: 3 rows; owner postgres; both RLS flags true.
-- PUBLIC privileges [], anon permissions all false, authenticated DML true and truncate false.
SELECT c.relname AS table_name,pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,
       COALESCE((SELECT jsonb_agg(a.privilege_type ORDER BY a.privilege_type)
                 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
                 WHERE a.grantee=0),'[]'::jsonb) AS public_privileges,
       jsonb_build_object(
         'select',has_table_privilege('anon',c.oid,'SELECT'),
         'insert',has_table_privilege('anon',c.oid,'INSERT'),
         'update',has_table_privilege('anon',c.oid,'UPDATE'),
         'delete',has_table_privilege('anon',c.oid,'DELETE'),
         'truncate',has_table_privilege('anon',c.oid,'TRUNCATE')) AS anon_access,
       jsonb_build_object(
         'select',has_table_privilege('authenticated',c.oid,'SELECT'),
         'insert',has_table_privilege('authenticated',c.oid,'INSERT'),
         'update',has_table_privilege('authenticated',c.oid,'UPDATE'),
         'delete',has_table_privilege('authenticated',c.oid,'DELETE'),
         'truncate',has_table_privilege('authenticated',c.oid,'TRUNCATE')) AS authenticated_access,
       (SELECT jsonb_agg(jsonb_build_object('name',p.policyname,'command',p.cmd,'roles',p.roles,
                                          'using',p.qual,'with_check',p.with_check) ORDER BY p.policyname)
        FROM pg_policies p WHERE p.schemaname=n.nspname AND p.tablename=c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
  ('foodbuddy_profiles','foodbuddy_settings','foodbuddy_allergy_selections')
ORDER BY c.relname;
