# Reviewed FoodBuddy account migration

Ready for manual deployment based on the user's confirmed inspection: SQL Editor role
`postgres`, public schema present, no public tables/views or policies, and existing
`auth.users` / `auth.uid()`. No cloud migration was executed during review.

1. Open the FoodBuddy project in Supabase Dashboard, then SQL Editor → New query.
2. Confirm the selected database role is **postgres**, not anon or authenticated.
3. Open `supabase/migrations/202611180001_foodbuddy_accounts.sql` in the repository.
   Copy the ENTIRE file, including BEGIN, both DO blocks, and COMMIT, into the query.
4. Run it once. Do not run just a selected fragment. The file deliberately stops if
   any table name already exists, Auth prerequisites are missing, API roles can bypass
   RLS or create public objects, or effective table grants are too broad. On error,
   do not remove the failing checks or drop existing objects: capture the error and
   review it. If the SQL session remains in an aborted transaction, run ROLLBACK in
   that session before retrying the corrected whole migration.
5. After success, run `supabase/verify_deployment.sql` in a separate query. Expect
   exactly three rows owned by postgres, RLS enabled/forced, PUBLIC privileges [],
   anon access false, authenticated SELECT/INSERT/UPDATE/DELETE true and TRUNCATE false.
   Each table must have one owner_only policy for authenticated, command ALL, with
   UUID equality plus the anonymous-auth exclusion in both USING and WITH CHECK.
6. Run `supabase/tests/account_isolation.sql` as postgres in a separate query. This is
   a TEST, not a migration: it inserts synthetic auth users/rows inside a transaction
   and rolls them all back. Run the entire file through ROLLBACK. If any assertion
   errors, ensure the transaction is rolled back and report the error. This verifies
   authenticated-role CRUD, cross-user denial, ownership-transfer denial, account
   switching, and anonymous access restrictions. It has not yet been run against the
   user's Supabase database. Do not mistake SQL Editor admin reads for RLS tests.
7. Email confirmation is now disabled by user preference. Follow `auth/README.md` for recovery-email template
   setup and physical two-device Auth/sync tests. REST's earlier HTTP 401 remains a
   separate configuration issue until successful authenticated API calls are tested.

## Security scope

The migration creates only public.foodbuddy_profiles, public.foodbuddy_settings, and
public.foodbuddy_allergy_selections. It does not alter auth.users, Auth grants, Auth
policies, auth.uid(), auth.jwt(), triggers, login providers, or passwords. Foreign keys
reference auth.users(id); deleting an Auth user removes ONLY that user's corresponding
FoodBuddy cloud rows. SQLite data and teammate derivative files are unaffected.

Tables are owned by postgres (enforced before COMMIT), never by API roles. PostgreSQL
PUBLIC is the implicit all-roles group: its table grants are explicitly revoked, along
with direct anon/authenticated grants inherited from deployment defaults. Only DML is
re-granted to authenticated; no grant option, TRUNCATE, REFERENCES, or TRIGGER access
is granted. Unexpected effective privileges inherited from another group cause rollback
instead of changing that group's global permissions. Schema USAGE is granted to
authenticated only; it allows name lookup, not table access or object creation.

All three tables enable AND force RLS. For normal authenticated users, FOR ALL maps:
SELECT to USING, INSERT to WITH CHECK, UPDATE to both USING and WITH CHECK, and DELETE
to USING. A user's signed JWT UUID must equal user_id. Changing user_id to another
account is rejected by WITH CHECK. Supabase anonymous-auth JWTs (which also use the
authenticated role) are explicitly denied. Unauthenticated anon has no table grants.

Superusers and BYPASSRLS roles (including trusted Supabase service-role access) can
bypass RLS even when FORCE is set. They must never be shipped to the mobile app. This
migration intentionally does not revoke trusted platform administrative permissions.

Review confidence: source/static checks plus application test suite, NOT deployed
Postgres execution. Deployment verification above is required before live account tests.
