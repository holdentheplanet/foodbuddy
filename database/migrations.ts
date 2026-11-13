import type { SQLiteDatabase } from 'expo-sqlite';

// Append migrations; never edit a migration after it has shipped.
// Version 1 adopts the original unversioned schema without rewriting its rows.
const migrations = [
  { version: 1, sql: `

    -- User accounts
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      profile_picture TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Existing user allergy selections
    CREATE TABLE IF NOT EXISTS user_allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      allergen TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      UNIQUE(user_id, allergen)
    );

    -- Searchable food allergy catalog
    CREATE TABLE IF NOT EXISTS allergens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_custom INTEGER NOT NULL DEFAULT 0
    );

    -- Allergen derivatives and alternative ingredient names
    CREATE TABLE IF NOT EXISTS allergen_derivatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allergen_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL COLLATE NOCASE,
      FOREIGN KEY (allergen_id) REFERENCES allergens(id)
        ON DELETE CASCADE,
      UNIQUE(allergen_id, ingredient_name)
    );

    -- Allergies saved to each user's profile
    CREATE TABLE IF NOT EXISTS user_allergy_profiles (
      user_id INTEGER NOT NULL,
      allergen_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, allergen_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      FOREIGN KEY (allergen_id) REFERENCES allergens(id)
        ON DELETE CASCADE
    );

    -- Indexes for faster ingredient and allergy searches
    CREATE INDEX IF NOT EXISTS idx_allergen_derivatives_name
      ON allergen_derivatives(ingredient_name);

    CREATE INDEX IF NOT EXISTS idx_user_allergy_profiles_user
      ON user_allergy_profiles(user_id);
  ` },
  { version: 2, sql: `
    CREATE TABLE products (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      brand TEXT,
      barcode TEXT CHECK (barcode IS NULL OR length(trim(barcode)) > 0),
      variant TEXT,
      image_reference TEXT,
      ingredient_label_text TEXT,
      ingredient_verification_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (ingredient_verification_status IN ('unknown', 'unverified', 'verified')),
      source_reference TEXT,
      last_verified_at TEXT,
      CHECK (last_verified_at IS NULL OR
        (last_verified_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
         AND date(last_verified_at) IS NOT NULL
         AND date(last_verified_at) = last_verified_at)),
      CHECK (ingredient_verification_status != 'verified' OR
        (ingredient_label_text IS NOT NULL AND length(trim(ingredient_label_text)) > 0
         AND source_reference IS NOT NULL AND length(trim(source_reference)) > 0
         AND last_verified_at IS NOT NULL))
    );

    CREATE TABLE product_ingredients (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      ingredient_name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(ingredient_name)) > 0),
      normalized_ingredient_name TEXT CHECK (normalized_ingredient_name IS NULL OR
        (length(normalized_ingredient_name) > 0
         AND normalized_ingredient_name = lower(trim(normalized_ingredient_name)))),
      UNIQUE (product_id, ingredient_name)
    );

    -- Missing rows and 'unknown' never mean an allergen is absent or a food is safe.
    -- Ingredient verification does not verify allergen/cross-contact declarations.
    CREATE TABLE product_allergens (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      allergen_id INTEGER REFERENCES allergens(id) ON DELETE RESTRICT,
      normalized_allergen_name TEXT CHECK (normalized_allergen_name IS NULL OR
        (length(normalized_allergen_name) > 0
         AND normalized_allergen_name = lower(trim(normalized_allergen_name)))),
      relationship_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (relationship_type IN ('contains', 'may_contain', 'unknown')),
      evidence_reference TEXT,
      CHECK (allergen_id IS NOT NULL OR normalized_allergen_name IS NOT NULL),
      CHECK (relationship_type = 'unknown' OR
        (evidence_reference IS NOT NULL AND length(trim(evidence_reference)) > 0))
    );

    CREATE TABLE stores (
      id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      chain TEXT,
      street_address TEXT NOT NULL CHECK (length(trim(street_address)) > 0),
      city TEXT NOT NULL CHECK (length(trim(city)) > 0),
      state TEXT NOT NULL CHECK (length(trim(state)) > 0),
      zip_code TEXT NOT NULL CHECK (length(trim(zip_code)) > 0),
      latitude REAL CHECK (latitude IS NULL OR
        (typeof(latitude) IN ('real', 'integer') AND latitude BETWEEN -90 AND 90)),
      longitude REAL CHECK (longitude IS NULL OR
        (typeof(longitude) IN ('real', 'integer') AND longitude BETWEEN -180 AND 180)),
      location_verification_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (location_verification_status IN ('unknown', 'unverified', 'verified')),
      location_source_reference TEXT,
      CHECK ((latitude IS NULL) = (longitude IS NULL)),
      CHECK (location_verification_status != 'verified' OR
        (latitude IS NOT NULL AND longitude IS NOT NULL
         AND location_source_reference IS NOT NULL
         AND length(trim(location_source_reference)) > 0))
    );

    -- This table exclusively holds simulated availability, never live stock.
    CREATE TABLE store_inventory (
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      availability_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (availability_status IN ('available', 'unavailable', 'unknown')),
      is_demo INTEGER NOT NULL DEFAULT 1 CHECK (is_demo = 1),
      PRIMARY KEY (store_id, product_id)
    );

    CREATE INDEX idx_products_name ON products(name COLLATE NOCASE);
    CREATE INDEX idx_products_brand ON products(brand COLLATE NOCASE);
    CREATE INDEX idx_products_barcode ON products(barcode);
    CREATE INDEX idx_product_ingredients_normalized
      ON product_ingredients(normalized_ingredient_name);
    CREATE INDEX idx_product_allergens_product ON product_allergens(product_id);
    CREATE UNIQUE INDEX idx_product_allergens_catalog_unique
      ON product_allergens(product_id, allergen_id) WHERE allergen_id IS NOT NULL;
    CREATE UNIQUE INDEX idx_product_allergens_name_unique
      ON product_allergens(product_id, normalized_allergen_name)
      WHERE normalized_allergen_name IS NOT NULL;
    CREATE INDEX idx_product_allergens_allergen ON product_allergens(allergen_id);
    CREATE INDEX idx_product_allergens_name ON product_allergens(normalized_allergen_name);
    CREATE INDEX idx_stores_name ON stores(name COLLATE NOCASE);
    CREATE INDEX idx_stores_coordinates ON stores(latitude, longitude);
    CREATE INDEX idx_store_inventory_product ON store_inventory(product_id);
  ` },
  { version: 3, sql: `
    -- Full reviewed source snapshots retain declarations and field-level uncertainty.
    -- JSON is data only; no downloaded HTML or remote scripts are executed.
    CREATE TABLE product_catalog_entries (
      product_id TEXT PRIMARY KEY NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      catalog_id TEXT NOT NULL CHECK (length(trim(catalog_id)) > 0),
      record_json TEXT NOT NULL CHECK (json_valid(record_json)),
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE product_catalog_revisions (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      catalog_id TEXT NOT NULL CHECK (length(trim(catalog_id)) > 0),
      record_json TEXT NOT NULL CHECK (json_valid(record_json)),
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (product_id, catalog_id, record_json)
    );
    CREATE INDEX idx_product_catalog_entries_catalog ON product_catalog_entries(catalog_id);
    CREATE INDEX idx_product_catalog_revisions_product ON product_catalog_revisions(product_id);
  ` },
  { version: 4, sql: `
    CREATE TABLE product_categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL UNIQUE
    );
    INSERT INTO product_categories(id, name, sort_order) VALUES
      ('snacks-candy', 'Snacks & Candy', 1), ('dairy-eggs', 'Dairy & Eggs', 2),
      ('breakfast', 'Breakfast', 3), ('bread-bakery', 'Bread & Bakery', 4),
      ('frozen-foods', 'Frozen Foods', 5), ('beverages', 'Beverages', 6),
      ('pantry', 'Pantry', 7), ('produce', 'Produce', 8),
      ('meat-seafood', 'Meat & Seafood', 9), ('condiments-dressings', 'Condiments & Dressings', 10);
    ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES product_categories(id) ON DELETE RESTRICT;
    -- Backfill classifications, never ingredient/allergen evidence or user records.
    UPDATE products SET category_id = (
      SELECT CASE json_extract(c.record_json, '$.category')
        WHEN 'cookies' THEN 'snacks-candy' WHEN 'crackers' THEN 'snacks-candy'
        WHEN 'chips' THEN 'snacks-candy' WHEN 'candy' THEN 'snacks-candy'
        WHEN 'snack-bars' THEN 'snacks-candy' WHEN 'cereal' THEN 'breakfast'
        WHEN 'dairy' THEN 'dairy-eggs' WHEN 'spreads' THEN 'pantry'
        WHEN 'pasta' THEN 'pantry' WHEN 'pantry-meals' THEN 'pantry'
        WHEN 'condiments' THEN 'condiments-dressings'
        ELSE (SELECT id FROM product_categories WHERE id = json_extract(c.record_json, '$.category'))
      END FROM product_catalog_entries c WHERE c.product_id = products.id
    ) WHERE category_id IS NULL;
    CREATE INDEX idx_products_category_name ON products(category_id, name COLLATE NOCASE, id);
  ` },
  { version: 5, sql: `
    CREATE TABLE store_catalog_entries (
      store_id TEXT PRIMARY KEY NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      catalog_id TEXT NOT NULL CHECK (length(trim(catalog_id)) > 0),
      record_json TEXT NOT NULL CHECK (json_valid(record_json)),
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE store_catalog_revisions (
      id INTEGER PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      catalog_id TEXT NOT NULL,
      record_json TEXT NOT NULL CHECK (json_valid(record_json)),
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(store_id, catalog_id, record_json)
    );
    CREATE INDEX idx_store_catalog_owner ON store_catalog_entries(catalog_id);
  ` },
  { version: 6, sql: `
    -- Keep legacy rows/statuses and all original foreign keys intact.
    ALTER TABLE store_inventory ADD COLUMN simulated_status TEXT NOT NULL DEFAULT 'unknown'
      CHECK (simulated_status IN ('in_stock','limited_stock','out_of_stock','unknown'));
    UPDATE store_inventory SET simulated_status=CASE availability_status
      WHEN 'available' THEN 'in_stock' WHEN 'unavailable' THEN 'out_of_stock' ELSE 'unknown' END;
    CREATE TABLE demo_inventory_entries (
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      seed_id TEXT NOT NULL CHECK(length(trim(seed_id)) > 0),
      PRIMARY KEY(store_id,product_id),
      FOREIGN KEY(store_id,product_id) REFERENCES store_inventory(store_id,product_id) ON DELETE CASCADE
    );
    CREATE INDEX idx_demo_inventory_seed ON demo_inventory_entries(seed_id);
  ` },
  { version: 7, sql: `
    CREATE TRIGGER IF NOT EXISTS check_demo_status_insert BEFORE INSERT ON store_inventory
    WHEN (NEW.simulated_status IN ('in_stock','limited_stock') AND NEW.availability_status != 'available')
      OR (NEW.simulated_status='out_of_stock' AND NEW.availability_status != 'unavailable')
    BEGIN SELECT RAISE(ABORT,'Inconsistent demo status'); END;
    CREATE TRIGGER IF NOT EXISTS check_demo_status_update BEFORE UPDATE ON store_inventory
    WHEN (NEW.simulated_status IN ('in_stock','limited_stock') AND NEW.availability_status != 'available')
      OR (NEW.simulated_status='out_of_stock' AND NEW.availability_status != 'unavailable')
    BEGIN SELECT RAISE(ABORT,'Inconsistent demo status'); END;

  ` },
  { version: 8, sql: `
    -- Custom allergens and derivatives are private to the user who made them.
    -- NULL user_id means built-in. Existing rows become built-in, definite terms.
    ALTER TABLE allergens ADD COLUMN user_id INTEGER DEFAULT NULL
      REFERENCES users(id) ON DELETE CASCADE;

    -- definite = always this allergen, possible = sometimes made from it,
    -- exclude = looks similar but is not (e.g. "cocoa butter" for milk).
    ALTER TABLE allergen_derivatives ADD COLUMN match_type TEXT NOT NULL DEFAULT 'definite'
      CHECK (match_type IN ('definite', 'possible', 'exclude'));
    ALTER TABLE allergen_derivatives ADD COLUMN note TEXT;
    ALTER TABLE allergen_derivatives ADD COLUMN user_id INTEGER DEFAULT NULL
      REFERENCES users(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_allergens_user ON allergens(user_id);
    CREATE INDEX IF NOT EXISTS idx_allergen_derivatives_allergen_user
      ON allergen_derivatives(allergen_id, user_id);
  ` },
  { version: 9, sql: `
    -- Each user's tolerance for individual derivative terms.
    -- No row means 'avoid' (the default), so new users are fully protected.
    -- avoid = flag per match_type, limit = caution at most, ok = ignore this term.
    -- Applies to derivative terms only, never to allergen names or declarations.
    CREATE TABLE user_derivative_preferences (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      derivative_id INTEGER NOT NULL REFERENCES allergen_derivatives(id) ON DELETE CASCADE,
      tolerance TEXT NOT NULL CHECK (tolerance IN ('avoid', 'limit', 'ok')),
      PRIMARY KEY (user_id, derivative_id)
    );
    CREATE INDEX idx_user_derivative_preferences_derivative
      ON user_derivative_preferences(derivative_id);
  ` },
] as const;

export const DATABASE_VERSION = migrations[migrations.length - 1].version;
type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync'>;
const pending = new WeakMap<MigrationDatabase, Promise<void>>();

/** Run before other database work. Does not seed or change existing user data. */
export function initializeDatabaseConnection(database: MigrationDatabase): Promise<void> {
  const running = pending.get(database);
  if (running) return running;

  const initialization = migrate(database).finally(() => pending.delete(database));
  pending.set(database, initialization);
  return initialization;
}

async function migrate(database: MigrationDatabase): Promise<void> {
  // These connection settings must be set BEFORE the transaction begins.
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const foreignKeys = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (foreignKeys?.foreign_keys !== 1) {
    throw new Error('Database initialization requires foreign key enforcement.');
  }

  // One connection and one write lock keep schema + version changes atomic.
  // App startup awaits initialization before catalog seeding or account queries.
  await database.execAsync('BEGIN IMMEDIATE');
  try {
    const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (!row) throw new Error('Could not read database schema version.');
    if (row.user_version > DATABASE_VERSION) {
      throw new Error(`Database version ${row.user_version} is newer than this app supports (${DATABASE_VERSION}).`);
    }
    for (const migration of migrations) {
      if (migration.version > row.user_version) {
        await database.execAsync(migration.sql);
        await database.execAsync(`PRAGMA user_version = ${migration.version}`);
      }
    }
    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK');
    throw error;
  }
}
