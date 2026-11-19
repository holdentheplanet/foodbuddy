# Product photo audit and next collection plan — November 19, 2026

Update: the subsequently authorized fixed 15-candidate pilot added four photographs.
See [the pilot report](PRODUCT_PHOTO_PILOT15.md). Counts and proposals below describe
the pre-pilot audit.

## Completed review

All ten existing JPEGs were visually inspected at their available resolution. Their
hashes, catalog identity fields, barcode equivalence, sources, attributions and CC BY-SA
3.0 license records are checked by tests. Original provenance and files are preserved.
The per-product decisions are in `assets/products/audit-2026-11-19.json`.

Retain six: KIT KAT Milk Chocolate 1.5 oz; Chocolate Cheerios 14.3 oz; Frosted Cheerios
18.4 oz; Very Berry Cheerios 18.6 oz; French's Worcestershire 10 fl oz; Barilla Spaghetti.
Barilla's front shows 16 oz; its existing catalog size is unspecified. Its barcode
association is retained; the catalog is not silently changed to a specific size.

Hold four: French's Classic Yellow Mustard 8 oz (hand/store background), French's
Creamy Honey Chipotle 12 oz (angled/countertop/hand), Quaker Old Fashioned Oats 18 oz
(shelf background and insufficiently readable size for fresh visual confirmation),
and Stubb's Original 18 oz (used bottle/residue/hand). No conclusive wrong-brand/flavor
substitution was found in the other photographs. Retain does not mean a studio-quality
image, current packaging guarantee, or newly verified ingredients.

Held images now use a neutral document-shaped placeholder, with explicit “Photo
unavailable” text. No generic food picture, generated package, or similar variant
substitutes for them. They remain in the original manifest and filesystem so their
provenance is not lost. Six photos display; 213 products show placeholders. Four held
files are still statically bundled and retained, not approved for display.

## Licensing and source limits

Open Food Facts' official licensing documentation states that product photographs
are CC BY-SA, while packaging graphics can retain separate copyright or other rights:
https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

CC BY-SA 3.0 requires attribution, a license link, identification of adaptations and
share-alike licensing for adaptations. It gives no warranty that every third-party
right is cleared: https://creativecommons.org/licenses/by-sa/3.0/

Existing credits remain available in product details. Existing attribution/uploader
and barcode/source associations were not independently reauthenticated with uploaders.
Open Food Facts' terms/product site returned a crawler restriction during this review;
its accessible official documentation was used, rather than treating inaccessible
pages as verified. No blanket claim of full packaging-rights clearance is made.

Manufacturer product pages are preferred for identity corroboration and identifying
better artwork, but being publicly downloadable does not grant redistribution rights.
For example, General Mills Foodservice's terms restrict redistribution of graphics
without express written consent:
https://www.generalmillsfoodservice.com/termsofuse
No new manufacturer image with an explicit applicable bundling permission was cleared
in this pass. School-project status is not assumed to create an image license.

## Realistic next batch, before any bulk download

The catalog has 219 products: 48 have recorded barcodes; 171 do not. Ten of those 48
already have historical photo records. Therefore 38 additional barcode-backed product
identities are sensible first candidates, plus the four replacement-photo holds.
These are research candidates, not promises that suitable licensed images exist.

**New exact-match photographs approved now: zero.** A pilot reviewing 10–15 candidates
is a reasonable next work unit, not a forecast of 10–15 successful images. A defensible
success count requires examining those files and their permissions first. Do not
promise photographs for all 219 or infer identity from a name alone.

Recommended process:

1. Build a photo-only candidate record from the existing product ID, exact name, brand,
   variant, package size, documented GTIN/UPC and original manufacturer reference.
2. Corroborate the exact SKU on manufacturer pages or readable front + barcode/size
   packaging photographs. Do not invent barcodes for the remaining 171 products.
3. Seek explicit manufacturer redistribution permission/asset terms. Otherwise examine
   contributor packaging photos with documented applicable licensing, or take original
   photographs of the exact packages and record photographer permission/license.
4. For a larger OFF collection, join a development-time metadata snapshot to documented
   barcodes and fetch selected images from the public AWS dataset. OFF recommends AWS
   for more than a few images; this is not a runtime service or ingredient-data import:
   https://openfoodfacts.github.io/openfoodfacts-server/api/how-to-download-images/
   https://registry.opendata.aws/openfoodfacts-images/
5. Require visual review of name, flavor, US market, size/multipack and readable pack
   identity. A barcode hit alone does not prove the selected photo belongs to that SKU.
   Reject wrong sizes, used containers, obscured labels, watermarks, low quality and
   unclear permissions. Do not edit or regenerate packaging to make it match.
6. Record page/image URL, uploader/rights holder, license and permission evidence,
   review date, original hash, changes and an approve/hold decision. Preserve credits
   and license notices for approved locally bundled files and any adaptations.
7. Import only approved photos into the static registry. Ingredient evidence, allergen
   records, SQLite catalog and verification dates remain untouched. Runtime searching
   and image display continue without external grocery/image API calls.

No image batch was downloaded during this pass. No authentication, matching/tolerance
rules, product evidence, store or inventory records were changed.
