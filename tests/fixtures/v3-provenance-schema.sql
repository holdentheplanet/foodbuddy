-- Frozen pre-category v3 provenance schema for upgrade regression testing.

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
