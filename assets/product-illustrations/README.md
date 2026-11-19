# Product-specific generated illustrations

These are generated food illustrations, not official product photographs or ingredient evidence. Each enabled image belongs to one exact catalog ID. Real approved photographs retain priority and their original credits. Static `require` entries in `ui/productIllustrations.ts` bundle the enabled JPEGs; source URLs are documentation only and are never runtime image URLs.

The five pilot illustrations were explicitly approved by the user. Expansion images use that pilot's lighting, square framing and neutral background. Each expansion prompt, source references, ingredient-text hash and visual-review decision is recorded in `design/product-illustration-expansion/`. The app manifest includes only enabled images. `coverage.json` records all 219 outcomes, including specific fallback reasons. Held generated files are not referenced by the app registry.

The illustrations show the food without fake branded packaging or logos. Serving dishes are illustrative props. They must never be used to infer ingredients, absence of allergens, portion size or the precise appearance of current manufacturing lots. The application's ingredient, allergen and verification records remain unchanged.

## Review procedure

1. Check the exact product/variant and manufacturer evidence before writing a subject specification. A flavor name alone does not establish toppings, shape, color or filling.
2. Generate one separate image per product using the built-in imagegen tool; do not reuse category images.
3. Inspect the image against the subject and source. Reject added foods, incorrect forms or fabricated packaging. Retain neutral fallback where evidence is insufficient.
4. Record the prompt, source references, review, disclosure and file hash. Add a static require only after review.
5. Validate known product IDs, unique image hashes, local files, preserved photographs, coverage totals, TypeScript, ESLint and tests. Check Home, Shop and Details in the simulator.

Supreme Sourdough and Oats & Blues initially failed source comparison and were regenerated with the documented seed-coated crust and oat/blue-cornmeal topping respectively. Original generation outputs remain outside the app; corrected prompt records document the decision. Two generated Hershey bar images are held because their exact physical segmentation/distribution was not sufficiently corroborated.

No manufacturer photographs were downloaded or relicensed for this expansion. No external image API, image-generation dependency, or paid service was added to FoodBuddy.
