# Offline US product catalog

This is a bundled, reviewed data set, not a runtime API integration. No Kroger,
USDA, or other grocery service is called. `database/db.ts` initializes migrations,
then imports `data/us-starter.json` and `data/us-expansion-01.json`. The product
search screen reads this local catalog; legacy API code remains preserved. There are no stores or simulated inventory records.

## Evidence and uncertainty

The initial review was performed on **2026-11-10**. There are 20 real product
identities in the original manifest: **14 verified ingredient statements** and **6 unverified labels**.
This is not a claim that 14 products are safe, that all allergen information is
complete, or that a manufacturer's current page matches every package on shelves.
Market is US; variants and package sizes are recorded only to the extent observed.

Each record preserves:

- Exact ingredient text (including capitalization, nested ingredients, punctuation,
  and separate vitamin sections); otherwise `null`.
- Exact manufacturer allergen and precautionary statements separately, with explicit
  normalized transcriptions. Unknown lists are `null`, never empty safe/absent lists.
- Ingredient verification and declaration/completeness statuses independently.
- Source URLs, evidence excerpts, source kind, checked date, notes, and source IDs
  linking evidence to individual ingredient/declaration/barcode fields.
- The ingredient verification date, only when ingredient text was actually reviewed.
  Source checked dates for unavailable panels are not ingredient verification dates.
- Package variant, size when known, and barcode when explicitly observed and its
  check digit validates. Unknown UPCs remain null. Barilla uses the published GTIN-14;
  Quaker uses its explicitly published UPC-A. No zeroes were guessed for Goldfish.

`complete` means the ingredient, allergen, and precautionary statements in this
record are documented. It does not mean free from all other allergens. `partial`
means ingredient text is verified but at least one declaration is unknown.
`unverified` means the exact ingredient label has not been verified.

Manufacturer pages often omit precautionary warnings. An omitted warning is
**unknown**, not evidence of no shared equipment or cross-contact. Original
Cheerios' unusual manufacturer statement is retained verbatim; its empty positive
contains list does not establish safety for custom allergies. Rice Chex and French's
have verified ingredients but no captured allergen declaration. Ingredient text
must still be checked separately. No derivative mapping is treated as medically
validated. Exact existing catalog names are reused; unmatched explicit species
(e.g. almond and pecan) retain normalized names without guessed catalog IDs.

The importer does not itself establish that a manufacturer's assertion is true.
It validates a human/agent-reviewed local record: source host, exact excerpt,
date, status consistency, barcode checksum, explicit allergen transcription,
unique stable IDs, and label delimiter balance. Declaration checks cover the
starter vocabulary and must be extended/reviewed when adding unfamiliar warnings.
Adding a new trusted manufacturer requires updating the source-host allowlist.

## Import and updates

`importProductCatalog(database, manifest)` accepts a manifest with `formatVersion: 1`,
a stable `catalogId`, and records described by `types.ts`. It validates the whole
input before writes and imports in one transaction with bound parameters. It must
run after migrations, outside another transaction, before other app database work.
Calls on one connection are serialized. No network access occurs during validation
or import; all evidence is bundled with the app.

Stable IDs identify a specific market/variant; a different flavor or package must
receive a new ID rather than overwrite a different product. For larger catalogs,
use separate manifests by market/category with distinct, stable catalog ownership
IDs; the importer is not tied to the 20 starter products.

Migration **3** appends `product_catalog_entries` (current full record JSON) and
`product_catalog_revisions` (append-only accepted snapshots). Existing migrations
1 and 2 and existing account/allergy schemas are unchanged. Repeat imports with
identical content create no new rows. Accepted updates retain their previous
snapshots, replace only the owned product's derived label/assertion rows, and do
not replace/delete the product itself. Removing a product from a manifest does not
delete it from the database.

The importer reports inserted, updated, unchanged, and skipped records. It skips
manual products, products owned by another catalog, older reviews, missing fields,
and verified-to-unverified downgrades. For an intentional manufacturer reformulation,
review the same exact variant again, update its source evidence/date and statements,
and retain the stable ID. An intentional loss of previously documented information
requires explicit review and a future workflow; this importer conservatively skips
it rather than erasing evidence. No existing user, profile, derivative, or inventory
rows are written by the importer.

Parsed `product_ingredients` are conservative verbatim **top-level segments**.
Nested ingredient lists stay intact. These are not a validated medical ontology;
the full original label remains the authoritative captured text. `contains` and
`may_contain` assertions come only from explicit declarations, not ingredient
inference. A product may have no assertion rows while its declaration status is
unknown. Future search/checking code must read provenance statuses as well as rows.

## Tests

```sh
node --experimental-sqlite --test tests/database.test.cjs tests/catalog.test.cjs
npx --no-install tsc --noEmit --incremental false
```

Tests exercise production migration/import code using isolated real SQLite databases.
They do not open or reset the simulator's database or test Expo's native bridge.
They cover all 20 records, repeat/concurrent imports, duplicate prevention, unknown
fields, evidence validation, downgrade/ownership protection, revision retention,
foreign keys, transaction rollback/retry, and preservation of existing user tables.

## Product review inventory

| Product / variant | Ingredients | Declarations | Primary evidence |
| --- | --- | --- | --- |
| OREO Chocolate Sandwich Cookies, Family Size (size unknown) | verified | partial | [Manufacturer source](https://www.oreo.com/products/oreo-cookie) |
| Pepperidge Farm® Goldfish® Crackers, Cheddar, 26.3-oz. Carton (26.3 oz) | verified | partial | [Manufacturer source](https://www.campbellsfoodservice.com/product/cheddar-crackers-2/) |
| Original Cheerios (8.9 oz) | verified | partial | [Manufacturer source](https://www.cheerios.com/products/original-cheerios) |
| RITZ Original Crackers, Snacks for Kids and Adults, Lunch Snacks, 13.7 oz (13.7 oz) | verified | partial | [Manufacturer source](https://www.snackworks.com/products/ritz-original-crackers-snacks-for-kids-and-adults-lunch-snacks-137-oz/) |
| Creamy Peanut Butter (size unknown) | verified | partial | [Manufacturer source](https://www.jif.com/products/creamy/creamy-peanut-butter) |
| Lay's Potato Chips - Classic (13 oz) | unverified | unverified | [Manufacturer source](https://www.pepsicoproductfacts.com/Home/product?gtin=00028400310413) |
| Doritos Flavored Tortilla Chips - Nacho Cheese (14.5 oz) | unverified | unverified | [Manufacturer source](https://www.pepsicoproductfacts.com/Home/product?gtin=00028400517799) |
| Original Mac & Cheese Macaroni and Cheese Dinner (7.25 oz) | verified | partial | [Manufacturer source](https://www.kraftheinz.com/kraft-mac-cheese/products/00021000658831-original-macaroni-cheese-dinner) |
| SKIPPY® Creamy Peanut Butter (size unknown) | unverified | unverified | [Manufacturer source](https://www.peanutbutter.com/product/creamy-peanut-butter/) |
| Oats ‘n Honey Crunchy Granola Bars (17.88 oz (12 two-bar pouches)) | verified | complete | [Manufacturer source](https://www.naturevalley.com/products/oats-n-honey-crunchy-granola-bars) |
| Honey Nut Cheerios (10.8 oz) | verified | partial | [Manufacturer source](https://www.cheerios.com/products/honey-nut-cheerios) |
| Rice Chex (size unknown) | verified | partial | [Manufacturer source](https://www.chex.com/products/rice-chex/) |
| Quaker, Old Fashioned Oats (18 oz) | unverified | unverified | [Manufacturer source](https://smartlabel.pepsico.info/030000010204-0005-en-US/index.html) |
| Spaghetti (size unknown) | verified | partial | [Manufacturer source](https://www.connect.syncpdi.com/sync_pdi/servlet/ItemDynSpec?GTIN=00076808280081&ID=barillaretail&InstanceID=9c6e678cdec83538c880e1b567dd3ac9) |
| French's® Classic Yellow Mustard, 8 oz (8 oz) | verified | partial | [Manufacturer source](https://www.mccormick.com/products/frenchs-classic-yellow-mustard-8-oz) |
| Classic Daisy Sour Cream (size unknown) | verified | partial | [Manufacturer source](https://www.daisybrand.com/wp-content/smush-webp/2023/07/073420000110-Daisy-16-ounce-sour-cream-nutrition-back-side-2400x2400-1.png.webp) |
| Chobani® Greek Yogurt Nonfat Plain (size unknown) | unverified | unverified | [Manufacturer source](https://www.chobani.com/products/yogurt/greek/nonfat-plain-cup) |
| HERSHEY'S Movie Milk Chocolate Candy Bar (1.55 oz) | verified | partial | [Manufacturer source](https://www.hersheyland.com/products/hersheys-milk-chocolate-candy-bar-1-55-oz.html) |
| REESE'S Milk Chocolate Peanut Butter Cups (1.5 oz) | verified | partial | [Manufacturer source](https://www.hersheyland.com/products/reeses-milk-chocolate-peanut-butter-cups-1-5-oz.html) |
| Heinz Simply Tomato Ketchup (20 oz) | unverified | unverified | [Manufacturer source](https://smartlabel.kraftheinz.com/HEINZ/product/00013000626095) |

Manual label review is required for **Lay's Classic, Doritos Nacho Cheese, SKIPPY Creamy, Quaker Old Fashioned Oats, Chobani Nonfat Plain, and Heinz Simply Ketchup**. Source notes in each JSON record explain the exact missing evidence. All other missing UPC, package-size, or warning fields also remain open for review.


## Step 8 expansion and category browsing

The bundled total is **50 products** after adding 30 identities (three per grocery
category). **33** have reviewed ingredient text. Only **3** have complete captured
ingredient, contains, and precautionary evidence: Nature Valley Oats ’n Honey,
Barilla Penne, and Barilla Rotini. **30** are partial and **17** are unverified;
therefore **47** are incomplete. These counts do not imply allergy safety or an
independent laboratory verification. Review date: 2026-11-10.

Migration 4 creates `product_categories` and a nullable foreign key on products,
backfills existing catalog assignments without rewriting source snapshots, and
indexes category/name ordering. `categories.ts` defines canonical IDs and legacy
aliases. Legacy category strings remain in historical evidence snapshots. Unknown
manual products can remain unclassified; browse-all/search still includes them.
No stores or inventory are added.

`index.ts` imports both stable catalog manifests through the same validator and
importer. Adding a batch requires a new stable manifest/catalog ID, reviewed source
hosts, and a registration here. Reruns do not duplicate accepted snapshots;
incomplete evidence cannot replace stronger existing records. Names/brands may
be used for browsing even when label information is explicitly unknown.

| Category | Added products | Total |
| --- | --- | --- |
| Snacks & Candy | TRISCUIT Original, Cheez-It Original, Pringles Original | 11 |
| Dairy & Eggs | Daisy 4% Cottage Cheese, Daisy Light Sour Cream, Eggland’s Best Classic Large White | 5 |
| Breakfast | Corn Chex, Wheat Chex, Cinnamon Chex | 7 |
| Bread & Bakery | Dave’s 21 Whole Grains and Seeds, Nature’s Own Honey Wheat, Pepperidge Farm Farmhouse Hearty White | 3 |
| Frozen Foods | Birds Eye Broccoli Florets, DiGiorno Rising Crust Pepperoni, Eggo Homestyle | 3 |
| Beverages | Coca-Cola Original, Sprite, LaCroix Lime | 3 |
| Pantry | Barilla Penne, Barilla Rotini, Campbell’s Tomato Soup | 7 |
| Produce | Dole Bananas, Classic Romaine, Baby Spinach | 3 |
| Meat & Seafood | StarKist Chunk Light Tuna, Bumble Bee Albacore, Jimmy Dean Turkey Patties | 3 |
| Condiments & Dressings | Hellmann’s Real Mayonnaise, Hidden Valley Original Ranch, French’s Spicy Brown | 5 |

### Manual label review queue

The new batch leaves these 11 labels unverified: Pringles Original, Eggland’s Best
Classic Large White Eggs, Nature’s Own Honey Wheat, Pepperidge Farm Farmhouse
Hearty White, Birds Eye Broccoli Florets, LaCroix Lime, Dole Bananas, StarKist
Chunk Light Tuna in Water, Bumble Bee Solid White Albacore in Water, Hellmann’s
Real Mayonnaise, and Hidden Valley Original Ranch. Per-record notes explain
inaccessible panels or ambiguous package variants. The original six pending
labels remain pending. Unknown package sizes and UPCs remain null. Partial
records also need missing allergen/precautionary evidence before being complete.

The expansion JSON stores every source URL and exact captured label excerpt.
Daisy labels were visually read from manufacturer packaging photographs; Chex
retains its separate vitamins/minerals section. Barilla declarations come from
manufacturer-linked per-product specifications. Coke/Sprite use the original US
HFCS formulas, not other variants displayed on the same pages. Produce declarations
remain unknown even where the ingredient list is short.

Run all regression tests with `node --experimental-sqlite --test tests/*.test.cjs`.
Category tests include a frozen v3 upgrade fixture, foreign keys, per-category
counts, search/filter separation, pagination, repeated imports, and unknown labels.
