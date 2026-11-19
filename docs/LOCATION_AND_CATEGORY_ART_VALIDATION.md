# Location and category artwork — November 19, 2026

## Actual cause

Read-only inspection of the existing iPhone 17 simulator found the signed-in account's
per-account store-location preference was `{"version":1,"zip":"10001"}`. The native
Apple Maps camera and initial region both centered on the bundled ZIP reference at
40.750649, -73.997298. User-location display was off. No other persisted location
key was found in AsyncStorage. This installation was restoring the saved ZIP, not
using automatic GPS, IP geolocation, a conflicting Home origin, or a hidden NYC fallback.
Home does not own a separate store location; Stores and its nested inventory share
the existing screen state. Store coordinates and ZIP reference data were unchanged.

The v1 writer only ran on ZIP selection, but stored no explicit provenance or event
history. It cannot prove a human chose that ZIP rather than a prior UI test. It is
therefore not safe to silently reinterpret it as automatic GPS or replace it. Legacy
v1 ZIP selections are preserved and a notice offers confirmation/Charleston selection.
Other unknown formats remain byte-for-byte preserved and require confirmation;
records explicitly marked gps/automatic/cached_gps no longer establish a default.
No preference is deleted or rewritten during reads.

## Implementation

- Shared `CHARLESTON_DEFAULT`: 29401 at 32.77718, -79.932. Both default and an explicit
  29401 selection resolve to that same origin.
- Manual saves retain the existing per-account key and record version 2 plus
  `source: manual_zip`. GPS, map panning and camera events have no persistence writes.
- A visible location-picker action selects Charleston explicitly. This is the way
  to change the current account from its preserved 10001 selection; the application
  does not silently overwrite it.
- A controlled map region and an origin-specific map instance eliminate reliance
  solely on initialRegion/late animation. User pans update the viewport; a changed
  origin initializes the camera anew. Distances/results use the same selected origin.
- GPS remains an explicit foreground action. Failures resolve to saved manual ZIP,
  or Charleston if none; successes remain session-only.

## Native simulator results

A single diagnostic backed up the raw preference, exercised UI actions and app
termination/reopening, and restored the exact original bytes in finally. No accounts,
allergy selections, SQLite tables or user data were cleared or replaced.

- Existing 10001 selection respected before testing.
- Charleston selected using the actual UI: native getCamera center was
  32.777180000000016, -79.93199999999993 (floating-point rounding of the requested point).
- Ten visible pins agreed with ten list rows; switching modes retained the origin.
- Version 2 manual 29401 survived app termination/reopening; native camera remained
  Charleston. This tests an existing installation, not a wiped/new account.
- Explicit Use My Location succeeded with the simulator's San Francisco fix
  (37.785834, -122.406417); saved 29401 remained unchanged. The saved ZIP returned
  after restart. GPS is simulator-provided, not a claim about the user's physical GPS.
- A temporary fixture explicitly marked automatic GPS with NYC coordinates/ZIP
  was ignored after restart: Charleston default and native camera/pins/list agreed.
- Original v1 10001 record restored exactly afterward. Screenshots of Charleston
  were taken during the diagnostic, not by changing the label independently.
- Fresh/no-preference and denied/disabled/unavailable GPS cases are covered by
  isolated automated tests. Native GPS failure was not induced by changing OS permissions.
  Native Charleston rows were all in SC and sorted nearest first (closest: 0.24 miles). Existing store browsing/distance tests also verify sorting, filters and pagination.

## Category artwork and preservation

Ten original imagegen illustrations are bundled in `assets/categories/`; prompt set
and creation metadata accompany them. Approved photo assets, registry and credits
remain unchanged. The new fallback covers missing and failed photos across Home,
Shop, search, inventory and Details through the shared ProductPhoto component.
No branded packaging or fake product-specific images were generated. Every product
fallback has a category-illustration caption and explicit accessibility description.

Native read-only SQLite counts confirmed 219 products, 167 stores, 671 inventory records and all ten artwork category IDs.

Native UI checks passed: Home artwork, approved Barilla photo, simulated photo-error
fallback, photo restoration after component remount, Shop filters showing Snacks,
Dairy, Breakfast and Produce artwork, Details artwork/full ingredients, and personalized
allergy indicators. The image-error test changed component memory only.

Screenshots:
- `/tmp/foodbuddy-stores-charleston.png`
- `/tmp/foodbuddy-art-home.png`
- `/tmp/foodbuddy-art-shop.png`
- `/tmp/foodbuddy-art-snacks-candy.png`
- `/tmp/foodbuddy-art-dairy-eggs.png`
- `/tmp/foodbuddy-art-breakfast.png`
- `/tmp/foodbuddy-art-produce.png`
- `/tmp/foodbuddy-art-details.png`

TypeScript passed. All 219 automated tests passed. ESLint: zero errors, 14 existing
warnings. Approved-photo manifest/registry/audit checksums passed. Matching/tolerance,
authentication, catalog records, store records and inventory assignments were not
edited. No new dependencies, runtime APIs, commits or pushes.
