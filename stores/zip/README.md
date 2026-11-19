# Offline ZIP-area reference

`us-zcta-2025.json` contains 33,791 five-digit Census ZIP Code Tabulation Area
(ZCTA) identifiers mapped to `[latitude, longitude]`. The 1,046,641-byte JSON is
bundled with the app and accessed locally. It is not downloaded at runtime and
never uses device IP addresses or a geocoding API.

Source: U.S. Census Bureau, 2025 Gazetteer ZIP Code Tabulation Areas, based on
2020 Census tabulation geography. The publisher describes coverage for the 50
states, District of Columbia and Puerto Rico. ZCTAs are statistical approximations
of postal ZIP areas; this is not a complete USPS delivery ZIP directory. Some
PO-box, unique, military, new or other postal ZIPs have no entry. Unsupported codes
produce an explicit error without a fallback location. Leading zeros are retained.
The stored points are the publisher's representative internal points, not exact
addresses, surveyed ZIP centers or device locations. Every ZIP selection and its
distances are labeled approximate.

- Reference: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html
- Official archive and checksum: `source.json`
- Fields retained unchanged numerically: `GEOID`, `INTPTLAT`, `INTPTLONG`
- Retrieved November 18, 2026; release/geography dates remain explicitly separate.

To reproduce, download the exact official archive referenced in `source.json`,
then run `python3 scripts/build-zip-reference.py /path/to/2025_Gaz_zcta_national.zip`.
The script validates keys/coordinate bounds/duplicates and preserves the archive
SHA-256. It makes no network requests. Do not replace this data with guessed ZIP
coordinates. No existing SQLite schema, product or store data is changed by ZIP
lookup. No paid service, account or API key is required.
