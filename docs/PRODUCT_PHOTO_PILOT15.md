# Product photograph pilot: exactly 15 candidates

Reviewed November 19, 2026. This pilot does not expand the product catalog or change
any ingredient/allergen evidence. The fixed candidate set and machine-readable
outcomes are in `assets/products/photo-pilot15-2026-11-19.json`.

**4 approved, 5 rejected, 6 need further review.** Four original, unmodified JPEGs
were added to the local photo registry. There are now 10 enabled photos across 219
products, with 209 placeholders. Four historically held files remain disabled and
preserved. No sixteenth candidate was researched or imported.

| Exact catalog product | Size | Outcome | Reason |
|---|---|---|---|
| ALMOND JOY Coconut and Almond Chocolate Candy Bar | 1.61 oz | Needs review | OFF exact-barcode lookup found no entry; manufacturer image needs redistribution permission. |
| KIT KAT Dark Chocolate Candy Bar | 1.5 oz | Needs review | Same license/availability limitation; no substitute flavor used. |
| MOUNDS Dark Chocolate and Coconut Candy Bar | 1.75 oz | Needs review | Same license/availability limitation. |
| YORK Dark Chocolate Peppermint Patties | 1.4 oz | Needs review | Same license/availability limitation. |
| Cookies & Crème Cheerios Protein | 11.2 oz | Rejected photo | Hand/countertop, angled package and obstructing sticker; size not reliably readable. |
| Strawberry Cheerios Protein | 11.2 oz | Needs review | Front appears to show 11.2 oz, but source quantity says 37 g. Resolve the contradiction first. |
| Cinnamon Cheerios Protein | 11.2 oz | Rejected photo | Net-weight text cropped; metadata alone cannot establish exact pictured size. |
| Stubb’s Hickory Bourbon Barbecue Sauce | 18 oz | Rejected photo | Hand-held, cropped bottle and background. |
| Stubb’s Smokey Mesquite Barbecue Sauce | 18 oz | Approved | Clean front-facing package, readable flavor and 18 oz / 510 g. |
| Stubb’s Spicy Barbecue Sauce | 18 oz | Approved | Clean front-facing package, readable flavor and 18 oz / 510 g. |
| Stubb’s Sticky Sweet Barbecue Sauce | 18 oz | Approved | Clean front-facing package, readable flavor and 18 oz / 510 g. |
| Stubb’s Jalapeño & Honey Bar-B-Q Sauce | 18 oz | Needs review | OFF entry has no selected front image; manufacturer permission unestablished. |
| Jimmy Dean Fully Cooked Original Pork Sausage Crumbles | 9.6 oz | Rejected photo | Discount sticker, hand/background, unreadable net weight. |
| Jimmy Dean Fully Cooked Turkey Sausage Crumbles | 9.6 oz | Rejected photo | Cropped package/weight with large unrelated background. |
| Jimmy Dean Original Premium Fresh Pork Sausage Links | 12 oz | Approved | Clean front-facing tray, Original variant, readable 12 oz / 340 g. |

## Approved evidence and distribution terms

All four approved files come from the selected front photographs in Open Food Facts,
with source uploader **kiliweb**. Their normalized barcode associations match the
existing documented catalog barcodes. Manufacturer pages corroborate the exact
product variants. Size/flavor were also visually checked in the downloaded package
photos. Metadata quantity was not allowed to substitute for unreadable packaging.

Each original file has its image URL, product URL, manufacturer reference, source
selected-image ID/revision, uploader, review date, SHA-256, and unchanged-image notice
recorded in the manifest and `assets/products/reviews/`. No image transformation,
background generation, relabeling, or replacement packaging was performed. The
selected front image may already have been cropped/resized by OFF.

The applicable published photograph license is **CC BY-SA 3.0**, based on OFF's
[official licensing documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).
[License terms](https://creativecommons.org/licenses/by-sa/3.0/) require attribution,
a source/license link, appropriate disclosure of adaptations and share-alike terms
for adaptations. Existing on-device photo credits expose the contributor, source,
license, and changes. The files remain under their photo license, not an application
code license. No endorsement is implied.

This approval relies on OFF's published licensing of the photographic contribution;
it is not a manufacturer permission or a guarantee of clearance of all rights in
packaging artwork/trademarks. OFF expressly distinguishes those third-party rights.
No direct manufacturer images were bundled and no school-project exemption was
assumed. If the school requires affirmative packaging-owner permission in addition
to the photograph license, these four require that additional clearance before such
distribution; the registry can continue to use placeholders instead.

Manufacturer research included the exact product pages listed in every decision
record, plus [Hershey terms](https://www.thehersheycompany.com/en_us/home/terms-and-conditions.html),
[McCormick terms](https://www.mccormick.com/pages/terms-and-conditions),
[Tyson terms](https://www.tysonfoods.com/legal/terms-of-use), and General Mills reuse
terms. No applicable unrestricted manufacturer image redistribution grant was found.
Four Hershey metadata lookups returned “product not found”; this is not a claim the
products or photographs do not exist elsewhere.

All acquisition happened during development. Rejected preview downloads stay outside
the app in temporary review files. Only approved photos were copied into app assets.
The app uses Metro static local asset references; no runtime product/image API was
added. No dependencies were added.

## Validation

TypeScript passed; ESLint reported 0 errors and the same 15 advisory warnings.
All 194 automated tests passed, including pilot scope, decision counts, exact identity,
source/attribution/license evidence, asset hashes and the static registry.

The existing iPhone 17 Pro simulator was exercised through rendered UI callbacks. All
four new photos appeared in search cards and product details; source/attribution/license
credits opened correctly. Screenshots were visually checked for all four, with the
existing allergy matches and ingredient lists still visible. No saved allergies were
edited. A physical device, production build, and airplane-mode launch were not tested;
the images use the same static asset mechanism as existing offline photographs.

All 43 snapshotted catalog, authentication, store, database and protected matching/UI
files were unchanged. No commit, push, dependency installation or extra candidate
review was performed.
