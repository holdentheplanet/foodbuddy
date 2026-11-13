// Run with Node 22: node --experimental-sqlite --test tests/database.test.cjs
// Executes the production migration runner and SQL using isolated real SQLite DBs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const migrationPath = path.resolve(__dirname, '../database/migrations.ts');
const compiled = ts.transpileModule(readFileSync(migrationPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(migrationPath, module);
loaded._compile(compiled, migrationPath);
const { initializeDatabaseConnection: initialize, DATABASE_VERSION } = loaded.exports;
const legacySQL = readFileSync(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8');

function adapter(db) {
  return {
    async execAsync(sql) { db.exec(sql); },
    async getFirstAsync(sql) { return db.prepare(sql).get() ?? null; },
  };
}
function version(db) { return db.prepare('PRAGMA user_version').get().user_version; }
// Original legacy columns only: migration 8 adds columns to allergens and
// allergen_derivatives, but must never change or lose the original values.
const LEGACY_COLUMNS = {
  users: 'id, username, email, password_hash, profile_picture, created_at',
  user_allergies: 'id, user_id, allergen',
  allergens: 'id, name, is_custom',
  allergen_derivatives: 'id, allergen_id, ingredient_name',
  user_allergy_profiles: 'user_id, allergen_id',
};
// Tables whose definitions migration 8 intentionally extends with ADD COLUMN.
const EXTENDED_TABLES = new Set(['allergens', 'allergen_derivatives']);
function snapshot(db) {
  return Object.entries(LEGACY_COLUMNS).map(([table, columns]) =>
    db.prepare(`SELECT ${columns} FROM ${table} ORDER BY 1, 2`).all());
}
function seedLegacy(db) {
  db.exec(legacySQL);
  // Synthetic test-only values, never imported or seeded by the app.
  db.exec(`
    INSERT INTO users(id, username, email, password_hash, profile_picture, created_at)
      VALUES(42, 'fixture user', 'fixture@example.invalid', 'opaque-existing-hash',
             'file:///fixture/profile.png', '2000-01-01');
    INSERT INTO allergens(id, name, is_custom) VALUES(13, 'Fixture custom allergen', 1);
    INSERT INTO allergen_derivatives(id, allergen_id, ingredient_name)
      VALUES(8, 13, 'Fixture derivative');
    INSERT INTO user_allergies(id, user_id, allergen) VALUES(4, 42, 'Legacy fixture allergy');
    INSERT INTO user_allergy_profiles(user_id, allergen_id) VALUES(42, 13);
  `);
}
function product(db) { db.exec("INSERT INTO products(id, name) VALUES('fixture-p', 'Synthetic test product')"); }
function store(db) {
  db.exec(`INSERT INTO stores(id, name, street_address, city, state, zip_code)
    VALUES('fixture-s', 'Synthetic test store', 'Test-only address', 'Test city', 'Test state', 'Test ZIP')`);
}

test('fresh database initializes all tables, indexes, unknown defaults, and no catalog records', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initialize(adapter(db));
    assert.equal(version(db), DATABASE_VERSION);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    for (const table of ['users', 'allergens', 'products', 'product_ingredients', 'product_allergens', 'stores', 'store_inventory']) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
    }
    product(db); store(db);
    assert.equal(db.prepare('SELECT ingredient_verification_status AS s FROM products').get().s, 'unknown');
    assert.equal(db.prepare('SELECT location_verification_status AS s FROM stores').get().s, 'unknown');
    db.exec("INSERT INTO store_inventory(store_id, product_id) VALUES('fixture-s', 'fixture-p')");
    assert.deepEqual({ ...db.prepare('SELECT availability_status, is_demo FROM store_inventory').get() },
      { availability_status: 'unknown', is_demo: 1 });
    assert.equal(db.prepare('SELECT count(*) AS n FROM product_allergens').get().n, 0);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'idx_stores_coordinates'").get());
  } finally { db.close(); }
});

test('unversioned legacy data and original table definitions survive migration and repeated initialization', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    seedLegacy(db);
    const before = snapshot(db);
    const schema = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const connection = adapter(db);
    await initialize(connection);
    product(db); store(db);
    for (let i = 0; i < 3; i++) await initialize(connection);
    assert.deepEqual(snapshot(db), before);
    for (const table of schema) {
      const sql = db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table.name).sql;
      if (EXTENDED_TABLES.has(table.name)) {
        // ADD COLUMN only appends; every original column definition must remain.
        const originalColumns = table.sql.match(/^\s+\w+ (INTEGER|TEXT)[^\n]*/gm);
        for (const column of originalColumns) assert.ok(sql.includes(column.trim()), column);
      } else {
        assert.equal(sql, table.sql);
      }
    }
    assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM stores').get().n, 1);
    assert.equal(version(db), DATABASE_VERSION);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('already-versioned baseline upgrades from version 1', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    seedLegacy(db); db.exec('PRAGMA user_version=1');
    const before = snapshot(db);
    await initialize(adapter(db));
    assert.equal(version(db), DATABASE_VERSION);
    assert.deepEqual(snapshot(db), before);
  } finally { db.close(); }
});

test('foreign keys reject orphan rows; catalog allergens referenced by products cannot be deleted', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initialize(adapter(db)); product(db); store(db);
    for (const sql of [
      "INSERT INTO product_ingredients(product_id, ingredient_name) VALUES('missing', 'test')",
      "INSERT INTO product_allergens(product_id, normalized_allergen_name) VALUES('missing', 'test')",
      "INSERT INTO product_allergens(product_id, allergen_id) VALUES('fixture-p', 999)",
      "INSERT INTO store_inventory(store_id, product_id) VALUES('missing', 'fixture-p')",
      "INSERT INTO store_inventory(store_id, product_id) VALUES('fixture-s', 'missing')",
    ]) assert.throws(() => db.exec(sql), /FOREIGN KEY/);
    db.exec("INSERT INTO allergens(id, name) VALUES(1, 'Fixture allergen')");
    db.exec("INSERT INTO product_allergens(product_id, allergen_id) VALUES('fixture-p', 1)");
    assert.throws(() => db.exec('DELETE FROM allergens WHERE id=1'), /FOREIGN KEY/);
  } finally { db.close(); }
});

test('verification, relationship, coordinate, demo-only, required-field and uniqueness constraints', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initialize(adapter(db)); product(db); store(db);
    const invalid = [
      "INSERT INTO products(id, name) VALUES('fixture-p', 'duplicate')",
      "INSERT INTO products(id, name) VALUES(NULL, 'invalid')",
      "UPDATE products SET name=' '",
      "UPDATE products SET ingredient_verification_status='safe'",
      "UPDATE products SET ingredient_verification_status='verified'",
      "UPDATE products SET last_verified_at='not-a-date'",
      "UPDATE products SET last_verified_at='2026-02-30'",
      "UPDATE stores SET latitude=91, longitude=0",
      "UPDATE stores SET latitude=0, longitude=-181",
      "UPDATE stores SET latitude='not-coordinates', longitude=0",
      "UPDATE stores SET latitude=0",
      "UPDATE stores SET location_verification_status='verified'",
      "UPDATE stores SET location_verification_status='live'",
      "INSERT INTO product_allergens(product_id) VALUES('fixture-p')",
      "INSERT INTO product_allergens(product_id, normalized_allergen_name) VALUES('fixture-p', ' Unnormalized ')",
      "INSERT INTO product_allergens(product_id, normalized_allergen_name, relationship_type) VALUES('fixture-p', 'test', 'safe')",
      "INSERT INTO product_allergens(product_id, normalized_allergen_name, relationship_type) VALUES('fixture-p', 'test', 'contains')",
      "INSERT INTO store_inventory(store_id, product_id, is_demo) VALUES('fixture-s', 'fixture-p', 0)",
      "INSERT INTO store_inventory(store_id, product_id, availability_status) VALUES('fixture-s', 'fixture-p', 'live')",
    ];
    for (const sql of invalid) assert.throws(() => db.exec(sql), undefined, sql);
    db.exec("INSERT INTO product_ingredients(product_id, ingredient_name) VALUES('fixture-p', 'Fixture ingredient')");
    assert.throws(() => db.exec("INSERT INTO product_ingredients(product_id, ingredient_name) VALUES('fixture-p', 'fixture ingredient')"), /UNIQUE/);
    db.exec("INSERT INTO product_allergens(product_id, normalized_allergen_name, relationship_type, evidence_reference) VALUES('fixture-p', 'fixture allergen', 'contains', 'test-only evidence')");
    assert.throws(() => db.exec("INSERT INTO product_allergens(product_id, normalized_allergen_name) VALUES('fixture-p', 'fixture allergen')"), /UNIQUE/);
    db.exec("INSERT INTO store_inventory(store_id, product_id) VALUES('fixture-s', 'fixture-p')");
    assert.throws(() => db.exec("INSERT INTO store_inventory(store_id, product_id) VALUES('fixture-s', 'fixture-p')"), /UNIQUE/);
    // Simulated availability must not change verification or create allergen claims.
    db.exec("UPDATE store_inventory SET availability_status='available'");
    assert.equal(db.prepare('SELECT ingredient_verification_status AS s FROM products').get().s, 'unknown');
    db.exec("DELETE FROM products WHERE id='fixture-p'");
    for (const table of ['product_ingredients', 'product_allergens', 'store_inventory']) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
    }
  } finally { db.close(); }
});

test('version 8 keeps legacy allergy rows as built-in definite terms and validates match_type', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    seedLegacy(db); db.exec('PRAGMA user_version=7');
    // Version 7 databases already have the offline tables; only 8 should run.
    await initialize(adapter(db));
    assert.equal(version(db), DATABASE_VERSION);
    assert.deepEqual({ ...db.prepare('SELECT user_id FROM allergens WHERE id = 13').get() }, { user_id: null });
    assert.deepEqual({ ...db.prepare('SELECT match_type, note, user_id FROM allergen_derivatives WHERE id = 8').get() },
      { match_type: 'definite', note: null, user_id: null });
    db.exec("INSERT INTO allergen_derivatives(allergen_id, ingredient_name, match_type, note, user_id) VALUES(13, 'Fixture possible', 'possible', 'Synthetic note', 42)");
    assert.throws(() => db.exec("INSERT INTO allergen_derivatives(allergen_id, ingredient_name, match_type) VALUES(13, 'Bad type', 'maybe')"), /CHECK constraint failed/);
    // Deleting a user removes only that user's private derivative.
    db.exec('DELETE FROM users WHERE id = 42');
    assert.equal(db.prepare("SELECT count(*) AS n FROM allergen_derivatives WHERE ingredient_name = 'Fixture possible'").get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM allergen_derivatives WHERE id = 8').get().n, 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('migration failure rolls back DDL and version, preserves legacy data, and permits retry', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    seedLegacy(db);
    const before = snapshot(db);
    const connection = adapter(db);
    let fail = true;
    const original = connection.execAsync;
    connection.execAsync = async sql => {
      await original(sql);
      if (fail && sql.includes('CREATE TABLE products')) {
        fail = false;
        throw new Error('injected migration failure');
      }
    };
    await assert.rejects(initialize(connection), /injected/);
    assert.equal(version(db), 0);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='products'").get(), undefined);
    assert.deepEqual(snapshot(db), before);
    await initialize(connection);
    assert.equal(version(db), DATABASE_VERSION);
    assert.deepEqual(snapshot(db), before);
  } finally { db.close(); }
});

test('unrecognized table collisions fail safely instead of silently adopting incompatible schema', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    seedLegacy(db);
    db.exec("CREATE TABLE products(teammate_note TEXT); INSERT INTO products VALUES('preserve this')");
    const before = snapshot(db);
    await assert.rejects(initialize(adapter(db)), /already exists/);
    assert.equal(version(db), 0);
    assert.equal(db.prepare('SELECT teammate_note FROM products').get().teammate_note, 'preserve this');
    assert.deepEqual(snapshot(db), before);
  } finally { db.close(); }
});

test('future schema versions are rejected without resetting their version or rows', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    seedLegacy(db); db.exec('PRAGMA user_version=999');
    const before = snapshot(db);
    await assert.rejects(initialize(adapter(db)), /newer than this app supports/);
    assert.equal(version(db), 999);
    assert.deepEqual(snapshot(db), before);
  } finally { db.close(); }
});

test('concurrent calls on one connection share initialization', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const connection = adapter(db);
    const first = initialize(connection);
    assert.equal(initialize(connection), first);
    await Promise.all([first, initialize(connection)]);
    assert.equal(version(db), DATABASE_VERSION);
  } finally { db.close(); }
});

test('migration persists after closing and reopening an isolated file database', async () => {
  // Intentionally retained in the system temp directory; never opens simulator DBs.
  const filename = path.join(mkdtempSync(path.join(tmpdir(), 'foodbuddy-migration-')), 'isolated.db');
  let db = new DatabaseSync(filename);
  try {
    seedLegacy(db);
    const before = snapshot(db);
    await initialize(adapter(db));
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    db.close();
    db = new DatabaseSync(filename);
    await initialize(adapter(db));
    assert.equal(version(db), DATABASE_VERSION);
    assert.deepEqual(snapshot(db), before);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { db.close(); }
});
