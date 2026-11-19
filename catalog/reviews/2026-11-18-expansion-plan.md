# Catalog audit and path to 200 verified products

Audit date: 2026-11-18. This is an audit/plan, not a product import. Existing manifests,
SQLite product rows, verification dates/statuses, authentication, accounts, inventory,
and teammate derivative/tolerance code were not modified.

## What the database actually contains

The existing simulator's foodbuddy.db was opened in SQLite read-only/query-only mode.
Only product data was queried; no account/allergy/session records were inspected.
The native database and the two bundled manifests both contain **50 products**:

| Measure | Count | Meaning |
| --- | ---: | --- |
| Stored ingredient status = verified | 33 | Historical recorded reviews, all dated 2026-11-10 |
| Stored ingredient status = unverified | 17 | Not counted toward the target |
| Ingredient lists corroborated against cited sources in this audit | 32 | Includes one product needing identity/name reconciliation |
| Conservative count eligible for the 200-product target | **31** | Current source corroboration plus no identified identity discrepancy |
| Ingredient list matched but product identity/name needs review | 1 | DiGiorno |
| Previously verified ingredient source not re-confirmed | 1 | Coca-Cola |
| Records with ingredient + declared + precautionary statuses documented | 3 | Stored completeness flags, not an allergy-safety claim |
| Product image references | 0 | All products currently need placeholders |
| Documented barcodes | 2 | Quaker (unverified ingredients) and Barilla Spaghetti |

`2026-11-18-audit.json` lists the outcome, source, historical date, and review method
for every product. HTTP capture hashes identify temporary research downloads, not
an assertion that evidence files are distributed with the app. Text comparisons
ignore whitespace/case only for locating the existing statement; the catalog's exact
ingredient text remains unchanged. Identity and three Daisy label photographs were
also reviewed. Missing allergen/cross-contact declarations remain unknown.

The 31 accepted ingredient claims are supported by manufacturer text or readable
manufacturer packaging photographs. This does not prove that every physical package
currently on shelves has the same formula or that every relevant allergen is declared.
No record's original review date was silently advanced by this audit.

### Exceptions requiring follow-up

- **Coca-Cola Original Taste:** the cited original-product page loads, but its current
  retrieved page/HTML did not expose the stored full ingredient list. Do not count
  the existing flag alone. Obtain an actual US package label or another official
  ingredient-bearing source before re-acceptance.
- **DiGiorno:** the official page now calls the product **Ultimate Pepperoni Pizza**,
  24.7 oz. The captured ingredients match the stored statement, but the record's
  name/variant is **Rising Crust Pepperoni**. Confirm exact identity/GTIN and revise
  provenance before counting. Direct HTTP retrieval returned 403; browser research
  could read the manufacturer page. This transport difference is not evidence of
  a formula change.
- The other 17 unverified records retain null verification dates. They are listed
  individually in the audit JSON and must not be promoted merely because text is
  available in a downloaded dataset.

## Architecture already suitable for an offline catalog

The existing importer is transactional, idempotent by stable product ID, preserves
revision snapshots, protects stronger/older evidence from accidental overwrite, and
uses the same foodbuddy.db. It does not seed user or derivative data. Search supports
partial/case-insensitive name and brand matching, category browsing/filtering, and
bounded pagination entirely through SQLite. No runtime grocery API is needed.

Gaps before scaling:

1. Barcode indexes are NOT unique. Different stable IDs can represent the same UPC.
   Add cross-manifest/database duplicate checks with canonical GTIN comparison; do
   not invent a barcode for records lacking one. Review brand/name/variant/package
   identity when barcode is absent. Keep variants distinct; do not count cosmetic
   package duplicates to inflate progress.
2. The source allowlist currently supports manufacturer sources only. Keep bulk
   dataset candidates in a separate staging/review format. Supporting non-manufacturer
   packaging photographs needs an accurately named source kind and explicit review,
   not relabeling a contributor photograph as a manufacturer photograph.
3. Image provenance/licensing is not currently modeled. Add source/creator/license,
   attribution, download date, checksum, and modification notes for approved assets.
   A manufacturer page being public does not grant blanket image redistribution rights.
4. The current UI only accepts file/content/data image URIs. Bundled image assets need
   a local resolver (e.g. a generated asset registry), never runtime hotlinks. Keep
   the existing placeholder for absent, failed, or unlicensed pictures.
5. Review outcomes need a reporting workflow. An unavailable new source should flag
   the old record for review without deleting its historical evidence. A separately
   reviewed correction must not be blocked accidentally by downgrade protection.
6. Category filtering exists. Free-text search currently searches name/brand, not the
   category name itself. If “search by category” means typing a category label, add
   category-label matching as well, preserving combined category/name filtering.

## Realistic source strategy

**Preferred: manufacturer information and exact package labels.** Expand families
whose official ingredient pages proved readable: Snackworks/OREO/RITZ/TRISCUIT,
Cheerios/Chex/Nature Valley, Jif, Campbell's, McCormick, Hershey/Reese's, and others
with readable labels. These are candidate brand families, not verified new records.
Manufacturer-linked SmartLabel/spec sheets are useful only when they identify the
same US variant. A product name or marketing page alone is insufficient.

**Open Food Facts bulk export:** use a downloaded CSV/JSONL snapshot to shortlist US
products, recognize barcodes, and locate actual ingredient-panel photographs. Review
those photographs or cross-check manufacturer evidence before accepting a label.
Neither nonempty ingredients_text, OCR text, completeness scores, nor dataset edits
alone establish verification. Preserve original evidence/revision and review date.

Official documentation points to bulk downloads and warns that contributed data is
not guaranteed accurate, complete, or reliable:
https://openfoodfacts.github.io/openfoodfacts-server/api/

The download landing page was blocked to the research browser. HEAD checks on the
official static CSV and JSONL exports returned HTTP 200. At review time the compressed
CSV was about 1.54 GB and JSONL about 13.77 GB; do not download/load everything into
app memory. Use a streaming development-time filter and keep only a small candidate
subset. No bulk dataset was downloaded during this audit.

https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz

For images, Open Food Facts documents a separate downloadable AWS image collection.
Match the exact barcode, language, variant and image revision, then visually review
legibility. OCR may assist discovery but cannot supply the accepted final transcript.

https://openfoodfacts.github.io/openfoodfacts-server/api/aws-images-dataset/
https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/

The OFF database and images have separate licensing/attribution obligations; retain
those records and meet their applicable share-alike requirements. If use rights are
unclear, retain the placeholder instead of copying an image.
https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/

**Optional secondary candidate source: USDA Branded Foods bulk CSV/JSON.** This is
an offline download, not reintroducing a USDA runtime API. It can supply candidate
brand/GTIN/ingredient records, but its ingredient text is not an independent current
package verification. Manufacturer/packaging evidence remains required. USDA explains
that food-industry providers are responsible for their submitted label data.

https://fdc.nal.usda.gov/download-datasets/
https://fdc.nal.usda.gov/GBFPD_Documentation/

## Incremental implementation sequence, before any import

1. Build a development-only candidate/review pipeline, isolated from runtime imports.
   Record dataset release/checksum/original ID separately from label-review evidence.
   Add duplicate detection before any database write and report rejected candidates.
2. Resolve the two flagged historical claims and try to verify the 17 incomplete
   products. Never fill an unknown list by assumption, including single-ingredient
   foods or missing precautionary statements.
3. Review 20–30 records per batch. For each: exact US product identity, variant/size,
   documented UPC when available, verbatim ingredient statement, source URL, evidence
   snapshot/photo revision, and actual review date. Capture contains and precautionary
   statements independently; leave absent statements unknown. Stop when evidence is
   unavailable or contradictory. Do not change derivative/tolerance mappings.
4. Add approved records to versioned manifests using the existing importer and same
   SQLite database. Test fresh/repeat imports, no duplicates, no evidence downgrade,
   unknown allergen status, category/name/brand lookup and pagination in isolated DBs.
5. Add only licensed local photos plus an offline image resolver/attribution record.
   Test missing-image fallback and airplane-mode product browsing. Existing packaging
   reminders stay visible; add explicit manufacturer-change wording when polishing
   the catalog UI. No authentication or account changes are needed.
6. Publish a measured progress report after each batch. Count only reviewed labels
   whose identities match; retain unknown records but exclude them from the goal.

From the conservative 31, **169 more qualifying records** are needed. If all 19
flagged/unverified existing products can be accepted, this means 150 new products.
If some cannot, preserving them means the app may contain more than 200 total rows
when it reaches 200 verified products. Neither 200 verified nor 200 photos is promised
without the required evidence/rights.

A possible final distribution (targets only, NOT imported or verified counts):
Snacks & Candy 50; Dairy & Eggs 20; Breakfast 30; Bread & Bakery 15; Frozen Foods 20;
Beverages 15; Pantry 25; Produce 5; Meat & Seafood 10; Condiments & Dressings 10.
Prefer products with readable evidence over forcing any category quota.

## Boundary of this step

Only this plan and the audit JSON were added. No new products, images, product status
updates, migrations, or runtime calls were imported. No user DB was reset; no teammate
or Supabase authentication file was changed. No commits or pushes were made.
