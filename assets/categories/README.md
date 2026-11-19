# FoodBuddy category artwork

Ten original illustrations created with the built-in OpenAI imagegen tool on
2026-11-19, one per existing grocery category. They are generic food still lifes,
not photographs, actual product packaging, ingredient evidence, or allergy advice.
No artwork was copied from another app or website. No brands or logos were requested.

The complete final prompt set and generation metadata are in `manifest.json`.
Style: colorful editorial gouache/cartoon still lifes, rounded forms, subtle texture,
soft complementary backgrounds, landscape 3:2 framing, no text/emoji/branding.
Original full-resolution outputs remain in the imagegen output directory; locally
bundled 768px JPEGs total approximately 1.3 MB. No runtime image service is used.

`CategoryArtwork` uses a static Metro asset registry. `ProductPhoto` prefers approved
product photographs, including their existing credits, and uses this artwork only
when a photo is missing or fails. Product fallbacks display “Category illustration”
and screen-reader text explicitly says the art is not actual product packaging.
Artwork does not imply that the depicted foods occur in the product.
