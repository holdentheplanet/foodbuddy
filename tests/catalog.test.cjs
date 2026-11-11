const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const { initializeDatabaseConnection: initialize, DATABASE_VERSION } = load(path.join(root, 'database/migrations.ts'));
const { importProductCatalog: importCatalog } = load(path.join(root, 'catalog/importer.ts'));
const { validateProductCatalog, ingredientSegments, canonicalRecord } = load(path.join(root, 'catalog/validation.ts'));
const catalog = require('../catalog/data/us-starter.json');
const today = '2026-11-10';
const copy = value => JSON.parse(JSON.stringify(value));
const one = () => ({ ...copy(catalog), products: [copy(catalog.products[0])] });
function connection(db) {
  return {
    async execAsync(sql) { db.exec(sql); },
    async getFirstAsync(sql, params = []) { return db.prepare(sql).get(...params) ?? null; },
    async runAsync(sql, params = []) { return db.prepare(sql).run(...params); },
  };
}
function counts(db) {
  return ['products', 'product_ingredients', 'product_allergens', 'product_catalog_entries', 'product_catalog_revisions']
    .map(table => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
}
async function isolated(run) {
  const db = new DatabaseSync(':memory:');
  try { const conn = connection(db); await initialize(conn); await run(db, conn); } finally { db.close(); }
}

test('bundled manifest has 20 products, ten requested brands, 14 verified ingredient labels, six manual reviews', () => {
  const valid = validateProductCatalog(catalog, today);
  assert.equal(valid.products.length, 20);
  assert.equal(valid.products.filter(p => p.ingredientVerificationStatus === 'verified').length, 14);
  assert.equal(valid.products.filter(p => p.ingredientVerificationStatus === 'unverified').length, 6);
  for (const brand of ['OREO', 'Pepperidge Farm', 'Cheerios', 'RITZ', 'Jif', "Lay's", 'Doritos', 'Kraft', 'SKIPPY', 'Nature Valley']) {
    assert.ok(valid.products.some(p => p.brand === brand), brand);
  }
});

test('imports catalog into SQLite; repeat and concurrent imports do not duplicate any rows or provenance', async () => isolated(async (db, conn) => {
  const first = await importCatalog(conn, catalog, today);
  assert.deepEqual(first, { inserted: 20, updated: 0, unchanged: 0, skipped: [] });
  const before = counts(db);
  assert.ok(before[1] > 0 && before[2] > 0);
  const results = await Promise.all([importCatalog(conn, catalog, today), importCatalog(conn, catalog, today)]);
  for (const result of results) assert.equal(result.unchanged, 20);
  assert.deepEqual(counts(db), before);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare('SELECT count(*) AS n FROM stores').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM store_inventory').get().n, 0);
}));

test('missing labels and unknown declarations stay null and never create safe/absent allergen assertions', async () => isolated(async (db, conn) => {
  await importCatalog(conn, catalog, today);
  for (const record of catalog.products.filter(p => p.ingredientLabelText === null)) {
    const row = db.prepare('SELECT ingredient_label_text, last_verified_at, ingredient_verification_status FROM products WHERE id=?').get(record.id);
    assert.equal(row.ingredient_label_text, null);
    assert.equal(row.last_verified_at, null);
    assert.equal(row.ingredient_verification_status, 'unverified');
    assert.equal(db.prepare('SELECT count(*) AS n FROM product_ingredients WHERE product_id=?').get(record.id).n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM product_allergens WHERE product_id=?').get(record.id).n, 0);
    const metadata = JSON.parse(db.prepare('SELECT record_json FROM product_catalog_entries WHERE product_id=?').get(record.id).record_json);
    assert.equal(metadata.declaredAllergens, null);
    assert.equal(metadata.allergenStatus, 'unknown');
  }
  const rice = db.prepare("SELECT record_json FROM product_catalog_entries WHERE product_id='rice-chex'").get();
  assert.equal(JSON.parse(rice.record_json).allergenStatus, 'unknown');
  const cheerios = db.prepare("SELECT record_json FROM product_catalog_entries WHERE product_id='cheerios-original-8-9oz'").get();
  assert.equal(JSON.parse(cheerios.record_json).precautionaryStatus, 'unknown');
}));

test('rejects incomplete verification, fabricated assertions, untrusted URLs, bad dates, and bad barcodes before writes', async () => isolated(async (db, conn) => {
  const mutations = [
    p => { p.ingredientLabelText = null; },
    p => { p.verifiedAt = null; },
    p => { p.sources[0].evidence = 'No label evidence'; },
    p => { p.sources[0].url = 'https://example.invalid/product'; },
    p => { p.sources[0].url = 'http://www.oreo.com/product'; },
    p => { p.verifiedAt = '2026-02-30'; },
    p => { p.sources[0].checkedAt = '2026-11-11'; },
    p => { p.declaredAllergens.push('shellfish'); },
    p => { p.declaredAllergens = []; },
    p => { p.precautionaryAllergens = []; },
    p => { p.barcode = '123456789012'; p.barcodeSourceId = 'primary'; },
    p => { p.allergenStatement = null; },
    p => { p.completenessStatus = 'complete'; },
    p => { p.sources[0].reviewStatus = 'unavailable'; },
  ];
  for (const mutate of mutations) {
    const input = one(); mutate(input.products[0]);
    assert.throws(() => importCatalog(conn, input, today));
    assert.deepEqual(counts(db), [0, 0, 0, 0, 0]);
  }
  const duplicates = one(); duplicates.products.push(copy(duplicates.products[0]));
  assert.throws(() => importCatalog(conn, duplicates, today), /duplicate/);
}));

test('exact existing allergen catalog names are reused; custom profiles and unverified derivatives are not used or changed', async () => isolated(async (db, conn) => {
  db.exec(`INSERT INTO users(id, username, email, password_hash, profile_picture) VALUES(42, 'Legacy', 'test@example.invalid', 'preserved hash', 'file:///preserved.png');
    INSERT INTO allergens(id, name, is_custom) VALUES(1, 'Milk', 0), (2, 'Soy', 0), (3, 'Wheat', 0), (4, 'Peanuts', 0), (5, 'Custom fixture', 1);
    INSERT INTO user_allergies(user_id, allergen) VALUES(42, 'Legacy fixture');
    INSERT INTO user_allergy_profiles(user_id, allergen_id) VALUES(42, 5);
    INSERT INTO allergen_derivatives(allergen_id, ingredient_name) VALUES(5, 'Sugar');`);
  const tables = ['users', 'user_allergies', 'allergens', 'allergen_derivatives', 'user_allergy_profiles'];
  const snapshot = () => tables.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all());
  const before = snapshot();
  await importCatalog(conn, catalog, today);
  assert.deepEqual(snapshot(), before);
  assert.equal(db.prepare("SELECT allergen_id FROM product_allergens WHERE product_id='oreo-original-family' AND normalized_allergen_name='wheat'").get().allergen_id, 3);
  assert.equal(db.prepare("SELECT allergen_id FROM product_allergens WHERE product_id='cheerios-honey-nut-10-8oz'").get().allergen_id, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM product_allergens WHERE allergen_id=5').get().n, 0);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.throws(() => db.exec("INSERT INTO product_catalog_entries(product_id,catalog_id,record_json) VALUES('missing','test','{}')"), /FOREIGN KEY/);
}));

test('precautionary declarations remain separate from contains and preserve original wording', async () => isolated(async (db, conn) => {
  await importCatalog(conn, catalog, today);
  const rows = db.prepare("SELECT normalized_allergen_name AS name, relationship_type AS type FROM product_allergens WHERE product_id='nature-valley-oats-honey-17-88oz' ORDER BY name").all();
  assert.deepEqual(rows.map(row => ({ ...row })), [
    { name: 'almond', type: 'may_contain' }, { name: 'peanuts', type: 'may_contain' },
    { name: 'pecan', type: 'may_contain' }, { name: 'soy', type: 'contains' },
  ]);
}));

test('incomplete and older records cannot overwrite verified evidence or history', async () => isolated(async (db, conn) => {
  await importCatalog(conn, one(), today);
  const before = db.prepare('SELECT * FROM products').all();
  const incomplete = one(); const p = incomplete.products[0];
  p.ingredientVerificationStatus = 'unverified'; p.ingredientLabelText = null; p.ingredientSourceId = null;
  p.verifiedAt = null; p.completenessStatus = 'unverified';
  const result = await importCatalog(conn, incomplete, today);
  assert.equal(result.skipped.length, 1);
  const older = one(); older.products[0].verifiedAt = '2026-11-09'; older.products[0].sources[0].checkedAt = '2026-11-09';
  assert.equal((await importCatalog(conn, older, today)).skipped.length, 1);
  const lessComplete = one(); lessComplete.products[0].allergenStatement = null; lessComplete.products[0].allergenStatus = 'unknown';
  lessComplete.products[0].declaredAllergens = null; lessComplete.products[0].allergenSourceId = null;
  assert.equal((await importCatalog(conn, lessComplete, today)).skipped.length, 1);
  assert.deepEqual(db.prepare('SELECT * FROM products').all(), before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM product_catalog_revisions').get().n, 1);
}));

test('owned catalog updates retain revision history; unrelated products cannot be taken over', async () => isolated(async (db, conn) => {
  await importCatalog(conn, one(), today);
  const updated = one(); updated.products[0].notes += ' Editorial provenance clarification.';
  assert.equal((await importCatalog(conn, updated, today)).updated, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM product_catalog_revisions').get().n, 2);
  assert.equal((await importCatalog(conn, updated, today)).unchanged, 1);
  const foreign = one(); foreign.catalogId = 'other-catalog';
  assert.equal((await importCatalog(conn, foreign, today)).skipped.length, 1);
  const manual = one(); manual.products[0].id = 'manual-product';
  db.exec("INSERT INTO products(id,name) VALUES('manual-product','Keep manual record')");
  assert.equal((await importCatalog(conn, manual, today)).skipped.length, 1);
  assert.equal(db.prepare("SELECT name FROM products WHERE id='manual-product'").get().name, 'Keep manual record');
}));

test('late SQL failure rolls back entire catalog and retry succeeds', async () => isolated(async (db, conn) => {
  const original = conn.runAsync;
  let fail = true;
  conn.runAsync = async (sql, params) => {
    if (fail && params?.[0] === 'jif-creamy') { fail = false; throw new Error('test failure'); }
    return original(sql, params);
  };
  await assert.rejects(importCatalog(conn, catalog, today), /test failure/);
  assert.deepEqual(counts(db), [0,0,0,0,0]);
  assert.equal((await importCatalog(conn, catalog, today)).inserted, 20);
}));

test('v2 database upgrades additively to provenance schema and retain existing products', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8'));
    db.exec(readFileSync(path.join(__dirname, 'fixtures/v2-offline-schema.sql'), 'utf8'));
    db.exec("INSERT INTO products(id,name) VALUES('manual-product','Preserve me'); PRAGMA user_version=2");
    await initialize(connection(db));
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, DATABASE_VERSION);
    assert.equal(db.prepare("SELECT name FROM products WHERE id='manual-product'").get().name, 'Preserve me');
  } finally { db.close(); }
});

test('ingredient segments retain nested labels and reject unbalanced delimiters', () => {
  assert.deepEqual(ingredientSegments('INGREDIENTS: Flour (Wheat, [Iron]), Salt, Salt'), ['Flour (Wheat, [Iron])', 'Salt']);
  assert.throws(() => ingredientSegments('Flour (Wheat, Salt'), /unbalanced/);
  assert.equal(canonicalRecord({ b: 1, a: 2 }), canonicalRecord({ a: 2, b: 1 }));
});
