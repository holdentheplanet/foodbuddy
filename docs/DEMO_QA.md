# FoodBuddy demonstration QA — November 18, 2026

Scope: 219 products, 200 ingredient lists eligible toward the verification goal,
167 stores, 671 demo inventory rows. No data expansion, schema migration,
matching-rule change, commit or push was performed. All teammate-owned derivative
and tolerance code/data/tests were preserved.

## Fixed

- **Late sync discarded profile drafts.** App keyed the allergy screen to every
  completed cloud sync, remounting the editor. Opening the profile now waits at
  most three seconds, then permits local use with an honest pending/offline notice.
  Late completion never remounts an open editor. Same-tab taps do not restart it.
  Auth token refresh does not restart the profile's navigation sync gate.
- **Selections could reappear after a concurrent removal.** The cloud sync baseline
  previously advanced only after a successful pull/apply. If a pushed selection
  was removed locally during that network request, a retry could pull it back.
  Acknowledged push intent is now persisted before pulling, so the next retry
  sends the later removal. Account-scope and transaction guards remain enforced.
- **Retained inventory details used stale allergy checks.** Returning to Stores
  after another tab now reloads selected product details and invokes the existing
  checker again. Hidden/inactive inventory details do not keep checking in the
  background. Store selection/map state is preserved; matching rules are unchanged.
- **Accessibility/usability:** explicit labels for login/signup/password/recovery/
  profile-photo/logout controls, 44-point photo/auth-switch targets, higher-contrast
  search/auth placeholders, and one-line fitting tab labels to prevent large-text
  clipping. Product/category counts use singular labels when appropriate. Home
  no longer implies every saved store has demo inventory.

## Checks performed

| Area | Result and evidence |
|---|---|
| Home, Shop, Stores, Allergies, Settings | All five tabs opened in the iPhone 17 Pro iOS simulator through rendered UI handlers. |
| Existing Supabase session | Live server getUser validated the current session; account scope matched. No credentials or tokens were printed. |
| Session persistence | Expo Go was terminated and reopened without clearing data; the same account restored and was server-validated again. |
| Existing cloud selections | Read-only local/cloud selection comparison matched. This does not prove a new edit transfers across devices. |
| Product flow | Oreo, Goldfish and Cheerios searches/details showed ingredients, separate evidence panels, existing allergy-check results and physical-packaging reminders. All ten category controls and Breakfast browsing worked. |
| Empty/error/loading states | No-match product search, out-of-coverage stores, unsupported ZIP, injected SQLite-service read failure/retry and deferred product loading all displayed their respective states. |
| Sync/editor lifecycle | A delayed injected sync completed after an unsaved allergy-search draft was entered; the draft survived. No allergy was added to the live account. |
| Inventory lifecycle | Temporarily counted product-detail reads without changing results; a retained detail was re-read on tab return. Temporary diagnostics were restored/removed. |
| GPS and stores | Simulator fix 32.78045,-79.933401 sorted Target King Street first. Address/chain/radius filters, 10-to-25 pagination and pin/list agreement passed. |
| Permission denied | No fabricated origin/map/nearby rows; ZIP browsing still worked. Foreground permission was restored afterward. |
| Inventory separation | Dataset-sourced stores had no inventory action and displayed No inventory data available. Charleston retained its demo labels/action. |
| Offline data flows | Product and ZIP/store browsing worked with app-level external fetch calls rejected. Native networking and Apple Maps tiles were not disconnected. |
| Large text | Temporary accessibility-large text produced single-column product cards; cards and the fitted five-tab bar were visually inspected. Original large setting was restored. |
| Contrast | Automated checks verify main palette text/action/warning pairs meet 4.5:1. This is not a complete screen-reader audit. |
| Preservation | Read-only SQLite checksums and file snapshots were used to verify existing data and protected files. No accounts or real allergy selections were created, edited or deleted for QA. |

Simulator automation exercised rendered React controls and native SQLite, not
physical finger/keyboard hit-testing or VoiceOver speech. The app was accessed
only through the existing localhost Metro server. Actual production binary and
physical-device behavior are not inferred from these checks.

## Tooling

- Expo SDK 57.0.31, React Native 0.86.3 and existing application dependencies retained.
- Added only Expo-recommended development tools: ESLint ^9.0.0 and
  eslint-config-expo ~57.0.2. Expo CLI resolved the versions; the lockfile was updated
  by npm, not replaced. Scripts: npm run typecheck, npm run lint, npm test.
- TypeScript passed; all 188 automated tests passed, including seven cloud-sync/
  navigation regression tests and one contrast test. Tests use isolated databases
  and mocked cloud clients, never the simulator's user records.
- Full-tree npm run lint passed with **0 errors and 15 advisory warnings**. Expo's
  flat configuration is used; Node globals are configured for backend/dev/test
  scripts. Async state-loading effect advice is warning-level only in the listed
  existing components, and punctuation warnings in protected teammate files are
  retained as advice. Hooks correctness and other recommended errors remain active.
  The ignored foodbuddy-temp directory is excluded and was not touched.
- npm ls --all reported no dependency-consistency problems. Git whitespace checks passed.
- npm audit reported **10 findings: 7 moderate, 3 high**, involving Expo tooling /
  transitive packages (including @expo/cli, node-forge and zod). No automatic audit
  fix was applied: suggestions included an inappropriate Expo SDK downgrade.
  These findings require a separate compatible-dependency review; this report does
  not establish exploitability in the app. SDK 57's recommended ESLint 9 release
  also emitted an end-of-support notice during installation; a future coordinated
  tooling update should use Expo's compatible recommendations.

## Still needs manual testing

1. With two disposable accounts and user-controlled passwords: live signup,
   password login, logout, failed credentials, and account switching. The existing
   signed-in account was deliberately not logged out when no restore credentials
   were available. Automated auth validation/isolation tests passed; they do not
   replace these live credential-flow tests.
2. Create, edit, save and remove an allergy on a disposable account. Sign in on a
   second device, confirm additions/removals synchronize both ways, then test
   conflicting/offline edits. Existing live selections were left unchanged.
3. Physical-device GPS, VoiceOver, small iPhone screens, real keyboard/touch targets,
   photo-picker selection/cancel and password-change/recovery email flows.
4. True airplane mode, restart/token-expiry while offline and production builds.
   New login, token refresh and cloud sync require internet. Local product/store
   searches need no grocery API; Apple Maps tiles may use internet normally.
5. Teammate review of existing accessibility debt: #777 allergy placeholders have
   about 4.48:1 contrast on white, slightly below 4.5:1; some allergy controls have
   no explicit 44-point minimum. Those protected files were not edited. The JSX
   punctuation/performance lint warnings are also left visible for the owner.

Suggested school demo: sign in online, show categories and an ingredient/allergen
label, compare a saved allergy using a disposable demo account, search ZIP 10001,
contrast its no-inventory store with Charleston ZIP 29401 demo inventory, then
show session persistence. Keep a real device/two-account sync check as a rehearsal
before presenting; do not describe simulated inventory as actual stock.
