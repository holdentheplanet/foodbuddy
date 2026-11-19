# Six-metro OSM directory expansion

150 new dataset-sourced grocery locations are bundled in `data/osm-us-metros.json`:
25 each for New York City, Atlanta, Chicago, Dallas–Fort Worth, Denver and Los
Angeles. The existing Charleston catalog is unchanged. Total: 167 stores, 219
products, and the original 671 simulated inventory records at 17 stores. No new
inventory assignments were created. DFW coverage is a Dallas-centered sample,
not a claim to cover all Fort Worth or every postal ZIP in that metro.

## Evidence and selection

Development downloaded New York/Georgia PBF extracts from Geofabrik and city PBF
extracts from BBBike for Chicago/Dallas/Denver/Los Angeles. Geofabrik snapshot date:
2026-11-17T21:24:30Z. BBBike snapshot date: 2026-11-14T00:00:00Z. Read the exact
per-region values and file SHA-256 hashes in `data/osm-us-metros-review.json`.
The raw files remain development artifacts outside the app. No API is called by
the extractor, review gate, importer or runtime store browsing. An attempted
one-time Overpass export was unavailable and contributed no records.

Extraction requires shop=supermarket, a name, house number, street, city, state,
postal ZIP and valid coordinates. It excludes incomplete required tags and
explicit disused/abandoned/construction tags. No missing address or chain is
inferred: missing brand is displayed as Unknown chain. Original address/name/
brand tags remain unchanged. Source OSM element type/ID, source URL, snapshot
URL/date/hash, coordinate method and original tags are retained per record.

Nodes use their actual mapped coordinates. Closed ways use a reproducible
bounding-box center calculated from source node geometry, visibly described as
an approximate mapped-feature reference point, not a surveyed entrance. Relations
and incomplete geometry are excluded. Records are explicitly unverified and show
OSM dataset-sourced — not independently verified. The checkedAt date records
processing/evidence review, never a physical visit or verified operating status.

Candidates were ranked by distance from offline ZIP reference points 10001, 30303,
60601, 75201, 80202 and 90012, restricted to their documented metro bounding boxes
and within 25 straight-line miles. Complete eligible candidate counts were 526,
235, 477, 161, 178 and 416 respectively. The first 25 conflict-free candidates
per metro were accepted. No selected candidate needed an ambiguous-location merge.
Extra candidates were not imported. Missing-required-tag counters in the review
report apply to each whole downloaded extract, not solely its demonstration metro.
These checks establish documented dataset provenance, not independent accuracy.

## Reproduction and safe importing

1. Download the exact PBF source snapshots referenced by the review report.
   Latest URLs move; compare SHA-256 and source-header timestamp. A changed snapshot
   requires a new review and may yield different candidates.
2. In a separate development virtual environment install osmium==4.3.2. This is
   not a project/mobile dependency. Place files in a temporary directory as
   NewYork.osm.pbf, Atlanta.osm.pbf, Chicago.osm.pbf, Dallas.osm.pbf, Denver.osm.pbf
   and LosAngeles.osm.pbf. Finish downloads before extraction.
3. Run `python scripts/extract-osm-stores.py INPUT_DIRECTORY candidates.json`.
   The parser caches geometry before its C++ tag filter and makes no network calls.
4. Run `node scripts/review-osm-stores.cjs candidates.json`. Review the output and
   diffs before shipping; it does not write a database. Source timestamps and file
   hashes are recorded. Keep the stable catalog ID osm-us-metros for future updates.
5. Existing initialization imports the unchanged Charleston manifest first, then
   the approved expansion using the same SQLite connection. No schema migration,
   REPLACE, deletion, user-data write, or automatic inventory generation is involved.

The importer checks all existing catalogs and accepted records in its transaction.
Matching OSM type/ID or normalized address is skipped; proximity below 25 meters,
or below 150 meters with matching name/known chain, requires review. Nearby
conflicts are never merged automatically. Catalog ownership, downgrade, source
loss and older-review protections remain in place. Repeat imports perform no
writes. Conflicts are reported with incoming/existing IDs and reason.

Store queries calculate inventory presence with EXISTS. Stores without records
show No inventory data available and have no inventory navigation action. Existing
stores retain their demo labels/actions. Coverage text is derived from loaded
stores and states; no Charleston-only coverage claim remains. Chain filters group
capitalization variants for usability without rewriting source brand tags.
Search, distances, ZIP lookup, filters, 10-row pagination and pins remain local.
Apple Maps may fetch tiles normally. See the adjacent data LICENSE notice for
ODbL attribution/share-alike and the redistributable machine-readable directory.

## Validation (November 18, 2026)

TypeScript passed; all 180 automated tests passed, including 9 expansion tests.
Checks cover source identity, normalized-address and proximity conflicts,
repeat imports with no writes, preservation of all 219 products and legacy user
records, unchanged Charleston source snapshots/671 inventory rows, absent
inventory for new stores, and ZIP/radius/sorting/pagination for all six metros.
Existing GPS, catalog, authentication and matching tests remain unchanged.
Git whitespace checks passed. Expo lint was attempted; ESLint is unconfigured,
and installation was declined to leave project dependencies unchanged.

The actual iPhone 17 Pro Expo Go simulator was checked using rendered UI handlers
through localhost Metro and native Expo SQLite. ZIPs 10001, 30303, 60601, 75201,
80202 and 90012 each returned 25 records from the correct metro, ordered by distance.
Each started with 10 rows and matching pins, then loaded 20 and 25. Dataset-sourced
labels rendered; new store selection showed No inventory data available and no
inventory action. Its source panel displayed the dataset timestamp. Selecting a
Charleston store retained its simulated-inventory disclaimer and navigation action.
Native repeated imports twice returned 167 unchanged rows with no writes, no
conflicts and zero foreign-key violations. Legacy-only checksums across all 19
original SQLite tables remained unchanged when the 150 new store/source/history
rows were excluded. Account data was never exported or changed by these checks.

These UI-handler checks do not test physical finger/keyboard hit targets. Physical
device GPS, airplane-mode behavior, Android deployment and additional screen sizes
were not retested for this expansion. OSM records are not a guarantee a business
is still open, and mapped-feature centers are not surveyed entrances. Store search
and ZIP lookup use bundled data; Apple Maps tiles may use internet normally.
