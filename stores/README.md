# Local Charleston grocery stores

`data/charleston-01.json` is a bundled store-location catalog, reviewed on
2026-11-11. It contains 17 real locations: 5 Target, 6 Publix, 4 Food Lion,
1 Walmart and 1 Harris Teeter. It makes no inventory or opening-hours claims.
There is no geocoding, grocery API, routing service or backend at runtime.

## Evidence

Each record retains its stable chain/store ID, address, published coordinates,
verification status, review date, sources, metadata transcription and notes.
Coordinates describe directory/map points, not surveyed entrances or parking
access. No coordinates were estimated from an address.

- Target: `geo` / `geographic_specifications` and `mailing_address` in official
  store-page metadata. Individual store URLs are retained in each record.
- Publix: official store-page embedded JSON, including its nearby store records.
  Point Hope Commons and Queensborough pages jointly supplied six unique stores.
  Records cite the page where their own metadata was reviewed, rather than
  inventing a store-specific URL that was not visited.
- Food Lion: official individual pages' `GeoCoordinates` latitude/longitude
  metadata and address fields. The original address spacing is retained in data;
  the screen normalizes whitespace for display.
- Walmart #1748: official identity/address cross-checked with Mapcarta's
  OpenStreetMap feature `way/550973119`. Coordinate attribution is retained in
  the JSON and displayed in the screen. Coordinate data © OpenStreetMap
  contributors, available under ODbL 1.0; see
  https://www.openstreetmap.org/way/550973119 and
  https://www.openstreetmap.org/copyright . This is store-point data, not an
  OpenStreetMap tile integration. No tiles or photos were copied into the app.
- Harris Teeter East Bay Trading Station: official address confirmed at
  https://www.harristeeter.com/stores/grocery/sc/charleston/east-bay-trading-station/097/00277 .
  The business directory https://www.whereorg.com/harris-teeter-32231050 publishes
  its coordinates. Those coordinates remain **unverified** and visibly flagged;
  independent/official coordinate review is still needed. It is not counted among
  the 16 reviewed coordinate records.

`verified` means published coordinate metadata was reviewed against a store's
official identity, not that someone physically visited the store. These locations
can change. Sources are text references and do not cause network requests.

## Schema, imports and updates

The existing `stores` table is retained. Additive migration 5 creates
`store_catalog_entries` and `store_catalog_revisions` for ownership, review dates,
current source snapshots and accepted revision history. Migrations 1–4 remain
unchanged. Normal `initializeDatabase()` imports products and then stores on the
same existing `foodbuddy.db` connection. No second database is opened.

`validateStoreCatalog` checks IDs, US addresses, date validity, coordinate bounds,
paired null coordinates, reviewed source hosts, source evidence, duplicate IDs
and duplicate addresses in a batch. Validation is a consistency check on reviewed
evidence, not an automated assertion that a web page is accurate.

`importStoreCatalog` validates before writes, serializes imports on a connection,
and uses one SQLite transaction with bound values. Repeats do no writes; accepted
updates retain history. Existing manual stores and records owned by another
catalog are not overwritten. Older or weaker records and records losing known
coordinates/sources are skipped. Keep stable IDs when reviewing a location; a
new manifest must be registered explicitly in `index.ts`. Future batch authors
should check chain/store IDs across manifests to avoid representing the same
physical store under a different identity. Removing a seed does not delete data.

Import SQL writes only `stores` and store evidence tables. It never updates users,
passwords, sessions, profile pictures, allergy data, products or inventory, and
never uses `REPLACE` to overwrite a store.

## GPS, map and offline fallback

`localStoreService` reads locations asynchronously; `storeDistance` computes
great-circle Haversine distances in miles and sorts nearest first. Invalid or
absent origins/coordinates yield null distances, not zero or a fabricated location.
Without a location fix, stores sort alphabetically and remain selectable. Distances
are approximate straight-line distances, not driving routes or travel times.

`deviceLocation` uses SDK 57 `expo-location` for foreground permission and one
balanced-accuracy fix when Nearby Stores opens or the user retries. No background
permission, task or location persistence is added. A GPS fix has a 12-second
timeout; late results, unmounts and manual-mode switches cannot replace newer UI
state. An unresolved OS permission prompt can still wait for the user; manual
browsing is immediately available. Permission denial and disabled/unavailable
location services preserve the list. Accuracy and fix time are displayed. On iOS,
simulated fixes are not reliably identified by the SDK's Android `mocked` flag.

`NearbyStoresScreen` uses SDK-compatible `react-native-maps` 1.27.2. It uses native
Apple Maps on iOS and Google Maps on Android. Markers are local store coordinates;
list selection centers the native camera on the selected marker, and marker
selection opens the same address/distance/source panel. Re-selecting a store
recenters after the user pans away. The existing app tab/state navigation is
preserved; no Expo Router migration is involved.

Apple/Google tiles are **not bundled** or guaranteed offline. The native map does
not expose a reliable cross-platform tile-connectivity failure event. The screen
always explains the limitation, offers **List only** to unmount the native map,
and retains the scrollable address/distance list even while map loading stalls.
A delayed map-ready callback also produces a fallback hint. This is a useful
offline list fallback, not a fully offline map background. Bundling a complete
street map would require a different tile/offline-region implementation and
licensed data, beyond the two necessary dependencies used here.

Expo Go includes these modules for SDK 57. The config plugin sets only the iOS
foreground location description and Android coarse/fine permissions; background
permissions/services and motion permission are disabled. Native config inspection
confirmed the foreground-only iOS description. A standalone Android build still
requires the Google Maps setup/API key described in the Expo map-view docs;
Android deployment and device tests were not performed in this step.

## Validation performed

Run `node --experimental-sqlite --test tests/*.test.cjs` and
`npx --no-install tsc --noEmit`. Tests use isolated SQLite databases and injected
location adapters, never reset the simulator database, and cover imports,
duplicates, rollback, history/downgrade protection, source requirements, foreign
keys, user/product preservation, distance edge cases, sorting, permissions and
GPS failures/timeouts. Existing catalog/allergy tests remain in the full suite.

Native iOS simulator checks used the running UI handlers through Metro's localhost
debugger plus native camera reads and screenshots. All 17 pins and store records
rendered. A simulated fix at 32.78045,-79.933401 yielded Target King Street at
0.0 mi, Harris Teeter at about 0.4 mi (unverified coordinates), and Publix Westedge
at about 1.4 mi. List selection centered the native camera on Target Charleston
South at 32.79943,-80.0306. The rendered Harris Teeter marker's handler selected
its detail panel and moved the camera to its coordinates. This does not substitute
for a physical-device tap/hit-testing check.

Foreground denial was tested using the simulator's `privacy revoke location`
command: distances became null, sorting alphabetical, and user-location display
was disabled. Foreground permission was restored after the check. App-level
fetch/XHR were temporarily blocked in memory: reopening the screen still loaded
17 stores from native SQLite, and list-only mode retained distances and selectable
details with the map unmounted. These temporary test hooks were restored/removed.
**This did not disconnect the simulator's native networking.** Apple Maps tiles
may have used network or cache. The map background is not claimed to work offline. Step 10 clarifies that
Apple Maps may use internet normally; offline map tiles and full native network-
disconnection testing are not required for the architecture.

Existing Oreo search/detail/allergy results, saved-allergy navigation and settings
were also exercised without editing user data. Login/signup code was unchanged;
signup/account creation was not retested. ESLint remains unconfigured in this
project, so `expo lint` cannot run without separate setup.


Step 10 adds a selected-store **View demo inventory** action. Inventory browsing
reuses the local product screen and checker, hides the map while retaining its
mounted state, and returns to the selected store. Store location evidence stays
separate from the simulated inventory seed. See `../inventory/README.md`.
