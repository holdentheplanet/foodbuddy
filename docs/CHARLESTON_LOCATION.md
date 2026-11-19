# Charleston default and saved manual locations

Previously Nearby Stores called `getForegroundLocation()` on mount. It used whichever
fix iOS supplied, including simulator location simulation. No hardcoded San Francisco
origin or IP geolocation was found in the active store flow. The user's San Francisco
symptom is consistent with that automatic fix; the device's historical fix was not
independently recovered during this change.

The screen now restores a per-account manual ZIP or uses Charleston, SC 29401, with
coordinates 32.77718, -79.932 from the existing bundled Census reference. The default
is explicitly labeled approximate/default rather than the user's actual location.
Both store filtering/distances and the map use this same origin. Location restoration
finishes before showing the map, preventing a default-city flash over a saved ZIP.

Only pressing Use My Location requests foreground GPS. Denial, unavailable services,
or failure returns to the saved manual ZIP, otherwise Charleston. A successful GPS
fix does not erase a manual preference. Manual ZIPs persist per local account using
existing AsyncStorage, separate from authentication and SQLite. GPS positions are not
persisted. Existing code previously kept selected ZIPs only in screen state; it did
not implement a persisted manual ZIP. No existing persisted manual preference is
rewritten by startup or failure. Unsupported/corrupt preference bytes are preserved;
read/write failures are explained without erasing data.

Verification: the iPhone simulator rendered the Charleston default, map origin
32.77718/-79.932, GPS display off, and ten loaded SC stores with exactly the same IDs
as map pins. Automated tests use isolated storage to cover account separation,
restart persistence, invalid/corrupt records, overlapping saves, successful GPS, and
denied/unavailable GPS fallback. Real-device GPS and saved-manual restart/denial in
the simulator were not exercised in this pass. Automatic approval review rejected a
temporary saved-ZIP overwrite test without same-test restoration; it was replaced
with read-only simulator verification and isolated persistence tests. No existing
saved location, account, database, or OS permission was changed for those tests.

## Follow-up validation — November 19, 2026

TypeScript passed; all 205 automated tests passed; ESLint reported zero errors and
14 existing warnings. Location tests cover manual ZIP persistence across recreated
service instances, per-account separation, successful GPS without preference writes,
and denied/unavailable GPS fallback. Store browsing tests cover shared filtering,
ordering, and pagination.

An actual ZIP-change/terminate/reopen/GPS test was attempted on the currently booted
iPhone 17 simulator. FoodBuddy renders Home, but the debugger did not expose the
React DevTools hook required by the existing UI automation. The test failed before
selecting a ZIP or accessing/writing preferences; its temporary process was stopped.
Consequently native restart persistence, the explicit GPS interaction, and map/list
synchronization after those interactions remain unverified in this follow-up. The
prior native Charleston default/map-list check is not evidence for these additional
restart interactions. No user location preference or account data was changed.

Manual follow-up: select a ZIP in Stores, close/reopen Expo Go and check it remains;
select Use My Location, then close/reopen and check the saved ZIP returns. In each
mode compare list stores with the map pins. Restore the original ZIP afterward.
