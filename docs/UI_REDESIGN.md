# FoodBuddy UI redesign

The visual direction is off-white canvas, dark green actions, dark blue headings,
quiet dividers, 44-point minimum action targets, and color reserved for meaningful
warnings. Existing navigation, local data, authentication, and matching rules remain.

## Stage 1 — Stores

- Location selector opens a modal sheet for foreground GPS, approximate ZIP lookup,
  or explicit all-saved-store browsing. No inferred/default city was added.
- Search, Map/List control, and one Filters entry replace the former control stack.
- Map is the default native view. Pin selection opens a compact, scrollable preview
  over the map, including inventory status, dataset qualification, and source details.
- List mode groups loaded stores by chain with one expanded chain at a time.
- Filter sheet contains a chain dropdown, radius, and nearest/name sorting.
- Sorting precedes pagination; pins represent the same loaded filtered page as List.
- Store inventory remains an overlay, preserving the selected store/map on return.

## Stage 2 — Shop

Simpler category tiles, fewer card borders and evidence fills, an open product header,
and accessible Ingredients / Manufacturer-declared allergens / Precautionary warnings /
Sources disclosures. Allergy summary and evidence completeness remain outside all
collapsed sections. The physical-packaging reminder remains visible in the detail flow.
The allergy summary appears immediately after the product identity, before its compact photo. No product evidence or matching logic was changed.

## Stage 3 — Home and Settings

Home removes the repeated promotional panel and duplicate browse action. Settings
uses open profile/security sections; cloud/legacy tools are available through a
labeled disclosure. Authentication operations are unchanged. AllergyProfileScreen,
AllergyCard, and matching modules were deliberately preserved byte-for-byte because
these contain teammate-owned functionality. Their existing controls remain available
through the same five-tab navigation; this is a limitation on visual consistency.

## Verification

Each initial stage passed TypeScript, ESLint (0 errors, 15 existing advisory warnings),
and 188 existing tests. Three new store-sort regression tests cover global order before
pagination, combined filters, preservation of input records, and missing-location
behavior. Final suite: 191 tests.

Rendered React controls in the existing iPhone 17 Pro simulator were exercised through
its local debugger, with native SQLite and Apple Maps active. Screenshots reviewed:
map layout and filter sheet. Passed ZIP selection, chain dropdown/group expansion,
Map/List modes, map-pin selection, demo inventory navigation/return, unknown-inventory
status, name sorting, 10-to-20 pagination, search and coverage empty states, unsupported
ZIP, browse-all, and matching map/list identifiers. Oreo, Goldfish, and Cheerios detail
disclosures opened and critical warnings remained rendered. Home, Settings tools, and
the unchanged allergy editor rendered. Read-only native SQLite counts: 219 products,
167 stores, 671 inventory records.

The GPS picker also returned a simulator location successfully. Still manual: physical GPS accuracy, VoiceOver focus/announcements, small iPhones,
large text with the new sheet/preview, physical keyboard/touch interactions, and real
two-device authentication/allergy sync. Simulator actions used rendered UI callbacks;
these are not claims of physical touch or end-to-end signup testing. No saved allergy
selections, credentials, or accounts were edited as part of this redesign verification.
No dependencies, schema, catalog, store records, or matching rules were changed.

## Minimal presentation follow-up

Removed Shop's promotional panels, search introduction, and bottom safety box. Initial
browsing presents categories and the existing browse-all action. Product details now
show a single unboxed allergy summary with distinct ingredient-verification and allergen
coverage text, unchanged expanded match rows, and one packaging reminder. The separate
colored evidence panels were removed. Ingredient/declaration/precautionary/source
content remains available in disclosures; missing fields explicitly say unknown.
General explanations are consolidated in Settings → About FoodBuddy & Food Safety.
Home's repeated reminder was removed and demo availability uses simple divided rows.

TypeScript, 191 tests, and ESLint (0 errors, 15 advisory warnings) pass. Simulator UI
callbacks verified clean initial Shop browsing, Oreo/Goldfish/Cheerios detail disclosures,
source content, visible warnings, and the Settings safety section. A screenshot also
confirmed an actual saved-profile ingredient match remains expanded above the photo.
Matching/tolerance/derivative components were not edited. Physical touch and VoiceOver
remain manual checks. No dependencies, catalog records, or authentication code changed.
