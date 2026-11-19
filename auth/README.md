# Supabase authentication migration

Status: implementation is local/uncommitted. Live Auth settings responded and reported
email/password enabled. Email confirmation was initially required; it is now disabled
per the user’s preference (verified through Auth settings). No signup, email send, SQL
migration, or cloud account modification has been performed by this implementation run.
Public REST schema introspection returned HTTP 401, even with client-style headers.
Reaching Auth settings does not prove that the publishable key authorizes every API.
Cloud configuration and RLS still require verification in the project dashboard.

## Setup boundary

1. Keep `.env` ignored; configure `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No service-role key belongs in Expo.
2. In Supabase SQL Editor, run `supabase/inspect.sql`. Review existing tables and
   policies. Do not apply the migration if FoodBuddy tables already exist without
   first reconciling their definitions. The migration intentionally fails/rolls back
   on existing names, rather than overwriting an unknown table or policy.
3. Run `supabase/migrations/202611180001_foodbuddy_accounts.sql`, then
   `supabase/tests/account_isolation.sql`. The latter rolls back its synthetic users
   and records. It is a real Postgres authorization test, not a SQLite/mock substitute.
4. Email confirmation is disabled in Authentication settings so email/password signup
   signs in immediately. Configure the Reset
   Password email template to include `{{ .Token }}`. This app's recovery UI accepts
   the emailed recovery code; it does not yet consume password-recovery deep links.
   Password recovery still needs an accessible email inbox. If email confirmation is
   enabled again later, configure valid confirmation redirects before testing signup.
5. Restart Metro using the existing localhost command after environment changes.

## Identity and isolation

`database/auth.ts` is now the Supabase facade. The old `foodbuddy_user_id` SecureStore
key is neither trusted nor used for Supabase login. Existing SQLite users, passwords,
photos, allergy records, private custom terms, tolerances, and derivatives remain intact.

`cloud_account_links` associates a UUID to a UNIQUE numeric shadow account on each
installation. Shadow email is a synthetic UUID address and the password field is a
non-loginable sentinel, not a Supabase password/hash. No row is linked by email alone.
The same UUID can have different local IDs on different devices. This additive schema
runs after the existing migrations without modifying teammate migration definitions.
All cloud queries explicitly use the session UUID and RLS independently enforces it.
Numeric derivative interfaces and all teammate matcher/data/test files are unchanged.

Each account's view tree is keyed by UUID. Session changes immediately clear the
previous displayed user, invalidate async scopes, and reject old results. Async picture
updates check ownership before writes and before returning to the UI. SecureStore
sessions are project-namespaced, device-only on iOS, chunked without splitting Unicode
characters, and copy-on-write. No tokens fall back to SQLite or AsyncStorage. Web
secure session storage is not implemented (the target is native iOS/Android).

SDK auto-refresh follows AppState. An expired session cannot restore account screens
while offline; reconnect/sign in to refresh. An unexpired cached session can use local
account data. Cloud APIs always authorize JWTs server-side. `scope: 'local'` logout
clears this device's SDK session before revocation, leaving other device sessions alone
(as verified against the installed auth-js implementation). A network revocation error
is reported after local data access has already been cleared. Persistent account caches
remain isolated by UUID for offline use, but are unmounted/inaccessible after logout;
other accounts' caches and legacy data are never deleted. Password change/recovery
may revoke other sessions according to Supabase policy, unlike ordinary local logout.

## Profile synchronization and legacy ownership

Built-in and supported private custom allergy *selections* sync by normalized names,
not installation-specific IDs. Selections sync on opening Settings; navigation boundaries
also attempt allergy sync. The local per-UUID sync baseline retains offline changes
across restarts. Only changes relative to that baseline are pushed; then cloud selections
are pulled. Concurrent changes to the same selection use last committed cloud write.
Concurrent local edits abort the pull's exclusive SQLite transaction for retry.
Missing/unauthorized cloud tables never erase the local profile.

Global SQLite uniqueness of custom allergen names is a legacy constraint. A private
name collision from another account fails the sync transaction rather than reusing
another user's private row or rewriting teammate schema. Derivative terms, tolerances,
and mappings are intentionally NOT synchronized. Photos remain device-local. The cloud
settings table provides an RLS foundation for future ZIP/GPS preference work; no current
location UI or product/store functionality was changed in this authentication step.

Legacy import is explicit in Settings. It requires a confirmed, server-verified
Supabase account with the same email AND verification of that installation's old
password. No old password/hash is sent to Supabase. Only built-in allergy selections
are copied, additively; originals stay intact. Profiles with private custom allergens
are refused without changes and need a separate teammate-reviewed migration. Old photos
and derivative preferences are preserved in the legacy account but not auto-copied.
There is deliberately no automatic claim based solely on an email address.

## Verification

Run `npx tsc --noEmit` and `node --test tests/*.test.cjs`. Node tests cover real isolated
SQLite identity mappings/restarts/foreign keys, independent simulated device storage,
Unicode/chunk failure handling, local logout scope, confirmation-required signup,
configuration validation, and stale-result invalidation. They do NOT prove deployed RLS,
real token refresh, real email delivery, or physical two-device behavior.

After applying SQL and configuring email, use two non-production accounts:

- Sign in as A on device 1 and B on device 2. Set distinct allergy selections and verify
  each device sees only its own profile after navigation/restarts/refresh.
- Sign in as A on both devices; synchronize from Settings and compare selections.
- Log out of device 1; device 2 must stay signed in. Switch device 1 to B while requests
  are pending; no A profile/photo/check result may appear.
- Try offline restart with an unexpired session, offline edits/reconnect/sync, then
  expired-session restart (must require reauthentication), recovery code/password change,
  and invalid/expired recovery codes.
- Execute the SQL authorization test, then verify unauthorized REST reads/writes using
  separate test-user JWTs. Never use service-role credentials for these checks.

No paid services were activated, dependencies upgraded, commits created, or pushes made.
