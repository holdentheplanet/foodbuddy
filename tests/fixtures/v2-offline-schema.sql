
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
