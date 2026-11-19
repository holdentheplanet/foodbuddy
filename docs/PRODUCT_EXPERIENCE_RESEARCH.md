# Coordinated product experience review — November 19, 2026

## Evidence audit

The repeatable, development-only command `node scripts/audit-product-experience.cjs`
reads every bundled manifest and emits an inventory without changing records or
fetching runtime data. An optional output path creates a new report and refuses to
overwrite existing files. The checked-in [219-record report](reviews/product-experience-audit-2026-11-19.json)
links exact identities, dates, evidence, photo permission state and next actions.

- 219 products; 202 contain ingredient text; 17 have no ingredient label text.
- 200 retain documented, previously reviewed ingredient evidence. Two additional
  records contain text but have historical identity/source review holds.
- 39 have documented ingredient, declared-allergen and precautionary information;
  180 lack some evidence. This does not establish safety.
- Ten enabled approved photographs; 209 without an enabled approved photograph.
- No new ingredient records or images were imported during this review.

This is an exhaustive structural audit, not a fresh verification of every online
label. A recent review date does not prove a manufacturer has not changed a recipe.
No unsupported expiration date or automatic verification claim was introduced.
The two held historical products remain held. Their stored evidence is preserved.

## Follow-up on all 17 missing labels

Official reference pages were opened read-only through the research browser. No
access restrictions were bypassed. None of the findings below is an approved import.

| Product | Source outcome and remaining work |
| --- | --- |
| Pringles Original | [Manufacturer](https://www.pringles.com/en-us/products/pringles-the-original-product.html) exposes full ingredients and wheat declaration for a selected 5.2 oz product. Existing size/GTIN is not established; confirm exact package identity before adopting that panel. Precautionary status remains unknown. |
| Eggland's Best Classic eggs | [Manufacturer](https://www.egglandsbest.com/product/classic-eggs) lists multiple egg sizes/counts. Product descriptions are not a transcribed ingredient panel; do not generate one. |
| Nature's Own Honey Wheat | [Manufacturer](https://www.naturesownbread.com/natures-own/honey-wheat) now describes a changed, simpler recipe but no readable ingredient panel was returned. Obtain a current exact-package label. |
| Pepperidge Farm Hearty White | [Manufacturer](https://www.pepperidgefarm.com/product/farmhouse-hearty-white-bread/) returned a shell with no readable label; exact packaging needed. |
| Birds Eye Broccoli Florets | [Manufacturer](https://www.birdseye.com/plain-vegetables/steamfresh/broccoli-florets) lists 10.8/48 oz sizes and a nutrition control; readable ingredient panel not returned. A marketing claim is not a substitute for the label. |
| LaCroix Lime | [Reference](https://www.lacroixwater.com/flavors/lime/) returned 403; no bypass attempted. |
| Dole bananas | [Existing PDF reference](https://www.dole.com/sites/default/files/media/bananas.pdf) encountered a redirect loop. No ingredient list inferred from the food name. |
| StarKist Chunk Light Tuna | [Manufacturer](https://starkist.com/product/chunk-light-tuna-in-water-can/) exposes several can sizes/nutrition panels but no readable ingredient panel in this extraction. |
| Bumble Bee Solid White Albacore | [Manufacturer](https://www.bumblebee.com/products/tuna/bumble-bee-solid-white-albacore-in-water/) exposes multiple size-specific panels with different ingredients and declarations. Must map the exact package; do not flatten these into one label. |
| Hellmann's Real Mayonnaise | [Existing reference](https://www.hellmanns.com/us/en/products/mayonnaise.html) is now a product collection, not a single exact label. |
| Hidden Valley Original Ranch | [Existing reference](https://www.hiddenvalley.com/products/ranch-condiments/original-ranch/) now shows a broader brand collection. Obtain an exact SKU page/package. |
| Lay's Classic 13 oz | [Exact GTIN reference](https://www.pepsicoproductfacts.com/Home/product?gtin=00028400310413) corroborates identity but did not return a readable ingredient panel. |
| Doritos Nacho Cheese 14.5 oz | [Exact GTIN reference](https://www.pepsicoproductfacts.com/Home/product?gtin=00028400517799) corroborates identity but did not return a readable ingredient panel. |
| SKIPPY Creamy | [Manufacturer](https://www.peanutbutter.com/product/creamy-peanut-butter/) exposes several ingredient panels associated with size choices. Wording varies across panels; establish exact size/GTIN first. |
| Quaker Old Fashioned 18 oz | [SmartLabel](https://smartlabel.pepsico.info/030000010204-0005-en-US/index.html) corroborates 18 oz / UPC but returned tab headings rather than full ingredients. Original source says package versions can differ; obtain readable panel. |
| Chobani Nonfat Plain | [Manufacturer](https://chobani.com/products/yogurt-greek-nonfat-plain-cup) exposes ingredients for a 5.3 oz cup. Confirm the existing record's exact package identity before updating; absence of precautionary text remains unknown. |
| Heinz Simply Ketchup 20 oz | [SmartLabel](https://smartlabel.kraftheinz.com/HEINZ/product/00013000626095) returned no readable content. |

For each update, use the existing candidate-review workflow: capture the actual
page/label, retain its checksum, exact identity/size/GTIN evidence and full label text,
review declarations separately, compare with existing evidence, and approve only
corroborated fields. No less reliable data may overwrite stronger evidence.

## Photography and hosted-image research

The existing [20-product official-image pilot](OFFICIAL_MANUFACTURER_IMAGE_PILOT20.md)
and [manufacturer media permission review](MANUFACTURER_MEDIA_PERMISSIONS.md) remain
applicable. Its URLs are candidates, not permitted assets. The new audit attaches
those candidates to the appropriate catalog IDs without treating other ingredient
source URLs as image matches.

Additional official route found: [Hormel's Brand Consent Request](https://www.hormelfoods.com/about/contact-us/consent-request/)
accepts requests to feature brands (including the SKIPPY route linked from its product
page), with a stated 4–6 week review period. The [site terms](https://www.hormelfoods.com/terms-conditions/)
do not grant app redistribution or public display merely because a URL is accessible.
No request was submitted and no image was downloaded.

No documented hosted-image permission covering FoodBuddy was established for the
reviewed sources. Hosting avoids neither the need for permission nor variant review;
remote access would also fail offline. No hotlinked URLs or runtime image requests
were added. Future written permission must explicitly cover hosted display, offline
caching/bundling, audience/distribution, modifications, credit and duration. The
existing ten approved local photos/credits remain intact; zero new photos obtained.
The remaining 199 official-photo identities have not received a complete manual
image/rights review; source inventory is not a claim of completed image research.

## UI and validation scope

Home and Shop use the same compact product card and signed-in local allergy checker.
Home has ten scrollable existing products and See all. Shop opens all products and
retains name/brand search, category filters and pagination. The presentation layer
leaves all derivative/tolerance matching untouched. Red conflict wins over missing
evidence; cautions, unknown profiles/results and incomplete evidence are yellow;
green requires a completed no-match result plus complete evidence. Literal highlights
only emphasize terms already reported in ingredients by the existing matcher.

Full ingredient text, declarations and precautions remain visible in details. Sources
and dates remain secondary. Existing teammate-owned match lists still show their
original distinctions and personal tolerance settings. No shared account-independent
assessment cache is used; asynchronous page/account changes discard old results.

## Final validation

- TypeScript passed. All 212 automated tests passed. ESLint: zero errors and
  14 existing warnings. Git whitespace check passed.
- Native iOS simulator: Home showed ten discovery products; Shop loaded 24 products,
  then 48 after Load more. OREO name search, Cheerios brand search, Breakfast filter,
  and no-result state passed through actual UI handlers.
- Existing signed-in profile produced red, yellow and green product details using
  the unchanged native-SQLite checker; the full ingredient text node was visible in
  each. No profile selections or account settings were changed for the tests.
- Screenshots: `/tmp/foodbuddy-home-coordinated.png`,
  `/tmp/foodbuddy-shop-coordinated.png`, `/tmp/foodbuddy-detail-red.png`,
  `/tmp/foodbuddy-detail-yellow.png`, `/tmp/foodbuddy-detail-green.png`.
- Photo manifest/registry/audit checksums remain unchanged. Protected matching,
  tolerance, authentication, catalog and store files were not edited by this work.
- Cross-device synchronization, signup/logout, location persistence and network-off
  behavior were not re-tested in this product-experience task. Existing implementations
  were preserved; no claim of new end-to-end validation for those journeys is made.
- Manufacturer permission and exact-package evidence gaps remain outstanding; no
  source candidate is counted as an imported improvement. No commit or push.
