# Reviewed product candidates

Candidate files are editorial inputs. They are never loaded by the app. Only an
approved manifest under `catalog/data` is bundled and imported into SQLite.
A dataset row, ingredient text, URL, or checksum alone never establishes verification.

For each candidate:

1. Open the official US manufacturer page or a readable package label. Confirm
   the exact brand, product/flavor, and size where available. Keep unsupported
   sizes, GTINs, images and declarations null. Do not infer cross-contact absence.
2. Transcribe the complete ingredient panel, including separate vitamin/mineral
   sections, without correcting spelling. Keep declarations and precautionary
   statements separate. Whitespace may be normalized; wording must not change.
3. Record exact evidence excerpts, source URL, actual review date, review rationale,
   identity/brand evidence and a SHA-256 of the retrieved source capture. Keep the
   original capture in the review workspace. A hash is a fingerprint, not proof
   that a page is authoritative or accurate; the reviewer must inspect it.
4. Set `decision` to `approved` only after corroborating identity and ingredients.
   Otherwise use `needs_review` or `rejected`. Unreviewed candidate ingredient
   status must remain unverified/unknown. Do not count held records toward 200.
5. Run `node scripts/review-product-candidates.cjs <candidate.json>` to inspect
   approved/held results. An optional second path writes a **new** approved JSON
   manifest and refuses to overwrite an existing file. Revisions of a shipped
   manifest require an explicit evidence comparison; never change its ownership ID.
6. Add the approved manifest to `catalog/index.ts` and test it. The review command
   checks other bundled manifests; the transactional SQLite importer independently
   checks all existing rows and skips duplicate GTINs and normalized identities.

GTIN-8/EAN-8, UPC-A, EAN-13 and GTIN-14 check digits are validated. Leading-zero
representations compare equally. Eight-digit UPC-E codes must first be expanded
using documented evidence; do not submit them as EAN-8. Identity comparisons
normalize case, whitespace, punctuation and trademark marks across brand, name
and variant. They do not perform fuzzy entity resolution: renamed products and
size text embedded in names still need editorial review. Package-size-only variants
must not be counted as extra foods toward the goal. No existing data is merged or
deleted to resolve a potential duplicate.

## Batch 01 — reviewed November 18, 2026

25 candidates, 25 approved, 0 held. Five categories:

| Category | Additions |
| --- | ---: |
| Breakfast | 4 Chex cereals |
| Pantry | 6 Campbell's soups, 3 Jif spreads |
| Snacks & Candy | 2 KIT KAT variants, ALMOND JOY, MOUNDS, YORK |
| Bread & Bakery | 3 Dave's Killer Bread variants |
| Produce | 4 Dole salad/coleslaw mixes |

All ingredient text came from the linked manufacturer's exact product page.
Five Hershey GTIN-14 codes came from the corresponding Product JSON-LD entity,
not the other codes in size selectors. Unknown barcodes remain null. Chex vitamin
and mineral sections and the manufacturer's spelling are retained. Bread, cereal
and produce sizes remain null where not corroborated. Jif's selected 16 oz jars
are explicitly listed on the respective variant pages. No product photos were
copied without established redistribution rights; the existing UI placeholder applies.

25 ingredient lists verified, but only 4 records have both declared and precautionary
statements documented. The other 21 are **partial**, not fully documented allergen
profiles. Absence of a warning is unknown. Facility/equipment statements are
preserved verbatim; `may_contain` is the schema's precautionary relationship bucket,
not a claim that the manufacturer literally used those words.

Progress: 75 total identities, 58 historically marked ingredient-verified. The prior
audit conservatively counted 31 of the original 50 toward the goal; with these 25,
**56 of 200** qualify. The original Coke source still needs ingredient reconfirmation,
and the DiGiorno identity still needs review. All original product data/statuses
remain unchanged. The other 17 original products still need label verification.

Manufacturers can change ingredients. Always check physical packaging before
consumption. Verified ingredient information does not establish allergy safety.
No inventory assignments or user data are changed by this batch.

## Batch 02 — reviewed November 18, 2026

25 new ingredient-verified products passed the existing candidate-review pipeline.
They are in `us-reviewed-batch-02.json`; its approved counterpart is bundled under
`catalog/data`. The app imports it locally with the existing transactional importer.
No runtime grocery requests, ingredient inference, or inventory assignments were added.

| Category | Added |
| --- | ---: |
| Frozen Foods | 5 Stouffer's meals |
| Dairy & Eggs | 5 fairlife milk variants |
| Beverages | 5 Core Power protein shakes |
| Meat & Seafood | 5 Jimmy Dean sausage variants |
| Condiments & Dressings | 5 McCormick, French's and Frank's RedHot products |

All 25 have reviewed exact manufacturer ingredient lists; 16 also have explicit
allergen declarations. No precautionary statement was documented for any of the
25, so **all 25 remain partial**. Nine have unknown separate allergen declarations;
these are never inferred from their ingredient text. Ten GTINs are explicitly
published in matching manufacturer Product JSON-LD entities. fairlife's `sku`
metadata alone is not accepted as proof of a barcode, so those ten barcodes remain
null. Uncorroborated package sizes stay null. No product images were copied;
the existing placeholder applies.

Stouffer's direct HTTP downloads returned 403, but its official product pages were
readable through browser-rendered manufacturer text. Those captures supplied the
complete panels and their review hashes; blocked-response bodies were not used
as ingredient evidence. The source notes identify this capture method.

Research exclusions (not imported or counted): five StarKist product pages lacked
readable ingredient panels in the accessible material. The French's Honey Mustard
12 oz page showed a possible market/formula mismatch and was set aside in favor
of Hot Honey Mustard. No missing text was reconstructed from other variants.

Progress: **100 total products; 81 conservatively count toward 200** (56 prior + 25).
The database has 83 ingredient-verified flags, but the prior audit's two unresolved
source/identity reviews remain excluded. Seventeen original ingredient labels
remain unverified. Original records and their statuses have not been rewritten.
Across the whole catalog, **93 products have unknown allergen or precautionary
information**; only seven have both declaration fields documented. Documentation
completeness never establishes allergy safety.

Validation: TypeScript and all 121 automated tests passed. Isolated SQLite tests
snapshot all 75 prior product rows, ingredient/allergen rows and provenance, and
verify they survive import unchanged. Duplicate, repeat-import, category, search,
unknown-information and account-preservation checks pass. The iOS simulator has
100 products, including all 25 additions, with no foreign-key violations. Actual
UI search/category/detail handlers were exercised through the development inspector:
all 25 appeared in brand results and category lists. Tartar sauce and frozen mac
and cheese details showed exact ingredients, declarations, unknown-precaution
warnings and the packaging reminder. No temporary app code was introduced.

## Batch 03 — reviewed November 18, 2026

25 new ingredient-verified products: 22 Nature Valley variants and three HERSHEY'S
products (an almond chocolate bar and two baking-chip products). The batch deliberately
prioritizes explicit manufacturer allergen panels: **all 25 have documented contains
declarations, and 15 also have explicit precautionary statements**. The other ten
keep their precautionary fields null/unknown. Fifteen additions are `complete`
within this schema; ten are `partial`. This never means allergy-safe or free of
other allergens. The full combined contains/may-contain sentences remain verbatim,
with the positive and precautionary names transcribed from their respective clauses.

There are 22 additions in Snacks & Candy, one granola in Breakfast and two baking
products in Pantry. No package-size-only duplicates were counted. Unknown barcodes
remain null, and no copyrighted packaging image was bundled into the application.

The baking-chip ingredients were visually checked against manufacturer-linked
back-of-package photographs. The milk chocolate chips photo explicitly identifies
`LECITHIN (SOY)` where the page's ingredient text only says lecithin. The photo's
exact bracket/semicolon wording is preserved, with its own source URL, source ID,
review date and capture hash. The source validator admits only manufacturer label
photos under the specific `s7d1.scene7.com/is/image/hersheyprodcloud/` path, not
arbitrary images on that shared CDN. Other candidate candy pages with suspicious
formatting were not used to fill the batch.

Existing incomplete records: **11 exact product sources reviewed; zero records
changed**. See `catalog/reviews/2026-11-18-batch03-existing-allergens.json` for URLs
and capture hashes. No reliable new separate declaration/precaution was captured
for those records. Their existing evidence and unknown fields were preserved;
no warning from another flavor or package was copied across. The whole original
100-product catalog remains unchanged, including ingredient verification flags.

Progress: **125 total identities; 106 verified toward 200** (81 previous + 25).
There are 108 stored ingredient-verified flags, but the two unresolved historical
audit items remain excluded from the goal. Seventeen ingredient labels remain
unverified. **22 records have both declaration fields documented; 103 still lack
allergen or precautionary information.** Missing information is always unknown.

Validation: TypeScript passes; all 127 automated tests pass. Tests cover exact
statements, contains/may-contain separation, manufacturer photo provenance, the
CDN path restriction, all 100 previous records and provenance, account preservation,
repeat imports and search/category retrieval. A global inventory-search test now
checks both pages because the catalog exceeds its 100-result page limit.

Native iOS verification: normal Expo Go startup imported 25 additions into the
existing database. All 25 appeared in brand and category results using the actual
screen handlers, including category pagination. Cashew Sweet & Salty Granola Bars
details showed the documented precautionary statement; Milk Chocolate Chips details
showed the unknown-precaution warning. Both showed exact ingredients, declared
allergens and the physical-packaging reminder. Database checksums confirmed all
pre-existing product/user/inventory data remained unchanged; no foreign-key
violations were found. No temporary diagnostic app code was added. ESLint remains
unconfigured; automatic dependency installation was declined.

## Batch 04 — reviewed November 18, 2026

25 new ingredient-verified identities, selected from smaller categories: **10 Produce,
five Bread & Bakery, five Frozen Foods and five Meat & Seafood**. Manufacturer
pages corroborate each exact product/variety and its full ingredient panel. All
25 pass the existing candidate-review pipeline against the prior 125 products.
Five Jimmy Dean fresh-roll GTINs are explicitly present in matching manufacturer
product JSON-LD; other unsupported barcodes and package sizes remain null. No
package-size-only duplicate is counted. No image is bundled without established
rights; the existing placeholder remains available.

Fourteen additions have explicit manufacturer contains declarations; eleven do
not and retain null/unknown declaration fields. **All 25 have unknown precautionary
information**: no separate precaution was documented on the reviewed pages. No
retailer warning from a different formulation was copied across. Consequently,
all additions are `partial` for allergy-information completeness even though
their ingredient lists are verified. Ingredient verification never establishes
allergy safety. Original manufacturer wording, punctuation and multi-component
salad/frozen-meal panels are retained; only whitespace is normalized. Optional
recipe toppings are excluded. Dole's `INGREDIENTS MAY VARY` warning is retained.
Research pages with broken ingredient words were not used to fill the batch.

STOUFFER'S evidence was read through the browser-rendered official pages because
direct HTTP access is blocked. Their capture hashes identify those rendered
excerpts. Package mass is recorded only where the source explicitly prints net
weight or a whole package serving, never by multiplying approximate servings.

Progress: **150 total products; 131 verified toward 200** (106 previous + 25).
The two unresolved historical audit items remain excluded from the goal, without
changing their stored flags. **22 have complete documented allergen and precautionary
fields; 128 lack at least one**. The prior 125 manifests remain unchanged.

Reviewed source pages (all checked 2026-11-18):

| Brand | Exact manufacturer product | Source |
| --- | --- | --- |
| Dave’s Killer Bread | PLAIN AWESOME BAGELS | [Manufacturer](https://www.daveskillerbread.com/plain-awesome-bagels) |
| Dave’s Killer Bread | EPIC EVERYTHING BAGELS | [Manufacturer](https://www.daveskillerbread.com/epic-everything-bagels) |
| Dave’s Killer Bread | CINNAMON RAISIN REMIX BAGELS | [Manufacturer](https://www.daveskillerbread.com/cinnamon-raisin-remix-bagels) |
| Dave’s Killer Bread | KILLER CLASSIC ENGLISH MUFFINS | [Manufacturer](https://www.daveskillerbread.com/killer-classic-muffins) |
| Dave’s Killer Bread | ROCKIN' GRAINS ENGLISH MUFFINS | [Manufacturer](https://www.daveskillerbread.com/rockin-grains-muffins) |
| Dole | American Blend | [Manufacturer](https://dolefreshvegetables.com/produce/american-blend) |
| Dole | Arugula | [Manufacturer](https://dolefreshvegetables.com/produce/arugula) |
| Dole | Butter Bliss | [Manufacturer](https://dolefreshvegetables.com/produce/butter-bliss) |
| Dole | Italian Blend | [Manufacturer](https://dolefreshvegetables.com/produce/italian-blend) |
| Dole | Spring Mix | [Manufacturer](https://dolefreshvegetables.com/produce/spring-mix) |
| Dole | 50/50 Blend | [Manufacturer](https://dolefreshvegetables.com/produce/5050-blend) |
| Dole | Chopped Caesar Kit | [Manufacturer](https://dolefreshvegetables.com/produce/chopped-caesar-kit) |
| Dole | Chopped BBQ Ranch Kit | [Manufacturer](https://dolefreshvegetables.com/produce/chopped-bbq-ranch-kit) |
| Dole | Chopped Avocado Ranch Salad Kit | [Manufacturer](https://dolefreshvegetables.com/produce/chopped-avocado-ranch-salad-kit) |
| Dole | Chopped Bacon Caesar Salad Kit | [Manufacturer](https://dolefreshvegetables.com/produce/chopped-bacon-caesar-salad-kit) |
| Jimmy Dean | Maple Premium Pork Sausage | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900301001) |
| Jimmy Dean | Premium Turkey Sausage Roll | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900003349) |
| Jimmy Dean | Hot Premium Pork Sausage | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900115639) |
| Jimmy Dean | Country Mild Premium Pork Sausage | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900114618) |
| Jimmy Dean | Italian Premium Pork Sausage | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900210501) |
| STOUFFER'S | Chicken à la King | [Manufacturer](https://www.goodnes.com/stouffers/products/chicken-a-la-king/) |
| STOUFFER'S | Baked Chicken | [Manufacturer](https://www.goodnes.com/stouffers/products/baked-chicken/) |
| STOUFFER'S | Fried Chicken | [Manufacturer](https://www.goodnes.com/stouffers/products/fried-chicken/) |
| STOUFFER'S | Escalloped Chicken & Noodles Casserole | [Manufacturer](https://www.goodnes.com/stouffers/products/escalloped-chicken-and-noodles-12-oz/) |
| STOUFFER'S | Swedish Meatballs | [Manufacturer](https://www.goodnes.com/stouffers/products/swedish-meatballs/) |

Validation: TypeScript passes and all 133 automated tests pass, including six new
batch tests for duplicate GTIN formats, exact component panels and unknown states,
prior-125-product/provenance preservation, local searching/filtering, repeated
imports, account preservation and foreign-key enforcement. Git whitespace checks
pass. ESLint remains unconfigured; automatic dependency installation was declined.

Native iOS verification: normal Expo Go restart imported all 25 into the existing
SQLite database (150 total). All 25 appeared in actual brand-search and category
results using the running screen's existing handlers through the development
inspector. Chopped Caesar Kit details displayed the exact ingredient panel and
contains declaration; Maple Premium Pork Sausage displayed exact ingredients and
the unknown-allergen warning. Both retained unknown-precaution warnings and the
physical-packaging reminder. No temporary application code was added. This tests
screen handlers and rendered results, not physical finger taps on every card.
Read-only database checksums confirmed all 125 previous products/children/provenance
and all other existing tables remained unchanged; 17 stores, 671 inventory rows,
and zero foreign-key violations were confirmed. Authentication and teammate-owned
matching files remain byte-for-byte unchanged from this step's baseline.

## Batch 05 — reviewed November 18, 2026

25 distinct new ingredient-verified products: **10 Dairy & Eggs, five Breakfast,
five Condiments & Dressings, two Beverages and three Bread & Bakery**. These were
among the smaller categories before the batch. The existing Nonfat Plain Chobani
product was explicitly excluded even though alternate naming could bypass a
simple identity comparison. No package-size-only duplicates were counted. All
25 passed the existing candidate review against the previous 150 identities.

Five Chobani Flip variants have both explicit contains and shared-line statements.
Two Cheerios Oat Crunch variants have explicit `May contain wheat ingredients.`
precautions, while their separate positive declaration remains unknown. Missing
precautions for the other 18 products remain null/unknown. Twelve additions have
explicit positive declarations; thirteen do not. Plain ingredients mentioning
milk or mustard are not manufactured into a separate contains declaration.
The generic Cheerios site phrase `Does not contain declaration obligatory allergens`
is retained in source evidence without being interpreted as allergy safety.

The catalog validator now recognizes the exact phrase `line that also handles`
for lexical transcription of precautionary statements. Tests ensure allergens
cannot be pulled from the positive clause into the precautionary clause, or
inferred as individual nut types from generic `tree nuts`. This only validates
source-label transcription. No allergy checker, derivative/tolerance code or
teammate matching tests were changed. Chobani ingredient text, contains sentences
and shared-line sentences are preserved separately and verbatim in provenance.

**Ten manufacturer GTINs** are documented (five Cheerios and five French's). Each was checked
against the exact primary product identity, not a related product, SKU or generic
retailer result. Unsupported barcodes and image references remain null. All
ingredient panels include any vitamins/minerals paragraphs. The US fairlife
Nutrition Plan formulation is distinct from existing Core Power shakes; no
Canadian formula was used. Sources were retrieved for editorial review only;
SQLite imports and product searches never fetch these URLs at runtime.

Progress: **175 products; 156 conservatively verified toward 200** (131 + 25).
Two unresolved historical audit items remain excluded from the goal without
changing their existing flags. **27 complete allergen/precaution records; 148
missing at least one declaration type**. All prior 150 product manifests and
verification flags remain unchanged. Completeness is documentation, never a
claim of allergy safety. Always check physical product packaging.

Reviewed official source pages (all checked 2026-11-18):

| Brand | Product | Exact variant | Source |
| --- | --- | --- | --- |
| Chobani | Blueberry | Chobani® Greek Yogurt | [Manufacturer](https://chobani.com/products/yogurt-greek-blueberry-cup) |
| Chobani | Black Cherry | Chobani® Greek Yogurt | [Manufacturer](https://chobani.com/products/yogurt-greek-black-cherry-cup) |
| Chobani | Strawberry | Chobani® Greek Yogurt | [Manufacturer](https://chobani.com/products/yogurt-greek-strawberry-cup) |
| Chobani | Vanilla | Chobani® Greek Yogurt | [Manufacturer](https://chobani.com/products/yogurt-greek-vanilla-cup) |
| Chobani | Key Lime | Chobani® Greek Yogurt | [Manufacturer](https://chobani.com/products/yogurt-greek-key-lime-cup) |
| Chobani | Almond Coco Loco™ | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-almond-coco-loco-cup) |
| Chobani | Chocolate Haze Craze® | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-chocolate-haze-craze-cup) |
| Chobani | Coconut Caramel Cookie | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-coconut-caramel-cookie-cup) |
| Chobani | Peanut Butter Cup | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-peanut-butter-cup-cup) |
| Chobani | S'more S'mores™ | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-smore-smores-cup) |
| Cheerios | Cheerios Oat Crunch Cinnamon | Cheerios Oat Crunch Cinnamon | [Manufacturer](https://www.cheerios.com/products/cheerios-oat-crunch) |
| Cheerios | Cheerios Oat Crunch Chocolate | Cheerios Oat Crunch Chocolate | [Manufacturer](https://www.cheerios.com/products/cheerios-oat-crunch-chocolate) |
| Cheerios | Cheerios Oat Crunch Almond | Cheerios Oat Crunch Almond | [Manufacturer](https://www.cheerios.com/products/cheerios-oat-crunch-almond) |
| Cheerios | Apple Cinnamon Cheerios | Apple Cinnamon Cheerios | [Manufacturer](https://www.cheerios.com/products/apple-cinnamon-cheerios) |
| Cheerios | Multi Grain Cheerios | Multi Grain Cheerios | [Manufacturer](https://www.cheerios.com/products/multi-grain-cheerios) |
| French's | French's® Classic Yellow Mustard, 8 oz | French's® Classic Yellow Mustard, 8 oz | [Manufacturer](https://www.mccormick.com/products/frenchs-classic-yellow-mustard-8-oz) |
| French's | French's® Creamy Honey Chipotle Mustard Spread, 12 oz | French's® Creamy Honey Chipotle Mustard Spread, 12 oz | [Manufacturer](https://www.mccormick.com/products/frenchs-creamy-honey-chipotle-mustard-spread-12-oz) |
| French's | French's® Creamy Yellow Mustard Spread, 12 oz | French's® Creamy Yellow Mustard Spread, 12 oz | [Manufacturer](https://www.mccormick.com/products/frenchs-creamy-yellow-mustard-spread-12-oz) |
| French's | French's® Maple Mustard, 12.0 oz | French's® Maple Mustard, 12.0 oz | [Manufacturer](https://www.mccormick.com/products/frenchs-maple-mustard-12-0-oz) |
| French's | French's® Worcestershire Sauce, 10 fl oz | French's® Worcestershire Sauce, 10 fl oz | [Manufacturer](https://www.mccormick.com/products/frenchs-r-worcestershire-sauce-10-fl-oz) |
| fairlife | fairlife Nutrition Plan® Vanilla | fairlife Nutrition Plan® Vanilla | [Manufacturer](https://fairlife.com/nutrition-plan/vanilla/) |
| fairlife | fairlife Nutrition Plan® Chocolate | fairlife Nutrition Plan® Chocolate | [Manufacturer](https://fairlife.com/nutrition-plan/chocolate/) |
| Dave’s Killer Bread | 100% Whole Wheat | 100% Whole Wheat | [Manufacturer](https://www.daveskillerbread.com/100-whole-wheat) |
| Dave’s Killer Bread | Supreme Sourdough™ | Supreme Sourdough™ | [Manufacturer](https://www.daveskillerbread.com/supreme-sourdough) |
| Dave’s Killer Bread | OATS & BLUES | OATS & BLUES | [Manufacturer](https://www.daveskillerbread.com/oats-and-blues) |

Validation: TypeScript passes and all 140 automated tests pass. New tests cover
shared-line wording and exact evidence requirements, contains/precaution separation,
unknown states, complete vitamin/mineral panels, duplicate GTIN formats, repeated
imports, all 150 prior product rows/children/provenance, account preservation,
foreign keys and local name/brand/category search. Git whitespace checks pass.
ESLint remains unconfigured; automatic dependency installation was declined.

Native iOS verification: normal Expo Go startup imported all 25 additions into
the existing database, for 175 products. All 25 appeared in actual brand-search
and category results using the running screen's existing handlers through the
development inspector. Almond Coco Loco details showed its exact ingredients,
contains declaration, shared-line warning and packaging reminder. Cheerios Oat
Crunch Cinnamon details showed its exact ingredients, unknown positive-allergen
warning, explicit may-contain wheat statement and packaging reminder. This checks
rendered screen results and handlers, not physical finger taps on every product.
No temporary diagnostic app code was introduced. Read-only checks found zero
foreign-key violations and confirmed all previous products, user tables and other
data unchanged; 17 stores and 671 inventory records remain intact. Authentication,
teammate-owned matching code and matching tests remain unchanged from the baseline.

## Batch 06 — reviewed November 18, 2026

The requested **22 new products** comprise eight Dairy & Eggs, six Beverages,
four Meat & Seafood and four Frozen Foods. Eight Flip flavors prioritize complete
explicit contains/shared-line documentation. Beverage, meat and frozen additions
broaden categories with fewer choices. Every exact ingredient panel was reviewed
against the official US manufacturer's page, including all component paragraphs
and footnotes. All 22 pass the existing candidate-review pipeline against the
previous 175 identities. No package-size-only duplicate is counted.

Eight additions have complete documented allergen/precautionary information.
Four frozen meals have explicit contains declarations but unknown precautions.
Six yogurt drinks and four sausage products lack separately documented contains
and precautionary declarations; those fields remain null/unknown. Ingredient
mentions are retained but are not rewritten into manufacturer declarations.
The Boston Cream Pie source's `*Does not contain eggs.` footnote is retained in
source evidence only; it is not a positive egg declaration, a precautionary egg
warning, or an app allergy-safety claim. Shared-line tree nuts remain generic;
no particular nut types or derivative relationships are inferred.

Four Jimmy Dean GTINs are corroborated by matching manufacturer product JSON-LD.
Other unsupported barcodes and package sizes remain null. Fresh sausages remain
distinct from fully cooked patties/links, and crumbles are distinct product formats.
Yogurt drinks remain distinct from cups even when the flavor name overlaps.
Package size is retained only where explicitly printed or identified as a whole
package serving. No photos are bundled without established rights. STOUFFER'S
capture hashes refer to browser-rendered official page excerpts because direct
HTTP access is blocked. Source URLs are editorial provenance only: initialization
and search still use bundled data and local SQLite without runtime grocery APIs.

Progress: **197 total products; 178 conservatively verified ingredient lists**
(156 + 22). **Another 22 verified products are needed to reach 200 verified**;
197 total records must not be mistaken for 197 verified records. The two unresolved
historical audit items remain excluded, without changing their stored flags.
**35 have complete allergen/precautionary documentation; 162 lack at least one
declaration type.** Missing information remains unknown. All prior 175 product
manifests and verification flags are preserved. Always check physical packaging.

Reviewed official sources (all checked 2026-11-18):

| Brand | Product | Exact variant | Source |
| --- | --- | --- | --- |
| Chobani | Cookie Dough | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-cookie-dough-cup) |
| Chobani | Cookies & Cream | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-cookies-cream-cup) |
| Chobani | Key Lime Crumble® | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-key-lime-crumble-cup) |
| Chobani | Strawberry Cheesecake | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-strawberry-cheesecake-cup) |
| Chobani | Salted Caramel Crunch® | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-salted-caramel-crunch-cup) |
| Chobani | Mint Chocolate Chip | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-mint-chocolate-chip-cup) |
| Chobani | Boston Cream Pie* | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-boston-cream-pie-cup) |
| Chobani | Confetti Birthday Cake | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-confetti-birthday-cake-cup) |
| Chobani | Strawberries & Cream | Chobani® 20G High Protein Greek Yogurt Drink | [Manufacturer](https://chobani.com/products/high-protein-greek-yogurt-drinks-strawberries-and-cream-20g) |
| Chobani | Peaches & Cream | Chobani® 20G High Protein Greek Yogurt Drink | [Manufacturer](https://chobani.com/products/high-protein-greek-yogurt-drinks-peaches-and-cream-20g) |
| Chobani | Mixed Berry Vanilla | Chobani® 20G High Protein Greek Yogurt Drink | [Manufacturer](https://chobani.com/products/high-protein-greek-yogurt-drinks-mixed-berry-vanilla-20g) |
| Chobani | Mango Pineapple | Chobani® 20G High Protein Greek Yogurt Drink | [Manufacturer](https://chobani.com/products/high-protein-greek-yogurt-drinks-mango-pineapple-20g) |
| Chobani | Cherry Vanilla | Chobani® 20G High Protein Greek Yogurt Drink | [Manufacturer](https://chobani.com/products/high-protein-greek-yogurt-drinks-cherry-vanilla-20g) |
| Chobani | Vanilla | Chobani® 20G High Protein Greek Yogurt Drink | [Manufacturer](https://chobani.com/products/high-protein-greek-yogurt-drinks-vanilla-20g) |
| Jimmy Dean | Fully Cooked Original Pork Sausage Crumbles | Fully Cooked Original Pork Sausage Crumbles | [Manufacturer](https://www.jimmydean.com/products/fully-cooked-sausage-crumbles/00077900196300) |
| Jimmy Dean | Fully Cooked Turkey Sausage Crumbles | Fully Cooked Turkey Sausage Crumbles | [Manufacturer](https://www.jimmydean.com/products/fully-cooked-sausage-crumbles/00077900196317) |
| Jimmy Dean | Original Premium Fresh Pork Sausage Links | Original Premium Fresh Pork Sausage Links | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900195440) |
| Jimmy Dean | Original Premium Fresh Pork Sausage Patties | Original Premium Fresh Pork Sausage Patties | [Manufacturer](https://www.jimmydean.com/products/fresh-sausage-and-breakfast-sausage/00077900195464) |
| STOUFFER'S | Roast Turkey | For One | [Manufacturer](https://www.goodnes.com/stouffers/products/roast-turkey-for-one/) |
| STOUFFER'S | Meatloaf | For One | [Manufacturer](https://www.goodnes.com/stouffers/products/meatloaf-for-one/) |
| STOUFFER'S | Chicken Alfredo | For One | [Manufacturer](https://www.goodnes.com/stouffers/products/chicken-alfredo-frozen-entree/) |
| STOUFFER'S | Chicken Pesto Rigatoni | For One | [Manufacturer](https://www.goodnes.com/stouffers/products/rigatoni-with-chicken-pesto/) |

Validation: TypeScript passes and all 147 automated tests pass. Batch tests cover
all 175 previous products, ingredients, allergens and provenance; exact source
statements; unknown fields; negative egg footnote separation; barcode duplicate
formats; idempotent imports; offline name/brand/category retrieval; account
preservation and foreign-key enforcement. Git whitespace checks pass. ESLint is
still unconfigured; automatic installation was declined to preserve dependencies.

Native iOS verification: normal Expo Go startup imported all 22 through native
SQLite, yielding 197 products, 35 complete and 162 incomplete allergen-information
records. All 22 appeared in actual brand-search and category results, including
pagination, using existing screen handlers through the development inspector.
All 22 detail screens were opened through those handlers: exact ingredient text,
declared statements or unknown warnings, precautions or unknown warnings, and
physical-packaging reminders were present. This verifies rendered screen results,
not physical finger taps on each card. No temporary app code was introduced.
Read-only database checksums confirmed all previous tables/records unchanged,
with zero foreign-key violations. Authentication and teammate-owned matching files
and tests remain byte-for-byte unchanged from this step's baseline.

## Batch 07 — final ingredient-goal batch, November 18, 2026

Exactly **22 new products**: four Dairy & Eggs, six Bread & Bakery, six Breakfast
and six Condiments & Dressings. Four Flip variants prioritize explicit contains
and shared-line documentation; eighteen bakery/cereal/sauce products expand
smaller categories. Each exact US variety and complete ingredient panel was
reviewed against the official manufacturer's page. All 22 passed candidate review
against all 197 existing identities, with no duplicate barcode/product identity
and no package-size-only additions. Twelve barcodes are corroborated by matching
primary-product JSON-LD GTINs (six cereals and six sauces).

Four additions have both contains and precautionary statements documented.
Six bakery products have explicit contains statements but unknown precautions.
Six cereals and six sauces retain unknown declaration/precaution fields. Generic
website wording about declaration-obligatory allergens, gluten-free claims and
similar marketing text are never converted into allergy-safety assurances.
For Sticky Sweet sauce, the marketing heading `Gluten-Free Ingredients:` remains
in full source evidence but is excluded from the ingredient-list field; the
actual ingredient list is unchanged. This prevents a heading being mistaken for
an ingredient. All vitamins/minerals paragraphs, nested ingredients and exact
manufacturer warning sentences are retained. Only whitespace and ingredient-list
headings are normalized. Unsupported images, barcodes and package sizes stay null.

**Goal reached: 219 total products, exactly 200 conservatively verified ingredient
lists. Imports stop here.** Two unresolved historically verified flags remain
excluded by the original audit, and 17 original unverified products remain stored.
No historical record or verification flag was changed to meet the goal. There
are **39 products with complete allergen/precaution documentation and 180 lacking
at least one declaration type**. Ingredient verification is distinct from complete
allergen information and is never a safety guarantee. Always check packaging.
See `catalog/reviews/2026-11-18-goal-200.json` for the milestone recount, including
the two excluded historical IDs and the original audit reference.

Reviewed official sources (all checked 2026-11-18):

| Brand | Product | Exact variant | Source |
| --- | --- | --- | --- |
| Chobani | Chocolate Covered Strawberry | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-chocolate-covered-strawberry-cup) |
| Chobani | Cinnamon French Toast | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-cinnamon-french-toast-cup) |
| Chobani | Perfect Peach Cobbler™ | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-perfect-peach-cobbler-cup) |
| Chobani | Red Velvet Cupcake | Chobani® Flip® | [Manufacturer](https://chobani.com/products/yogurt-flip-red-velvet-cupcake-cup) |
| Dave’s Killer Bread | Killer Classic Rolls | Killer Classic Rolls | [Manufacturer](https://www.daveskillerbread.com/killer-classic-rolls) |
| Dave’s Killer Bread | 21 Whole Grains and Seeds Burger Buns | 21 Whole Grains and Seeds Burger Buns | [Manufacturer](https://www.daveskillerbread.com/21wgs-burger-buns) |
| Dave’s Killer Bread | BURGER BUNS DONE RIGHT | BURGER BUNS DONE RIGHT | [Manufacturer](https://www.daveskillerbread.com/burger-buns-done-right) |
| Dave’s Killer Bread | RAISIN' THE ROOF! Breakfast Bread | RAISIN' THE ROOF! Breakfast Bread | [Manufacturer](https://www.daveskillerbread.com/raisin-the-roof) |
| Dave’s Killer Bread | Rock ‘N’ Rolls | Rock ‘N’ Rolls | [Manufacturer](https://www.daveskillerbread.com/rock-n-rolls) |
| Dave’s Killer Bread | 21 Whole Grains and Seeds Sandwich Rolls | 21 Whole Grains and Seeds Sandwich Rolls | [Manufacturer](https://www.daveskillerbread.com/21wgs-sandwich-rolls) |
| Cheerios | Chocolate Cheerios | Chocolate Cheerios | [Manufacturer](https://www.cheerios.com/products/chocolate-cheerios) |
| Cheerios | Frosted Cheerios | Frosted Cheerios | [Manufacturer](https://www.cheerios.com/products/frosted-cheerios) |
| Cheerios | Very Berry Cheerios | Very Berry Cheerios | [Manufacturer](https://www.cheerios.com/products/very-berry-cheerios) |
| Cheerios | Cookies & Crème Cheerios Protein | Cookies & Crème Cheerios Protein | [Manufacturer](https://www.cheerios.com/products/cookies-creme-cheerios-protein) |
| Cheerios | Strawberry Cheerios Protein | Strawberry Cheerios Protein | [Manufacturer](https://www.cheerios.com/products/strawberry-cheerios-protein) |
| Cheerios | Cinnamon Cheerios Protein | Cinnamon Cheerios Protein | [Manufacturer](https://www.cheerios.com/products/cinnamon-cheerios-protein) |
| Stubb's | Stubb's® Original Barbecue Sauce, 18 oz | Stubb's® Original Barbecue Sauce, 18 oz | [Manufacturer](https://www.mccormick.com/products/stubbs-r-original-barbecue-sauce-18-oz) |
| Stubb's | Stubb's® Hickory Bourbon Barbecue Sauce, 18 oz | Stubb's® Hickory Bourbon Barbecue Sauce, 18 oz | [Manufacturer](https://www.mccormick.com/products/stubbs-r-hickory-bourbon-barbecue-sauce-18-oz) |
| Stubb's | Stubb's® Smokey Mesquite Barbecue Sauce, 18 oz | Stubb's® Smokey Mesquite Barbecue Sauce, 18 oz | [Manufacturer](https://www.mccormick.com/products/stubbs-r-smokey-mesquite-barbecue-sauce-18-oz) |
| Stubb's | Stubb's® Spicy Barbecue Sauce, 18 oz | Stubb's® Spicy Barbecue Sauce, 18 oz | [Manufacturer](https://www.mccormick.com/products/stubbs-r-spicy-barbecue-sauce-18-oz) |
| Stubb's | Stubb's® Sticky Sweet Barbecue Sauce, 18 oz | Stubb's® Sticky Sweet Barbecue Sauce, 18 oz | [Manufacturer](https://www.mccormick.com/products/stubbs-r-sticky-sweet-barbecue-sauce-18-oz) |
| Stubb's | Stubb's® Jalapeño & Honey Bar-B-Q Sauce, 18 oz | Stubb's® Jalapeño & Honey Bar-B-Q Sauce, 18 oz | [Manufacturer](https://www.mccormick.com/products/stubbs-r-jalapeno-honey-bar-b-q-sauce-18-oz) |

Validation: TypeScript passes and all 155 automated tests pass. The new goal test
recounts eligible records using the original audit's per-product decisions,
confirming 200 eligible ingredient lists out of 219 identities without promoting
the two unresolved flags or 17 unverified products. Tests cover preservation of
all 197 previous products/children/provenance, statement transcription, unknown
information, full vitamin/mineral panels, GTIN duplicate formats, repeated imports,
account preservation and foreign-key enforcement. Global browsing checks now
cover all three 100-result pages rather than truncating at 200 products. Git
whitespace checks pass. ESLint is still unconfigured; installation was declined.

Native iOS verification: normal Expo Go startup imported all 22 through the
existing native SQLite initialization. The actual database recount confirms 219
total products and 200 eligible verified ingredient lists, with 39 complete and
180 incomplete allergen-information records. All 22 appeared in brand searches
and category lists, and all 22 detail screens showed exact ingredient text,
declarations or unknown warnings, precautions or unknown warnings, and packaging
reminders. Existing screen handlers were exercised through the development
inspector, including pagination; physical finger taps on every card were not
tested. No temporary application code was added. Read-only database checksums
confirmed all pre-existing data unchanged and zero foreign-key violations.
Authentication and teammate-owned matching files/tests remain unchanged from
this step's baseline. No commit or push was made. Imports are stopped; the
catalog is ready for final UI improvements.
