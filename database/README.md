# SQLite foundation

`db.ts` keeps opening the existing `foodbuddy.db`. Its initialization awaits
`initializeDatabaseConnection()` before the app seeds the existing allergy catalog
or restores the session. It now imports the bundled product catalog after migrations;
see `../catalog/README.md` for the evidence and import contract. Do not run other database work concurrently with startup
migrations or invoke initialization inside another transaction.

Migrations use `PRAGMA user_version`:

- **1**: adopts the original five account/allergy tables and their indexes using
  the original `CREATE TABLE IF NOT EXISTS` statements. No rows are rewritten.
- **2**: adds `products`, `product_ingredients`, `product_allergens`, `stores`,
  `store_inventory`, and their indexes.
- **3**: adds current catalog evidence and accepted revision snapshots in
  `product_catalog_entries` and `product_catalog_revisions`.

- **4**: adds the ten grocery categories, a nullable `products.category_id` foreign
  key and category/name index; backfills catalog assignments without changing
  ingredient/allergen evidence or legacy account tables.

- **5**: adds store ownership/source snapshots and accepted revision history in
  `store_catalog_entries` and `store_catalog_revisions`. Existing stores remain.

- **6**: adds explicit simulated stock statuses and inventory seed ownership while
  retaining the original inventory table, rows and foreign keys.
- **7**: enforces consistency between known simulated and legacy stock statuses.

Migrations insert no products, stores, inventory, allergens, ingredients, or user
data. Separate catalog importers insert bundled products, stores and deterministic demo inventory during app startup.
See `../stores/README.md` for store sources, foreground GPS and map limitations.

Append future migrations; do not edit shipped migrations. Foreign keys are enabled
on the original connection before a `BEGIN IMMEDIATE` transaction. All pending DDL
and version updates commit together or roll back together. Concurrent initialization
calls using that connection share one promise. A newer schema or a conflicting
unversioned offline table fails rather than overwriting unfamiliar data.

## Data contract

- Product and store IDs are stable nonblank text identifiers. Barcodes and ZIP
  codes are text, preserving leading zeroes. Barcode lookup is indexed but not
  unique because package/market variants can share catalog identifiers.
- Ingredient label text preserves the source label. Parsed ingredients are
  separate records; optional normalized names use lowercase, trimmed text.
- Ingredient verification defaults to `unknown`; `unverified` is available for
  imported records pending review. `verified` requires nonblank label text,
  a source reference, and a valid `YYYY-MM-DD` verification date. These constraints
  enforce record completeness, not the truth of a verification claim.
- Product allergens reference the existing catalog and/or a lowercase normalized
  name. Relationships default to `unknown`. `contains` and `may_contain` require
  evidence. Referenced catalog allergens are protected from deletion.
- **No allergen rows, an `unknown` relationship, or verified ingredient text never
  prove a product is safe.** This foundation does not replace or change the current
  allergy checker. Future local queries must retain uncertainty and review sources.
- Store coordinates can be omitted together. Present coordinates must be numeric
  and within latitude/longitude ranges. A verified location requires coordinates
  and a source; importing code must verify the real location independently.
- Inventory is separate from product evidence. Availability defaults to `unknown`;
  allowed values are `available`, `unavailable`, and `unknown`. `is_demo` is always
  `1`, enforced by a constraint. Future UI must label it **Demo inventory — simulated,
  not live availability**. Availability conveys nothing about allergy safety.
- Deleting a product or store cascades only to its dependent offline rows. No new
  table cascades deletions into users or existing allergy tables.

## Isolated tests

From the project root with the installed Node 22 runtime:

```sh
node --experimental-sqlite --test tests/database.test.cjs tests/catalog.test.cjs
npx --no-install tsc --noEmit --incremental false
```

Tests transpile the production migration module using the existing TypeScript
installation, and run its SQL/transaction logic against real Node SQLite databases.
The legacy fixture is a snapshot of the original schema, not a second app schema.
All fixture records are synthetic, test-only data. Tests use memory databases plus
one isolated file database retained under the system temporary directory. They never
open or reset `foodbuddy.db`, simulator databases, SecureStore, or profile pictures.
These tests do not exercise Expo's native bridge on iOS or Android.

See `../inventory/README.md` for demo-only statuses, seed ownership and inventory browsing.
