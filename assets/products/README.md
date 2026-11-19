# FoodBuddy offline product photos

**Pilot update — November 19:** four additional photos approved under OFF’s published
CC BY-SA photograph license. There are now 10 enabled images and 209 placeholders;
14 files/provenance records are preserved, including four historical holds. See
[the fixed 15-candidate report](../../docs/PRODUCT_PHOTO_PILOT15.md) for per-product
decisions and packaging-rights limitations. The audit/import notes below are historical.

**November 19 audit update:** six photographs remain enabled; four are held for
replacement and use neutral placeholders. Original files/provenance remain intact.
See `audit-2026-11-19.json` and [the current audit and collection plan](../../docs/PRODUCT_PHOTO_AUDIT.md).
The historical review below describes the original ten-photo import.

Ten real product photographs are bundled here. They are identification photos,
not ingredient/allergen evidence. All 219 ingredient records and source snapshots
remain unchanged. Packaging can change; always check the current physical label.
No manufacturer, retailer or generative images were copied as substitutes.

Each file has an exact product-ID mapping, the existing documented barcode,
brand/variant/size, Open Food Facts product and selected-image URLs, contributor
attribution, license URL, review date and SHA-256 in `manifest.json`. A reviewer
compared readable front packaging and source metadata to the catalog identity.
Records without a matching approved photo use a neutral category placeholder;
there is no brand-based or nearest-variant image fallback.

## License and attribution

Photos: **CC BY-SA 3.0** <https://creativecommons.org/licenses/by-sa/3.0/>.
Attribution: **Open Food Facts contributors**, with the selected-photo uploader
recorded per file. Product detail screens expose each attribution, product-source
URL and license URL under **Photo credits**. The selected front-image JPEGs are
unmodified by FoodBuddy; selection/cropping was performed by Open Food Facts.
Photo files and any future adaptations retain their applicable share-alike terms.
This does not change the license of the application's code.

Open Food Facts' terms cover contributors' photographic rights. Packaging artwork,
trademarks and other third-party rights remain with their owners. These photos are
used for factual product identification, without an endorsement claim. Do not
reuse the photographs as advertising artwork or claim ownership of packaging.

Official source licensing references, checked November 18, 2026:
- <https://world.openfoodfacts.org/terms-of-use>
- <https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/>

## Review limits

The initial realistic target was 10–20 photographs; **10 passed this review**.
The other 209 products retain placeholders. One Strawberry Cheerios Protein photo
was a 37 g variant, not the catalog's 11.2 oz box. The Cinnamon Protein front did
not show its complete package size, and the Cookies & Crème Protein image had
obscured/unclear packaging. Those three were excluded. Other candidates were
missing or unavailable, including source rate limits; no missing photo was guessed.

Photo research used temporary scripts outside the app. Runtime code uses only
Metro static `require` entries from `ui/productPhotos.ts`, never the source URLs.
Development Expo Go receives local asset files from localhost Metro. Production
builds bundle those files on-device. No dependency was added and no SQLite image
reference, schema, catalog record or ingredient verification date was modified.

## Validation

On November 18, 2026, TypeScript passed and all 161 automated tests passed,
including six presentation/photo checks. Expo lint could not run because this
project has no ESLint configuration; dependency installation was declined.

The existing iPhone 17 Pro simulator running Expo Go was checked through its
rendered React controls. All ten photo mappings opened in product details with
their attribution/license credits, all ten category controls were present, and
pagination reached all 219 products. Breakfast category browsing and product
cards were visually inspected. A Chocolate Cheerios detail screenshot confirmed
the actual package photo, ingredient evidence panel and separate incomplete
allergen panel. Unknown precautionary text and the packaging reminder were
checked. Invoking the image error callback displayed its neutral placeholder.

Read-only checksums of all 19 existing simulator SQLite tables were unchanged.
Existing authentication, catalog data and teammate matching files were unchanged
against the start-of-task file snapshot. Authentication and multi-device flows
were not retested. No standalone production build, airplane-mode test or second
iPhone size was tested during this change. Development assets were served by
localhost Metro; the static image registry requires no external image service.
