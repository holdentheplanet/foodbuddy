# Nearby Stores browsing

The current store dataset remains 17 Charleston-area records (16 reviewed
coordinates, one visibly unverified). Stores and source evidence still come from
SQLite. No new store records, inventory assignments or schema migrations were
added. Existing inventory navigation and simulated-stock disclaimers are retained.

On opening Nearby Stores, the existing foreground-only GPS flow requests a fix.
Use My Location refreshes it. Alternatively, a five-digit ZIP uses the bundled
Census reference described in `zip/README.md`. The UI states whether the selected
origin is device GPS or an approximate ZIP area. GPS failure/denial never creates
a location. Pending GPS results are invalidated when ZIP or manual mode is chosen.
No location/ZIP selection is persisted to account data.

Nearby mode defaults to a 25-mile straight-line radius. Radius options are 5, 10,
25, 50 and 100 miles. Local Haversine calculations sort before filtering/pagination;
unknown coordinates cannot qualify as nearby. Name/address/chain/ZIP searches are
partial and case-insensitive; chain and radius filters combine. Load More reveals
10 additional rows, with the last page shorter. Filter/origin changes reset the
page and clear stale store selection. Map store pins equal the currently loaded
list rows with coordinates; a separate blue marker identifies a ZIP origin.
Loading more rows adds their pins. Missing store coordinates never become pins.

There is no implicit Charleston/San Francisco map viewport. The native Apple Maps
view mounts only with a selected origin, or explicit Browse All Saved Stores.
Without an origin that explicit directory action fits saved coordinate bounds,
shows A–Z rows and unavailable distances. With an origin it retains distance
ordering, visibly pauses the radius filter and warns that stores can be far away.
Nearby Only returns to the existing radius. Empty states distinguish missing
location, no coverage within the radius, and no search/filter matches. Users
outside coverage are not told there are no actual grocery stores near them.

Apple Maps may use internet for tiles. ZIP lookup, addresses, filters and distances
need no runtime network service. List Only remains available. No API keys or
additional dependencies were added. Existing Android map provider configuration
has not been changed or tested for standalone deployment.

For future coverage, download a regional OpenStreetMap extract from
https://download.geofabrik.de/, extract grocery points during development, review
identity/address/coordinates and deduplicate by stable source IDs and addresses.
Retain source dates and ODbL attribution/requirements before importing a reviewed
manifest through the existing importer. Raw datasets are candidates, not proof
that each shop remains open or its coordinates are reviewed. No runtime discovery
or new store import was implemented in this step.

## Checks

TypeScript and all 171 automated tests passed, including 10 new browsing/ZIP tests
and existing GPS permission/error/timeout tests. Expo lint was attempted but ESLint
is not configured; installation was declined to preserve dependencies.

Actual iPhone 17 Pro simulator checks used rendered UI handlers through localhost
Metro, native map camera readings and screenshots. A simulated GPS fix at
32.78045,-79.933401 yielded Target King Street at 0 miles, Harris Teeter at about
0.4 miles and Publix Westedge at about 1.4 miles. ZIP 29401 gave the documented
approximate point, ordered rows and 10-to-17 pagination. Target filtering returned
five stores; a 5-mile radius returned seven stores. Searching a nonexistent name
showed the no-match state. ZIP 10001 returned no nearby rows or store pins, while
explicit all-stores mode displayed distances over 630 miles. Unsupported ZIP 00000
showed an error. Store pins and loaded rows matched throughout these checks.

A rendered pin handler opened the selected store and demo inventory, with the
simulated disclaimer. Returning preserved selection; native camera reads matched
the store coordinates and then the ZIP origin after recentering. Foreground
permission was temporarily revoked: no origin/map/nearby rows were fabricated;
explicit manual browsing had A–Z rows with null distances. Permission was restored.
All 19 simulator SQLite table checksums were unchanged, including 219 products
and 17 stores. Protected application files remained unchanged against the task's
initial file snapshot. No diagnostic code was added to the application.

These checks do not substitute for physical-device GPS or finger/keyboard
hit-testing. Airplane-mode and additional iPhone sizes were not tested. The
simulator uses a deliberately configured test location; it is not a real GPS fix.
