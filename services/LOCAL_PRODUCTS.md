# Local product service

`localProducts.ts` binds the service to the existing `database/db.ts` connection.
Await normal `initializeDatabase()` startup before calling it. The service opens
no database, imports no records, performs no writes, and makes no network requests.
It has no store or inventory dependency. The product screen now consumes this service; the legacy API file is preserved.

```ts
import { localProducts } from './services/localProducts';

const categories = await localProducts.listCategories(); // includes explicit zero counts
const snacks = await localProducts.browseProducts('snacks-candy', { limit: 24 });
const all = await localProducts.browseProducts(null, { limit: 24 });
const page = await localProducts.searchProducts('Oreo'); // always global by default
const names = await localProducts.searchProductsByName('Cheerios');
const brands = await localProducts.searchProductsByBrand('Pepperidge');
const details = await localProducts.getProductById('oreo-original-family');
const ingredients = await localProducts.getProductIngredients('oreo-original-family');
const allergens = await localProducts.getProductAllergens('nature-valley-oats-honey-17-88oz');
```

`createLocalProductService(connection)` can bind the same implementation to an
initialized connection in tests. Production code should use `localProducts`.

## Search contract

- Searches match a literal substring of name and/or brand, ignoring ASCII case.
  Whitespace around the query is trimmed. `%`, `_`, and backslashes are escaped;
  they never become user-supplied SQL patterns. All values use bound parameters.
- Search returns `{ products, limit, offset, hasMore }`. No matches or a blank
  query yield an empty products array. A missing/blank product ID yields `null`.
- Default page size is 25; maximum is 100. Results are sorted by name with a stable
  ID tie-breaker. Query and ID strings are limited to 300 characters. Invalid
  pagination options reject rather than silently returning an unbounded result.
- Search fetches only lightweight product columns, not label text, source snapshots,
  or child rows. Category name and completeness are selected within the same query. It requests one extra row to compute `hasMore`, avoiding a count
  query and per-product lookups.
- Existing name/brand indexes support ordering and future prefix queries. Arbitrary
  substring matching still scans candidate product text; this is appropriate for
  hundreds/thousands of local records. For much larger catalogs, measure and add
  a separately versioned FTS index. SQLite NOCASE/LIKE does not provide full Unicode
  case folding. Migration 4 adds a category/name index without adding dependencies.

## Details and uncertainty

Details return ingredients, allergen declarations, precautionary warnings, relational
assertions, package/variant data, sources, and review dates. Child rows and current
source snapshot are read in one SQLite statement, so an import cannot interleave
revisions between multiple detail queries. Invalid or mismatched source evidence
raises an error instead of being presented as trusted information.

`ingredients.verificationStatus` is `verified`, `unverified`, or `unknown`.
`ingredients.labelText` and `verifiedAt` remain nullable. Parsed segments preserve
nested label text and are not medically validated ingredient relationships.

`allergens.declared` and `allergens.precautionary` each carry their own `status`,
raw `statement`, normalized `names`, and source. An unknown declaration has null
names and statement; it is not flattened to an empty array. A documented empty
positive-declaration list (Original Cheerios) is distinct from unknown data and
still does not establish allergy safety. Relationship rows can include `unknown`
and do not replace declaration/completeness metadata.

All results explicitly have `requiresLabelReview: true`. There is no `safe` flag.
Verified ingredient text does not verify every possible allergen or cross-contact
warning. Products without catalog provenance remain retrievable with unknown
declaration and completeness states. Their relationship rows and source reference,
if any, are retained rather than being treated as verified manufacturer statements.

Do not flatten these results into the current `GroceryProduct` API type: that type
uses empty arrays/strings for missing data and loses source/status distinctions.
The product screen uses `checkLocalProductAllergies` to preserve these distinctions.
It checks only the selected product; cards show label verification without launching
extra checks. Direct declaration/ingredient matches, precautionary warnings, possible
unverified derivatives, and incomplete information remain distinct.

## Automated tests

```sh
node --experimental-sqlite --test tests/database.test.cjs tests/catalog.test.cjs tests/local-products.test.cjs
npx --no-install tsc --noEmit --incremental false
```

Tests use real isolated SQLite databases with production SQL and the production
catalog importer. They cover exact/partial/case-insensitive/brand searches, details,
labels, declarations, precautions, unknown/manual records, missing products,
pagination, literal patterns, repeated read-only searches, and inconsistent evidence.

## Native iOS validation (2026-11-10)

A temporary diagnostic ran after normal initialization against the existing
`foodbuddy.db` in Expo Go on the iPhone 17 Pro simulator (SQLite 3.50.3). It called
the production catalog importer again: 0 inserted, 0 updated, 20 unchanged, none
skipped. The production service returned one Oreo, one Goldfish, and two Cheerios
matches. Oreo details returned verified ingredient text, 11 segments, wheat/soy
declarations, an unknown precautionary status, and one source. User, legacy allergy,
and profile row counts were unchanged across the repeated import. The normal login
screen rendered behind Expo Go's introductory developer overlay.

The diagnostic was removed afterward. No accounts or databases were deleted,
reset, or replaced. Login submission and other screen interactions were not tested
in this step. The production local search UI integration remains a separate task.

## Offline screen integration (Step 7)

`ProductSearchScreen.tsx` searches product names/brands with pages of 24 records,
loads details from SQLite, and compares the selected product with the existing saved
allergy profile. Store selection and all active backend product calls are removed.
Local or data-URI images are permitted; remote image references show a placeholder.

`localAllergyMatching.ts` handles metadata-aware comparison. Exact saved names
(and lexical singular/plural forms) match ingredients/declarations; trace matches
are cautionary. Existing derivative terms remain possible concerns rather than
confirmed medical relationships. Missing labels or declarations cannot yield a
no-match conclusion. Missing precautionary warnings are shown alongside any
no-known-match result. All details retain a physical-packaging reminder.

`latestRequest.ts` invalidates stale search/detail completions, errors, and loading
updates when the query, selection, user, or mounted screen changes. Only one effect
loads selected details and checks allergies. Saved profiles are read, never changed.

On 2026-11-10, simulator tests drove the actual screen's React input/button handlers
over its localhost development inspector. Oreo (1), Goldfish (1), and Cheerios (2)
search results and product details rendered their stored ingredient/allergen text.
Lay's showed unverified/missing-information warnings; a nonexistent query rendered
No products found. A temporary in-memory fetch logger observed no old-backend calls
during that sequence. No temporary application code or data reset was used.


Category browsing uses `browseProducts(categoryId, options)` with the same bounded
pagination contract; `null` browses every product, including uncategorized manual
records. Unlike blank text search, this deliberately returns products without a
keyword. `searchProducts` defaults to the full catalog; an explicit `categoryId`
option can restrict it for future callers. Unknown category IDs return empty pages.
`listCategories()` reads the normalized taxonomy with actual product counts and
includes zero-count categories. The screen shows counts, an explicit empty state,
and a return-to-categories control. Summary completeness distinguishes partial
allergen information from a verified ingredient label.


## Demo store inventory scope

Pass `storeId` in search/browse options to restrict candidates to that store's
`is_demo=1` inventory rows. A store context never changes product details or label
verification. `listCategories(storeId)` returns scoped counts; omitting store ID
preserves global category/search behavior. `simulatedAvailability` is a separate
nullable summary field (`in_stock`, `limited_stock`, `out_of_stock`, `unknown`);
global results/details do not imply stock and return null. The optional
`localInventoryService.getProductAvailability(productId)` returns explicitly demo
store assignments. Missing assignments mean unknown actual availability. Both
paths are asynchronous SQLite reads with no backend or grocery API dependency.
