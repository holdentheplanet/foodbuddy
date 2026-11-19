const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const { initializeDatabaseConnection } = load(path.resolve('database/migrations.ts'));
const { importProductCatalog } = load(path.resolve('catalog/importer.ts'));
const { importStarterProductCatalog } = load(path.resolve('catalog/index.ts'));
const { reviewCandidateBatch } = load(path.resolve('catalog/review.ts'));
const { createLocalProductService } = load(path.resolve('services/localProductService.ts'));
const { canonicalRecord } = load(path.resolve('catalog/validation.ts'));
const candidates = require('../catalog/candidates/us-reviewed-batch-02.json');
const approved = require('../catalog/data/us-reviewed-batch-02.json');
const previous = ['us-starter', 'us-expansion-01', 'us-reviewed-batch-01'].map(n => require('../catalog/data/' + n + '.json'));
const priorProducts = previous.flatMap(c => c.products);
async function isolated(run) {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, args = []) { return db.prepare(sql).run(...args); },
    async getFirstAsync(sql, args = []) { return db.prepare(sql).get(...args) ?? null; },
    async getAllAsync(sql, args = []) { return db.prepare(sql).all(...args); },
  };
  try { await initializeDatabaseConnection(adapter); await run(db, adapter, createLocalProductService(adapter)); }
  finally { db.close(); }
}

test('batch 02 has 25 newly corroborated identities, five each in five smaller categories', () => {
  const result = reviewCandidateBatch(candidates, priorProducts, '2026-11-18');
  assert.deepEqual(result.held, []);
  assert.equal(canonicalRecord(result.catalog), canonicalRecord(approved));
  assert.equal(approved.products.length, 25);
  for (const category of ['dairy-eggs', 'frozen-foods', 'beverages', 'meat-seafood', 'condiments-dressings']) {
    assert.equal(approved.products.filter(p => p.category === category).length, 5);
  }
  assert(approved.products.every(p => p.ingredientVerificationStatus === 'verified' && p.ingredientLabelText));
  assert.equal(approved.products.filter(p => p.allergenStatus === 'documented').length, 16);
  assert.equal(approved.products.filter(p => p.barcode).length, 10);
});

test('batch 02 preserves unknown precautions and does not infer declarations from ingredients', () => {
  for (const product of approved.products) {
    assert.equal(product.precautionaryStatus, 'unknown');
    assert.equal(product.precautionaryStatement, null); assert.equal(product.precautionaryAllergens, null);
    assert.equal(product.completenessStatus, 'partial');
    assert(product.notes.includes('Check physical packaging'));
    if (product.allergenStatus === 'unknown') {
      assert.equal(product.allergenStatement, null); assert.equal(product.declaredAllergens, null);
    }
  }
  const tartar = approved.products.find(p => p.name.includes('Tartar'));
  assert.deepEqual(tartar.declaredAllergens, ['soy', 'eggs']);
  const fairlife = approved.products.filter(p => p.brand === 'fairlife');
  assert.equal(fairlife.length, 10);
  assert(fairlife.every(p => p.barcode === null && p.declaredAllergens[0] === 'milk'));
});

test('100-product import and repeats preserve all 75 existing product rows, children and provenance', async () => isolated(async (db, adapter) => {
  for (const manifest of previous) await importProductCatalog(adapter, manifest);
  const tables = ['products', 'product_ingredients', 'product_allergens', 'product_catalog_entries', 'product_catalog_revisions'];
  const snapshots = tables.map(t => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const imported = await importProductCatalog(adapter, approved);
  assert.equal(imported.inserted, 25); assert.equal(imported.updated, 0); assert.deepEqual(imported.skipped, []);
  const oldIds = new Set(priorProducts.map(p => p.id));
  for (let i = 0; i < tables.length; i++) {
    const rows = db.prepare(`SELECT * FROM ${tables[i]} ORDER BY 1`).all();
    assert.deepEqual(rows.filter(r => oldIds.has(tables[i] === 'products' ? r.id : r.product_id)), snapshots[i]);
  }
  const before = db.prepare('SELECT total_changes() n').get().n;
  for (const result of await Promise.all([importProductCatalog(adapter, approved), importProductCatalog(adapter, approved)])) {
    assert.equal(result.unchanged, 25); assert.equal(result.inserted, 0); assert.deepEqual(result.skipped, []);
  }
  assert.equal(db.prepare('SELECT total_changes() n').get().n, before);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 100);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
}));

test('batch 02 searches and exact ingredient/declaration evidence round-trip through SQLite', async () => isolated(async (_, adapter, service) => {
  await importStarterProductCatalog(adapter);
  for (const product of approved.products) {
    const details = await service.getProductById(product.id);
    assert.equal(details.ingredients.labelText, product.ingredientLabelText);
    assert.equal(details.ingredients.verifiedAt, '2026-11-18');
    assert.equal(details.ingredients.source.url, product.sources[0].url);
    assert.equal(details.allergens.precautionary.status, 'unknown');
    assert.equal(details.allergens.declared.statement, product.allergenStatement);
    assert.equal(details.requiresLabelReview, true);
    assert((await service.searchProductsByName(product.name.toLowerCase())).products.some(p => p.id === product.id));
    assert((await service.searchProductsByBrand(product.brand, { limit: 100 })).products.some(p => p.id === product.id));
    assert((await service.browseProducts(product.category, { limit: 100 })).products.some(p => p.id === product.id));
  }
  const pages = await Promise.all([service.browseProducts(null, { limit: 100 }), service.browseProducts(null, { limit: 100 })]);
  assert.deepEqual(pages[0], pages[1]); assert.equal(pages[0].products.length, 100);
}));

test('batch 02 imports preserve existing local account and allergy selection data', async () => isolated(async (db, adapter) => {
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(92,'Preserve','preserve92@example.invalid','opaque','file:///picture'); INSERT INTO user_allergies(user_id,allergen) VALUES(92,'Preserved selection');");
  const before = ['users', 'user_allergies'].map(t => db.prepare(`SELECT * FROM ${t}`).all());
  await importStarterProductCatalog(adapter); await importStarterProductCatalog(adapter);
  assert.deepEqual(['users', 'user_allergies'].map(t => db.prepare(`SELECT * FROM ${t}`).all()), before);
}));

test('batch 02 duplicates cannot bypass canonical GTIN protection under new names or IDs', async () => isolated(async (db, adapter) => {
  await importProductCatalog(adapter, approved);
  const original = approved.products.find(p => p.barcode);
  const duplicate = structuredClone(original);
  duplicate.id = 'batch02-duplicate-fixture'; duplicate.name = 'Different display name'; duplicate.variant = 'Different display variant';
  duplicate.barcode = original.barcode.slice(2);
  const result = await importProductCatalog(adapter, { ...approved, catalogId: 'duplicate-fixture', products: [duplicate] });
  assert.equal(result.inserted, 0); assert.match(result.skipped[0].reason, /Duplicate/);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 25);
}));
