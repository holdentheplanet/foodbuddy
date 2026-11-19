const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const { reviewCandidateBatch } = load(path.resolve('catalog/review.ts'));
const { canonicalBarcode, duplicateProduct } = load(path.resolve('catalog/identity.ts'));
const { canonicalRecord } = load(path.resolve('catalog/validation.ts'));
const { initializeDatabaseConnection } = load(path.resolve('database/migrations.ts'));
const { importProductCatalog } = load(path.resolve('catalog/importer.ts'));
const { importStarterProductCatalog } = load(path.resolve('catalog/index.ts'));
const { createLocalProductService } = load(path.resolve('services/localProductService.ts'));
const batch = require('../catalog/candidates/us-reviewed-batch-01.json');
const approved = require('../catalog/data/us-reviewed-batch-01.json');
const originals = ['us-starter', 'us-expansion-01'].map(n => require('../catalog/data/' + n + '.json'));
const oldProducts = originals.flatMap(c => c.products);
const copy = value => structuredClone(value);
const one = () => ({ ...copy(batch), candidates: [copy(batch.candidates[0])] });
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

test('25 reviewed candidates generate exactly the approved manifest, across five categories', () => {
  const result = reviewCandidateBatch(batch, oldProducts, '2026-11-18');
  assert.deepEqual(result.held, []);
  assert.equal(result.catalog.products.length, 25);
  assert.equal(new Set(result.catalog.products.map(p => p.category)).size, 5);
  assert.equal(canonicalRecord(result.catalog), canonicalRecord(approved));
  assert.equal(approved.products.filter(p => p.barcode).length, 5);
});

test('candidate data and ingredient text alone cannot bypass review approval', () => {
  for (const decision of ['needs_review', 'rejected']) {
    const input = one(); input.candidates[0].review.decision = decision;
    const result = reviewCandidateBatch(input, oldProducts);
    assert.equal(result.catalog.products.length, 0);
    assert.equal(result.held[0].decision, decision);
  }
  for (const mutate of [
    r => { r.review.ingredientTextCorroborated = false; },
    r => { r.review.reviewedAt = null; },
    r => { r.review.identityEvidence = 'Unrelated product'; },
    r => { r.product.brand = 'Uncorroborated brand'; },
    r => { r.review.brandEvidence = null; },
    r => { r.review.sourceCaptureSha256 = null; },
    r => { r.product.sources[0].reviewStatus = 'identity_only'; },
    r => { r.product.ingredientLabelText = null; },
    r => { r.product.verifiedAt = '2099-01-01'; },
    r => { r.product.sources[0].url = 'https://example.invalid/product'; },
  ]) {
    const input = one(); mutate(input.candidates[0]);
    const result = reviewCandidateBatch(input, oldProducts, '2026-11-18');
    assert.equal(result.catalog.products.length, 0);
    assert.equal(result.held.length, 1);
  }
});

test('candidate duplicate protection checks IDs, normalized identity, and UPC/GTIN padding', () => {
  const a = approved.products.find(p => p.barcode);
  const b = copy(a); b.id = 'different-id'; b.name = 'Different display name';
  b.barcode = a.barcode.slice(2);
  assert.equal(canonicalBarcode(a.barcode), canonicalBarcode(b.barcode));
  assert.equal(duplicateProduct(a, b), true);
  b.barcode = null; b.name = a.name.toUpperCase(); b.variant = '  ' + a.variant + '  ';
  assert.equal(duplicateProduct(a, b), true);
  b.brand = 'Different brand'; assert.equal(duplicateProduct(a, b), false);
  const repeated = copy(batch); repeated.candidates.push(copy(batch.candidates[0]));
  const result = reviewCandidateBatch(repeated, oldProducts);
  assert.equal(result.catalog.products.length, 25); assert.equal(result.held.length, 1);
  assert.equal(reviewCandidateBatch(one(), [one().candidates[0].product]).catalog.products.length, 0);
});

test('SQLite imports 25 additions, repeats without writes, and preserves all 50 original rows and provenance', async () => isolated(async (db, adapter) => {
  for (const manifest of originals) await importProductCatalog(adapter, manifest);
  const tables = ['products', 'product_ingredients', 'product_allergens', 'product_catalog_entries', 'product_catalog_revisions'];
  const snapshots = tables.map(t => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const result = await importProductCatalog(adapter, approved);
  assert.equal(result.inserted, 25); assert.deepEqual(result.skipped, []);
  const oldIds = new Set(oldProducts.map(p => p.id));
  for (let i = 0; i < tables.length; i++) {
    const rows = db.prepare(`SELECT * FROM ${tables[i]} ORDER BY 1`).all();
    assert.deepEqual(rows.filter(r => oldIds.has(tables[i] === 'products' ? r.id : r.product_id)), snapshots[i]);
  }
  const changes = db.prepare('SELECT total_changes() n').get().n;
  assert.equal((await importProductCatalog(adapter, approved)).unchanged, 25);
  assert.equal(db.prepare('SELECT total_changes() n').get().n, changes);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 75);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
}));

test('SQLite blocks cross-catalog normalized identity and equivalent barcode duplicates', async () => isolated(async (db, adapter) => {
  const product = copy(approved.products.find(p => p.barcode));
  const manifest = { formatVersion: 1, catalogId: 'duplicate-fixture', products: [product] };
  await importProductCatalog(adapter, manifest);
  const identity = copy(product); identity.id = 'identity-duplicate'; identity.barcode = null; identity.barcodeSourceId = null;
  identity.name = identity.name.toUpperCase(); identity.packageSize = null;
  const barcode = copy(product); barcode.id = 'barcode-duplicate'; barcode.name = 'Different name'; barcode.variant = 'Different variant';
  barcode.barcode = product.barcode.slice(2); // still present as an exact substring in the evidence
  for (const candidate of [identity, barcode]) {
    const result = await importProductCatalog(adapter, { ...manifest, catalogId: 'another-catalog', products: [candidate] });
    assert.equal(result.inserted, 0); assert.match(result.skipped[0].reason, /Duplicate/);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 1);
}));

test('new products are searchable offline by name, brand, and category; all ingredient evidence round-trips', async () => isolated(async (_, adapter, service) => {
  await importStarterProductCatalog(adapter);
  for (const product of approved.products) {
    const detail = await service.getProductById(product.id);
    assert.equal(detail.ingredients.labelText, product.ingredientLabelText);
    assert.equal(detail.ingredients.verificationStatus, 'verified');
    assert.equal(detail.provenance.packageSize, product.packageSize);
    assert.equal(detail.imageReference, null);
    assert.equal(detail.requiresLabelReview, true);
    assert((await service.searchProductsByName(product.name)).products.some(p => p.id === product.id));
    assert((await service.searchProductsByBrand(product.brand)).products.some(p => p.id === product.id));
    assert((await service.browseProducts(product.category, { limit: 100 })).products.some(p => p.id === product.id));
  }
}));

test('unknown declarations stay null and facility/equipment warnings retain their exact wording', async () => isolated(async (_, adapter, service) => {
  await importProductCatalog(adapter, approved);
  const dole = await service.getProductById('batch01-dole-garden-salad');
  assert.equal(dole.allergens.declared.status, 'unknown'); assert.equal(dole.allergens.declared.names, null);
  assert.equal(dole.allergens.precautionary.status, 'unknown'); assert.equal(dole.allergens.precautionary.names, null);
  const mounds = approved.products.find(p => p.brand === 'MOUNDS');
  const detail = await service.getProductById(mounds.id);
  assert.equal(detail.allergens.precautionary.statement, mounds.precautionaryStatement);
  assert.deepEqual(detail.allergens.precautionary.names, ['almond', 'peanuts']);
  assert.deepEqual(detail.allergens.declared.names, ['milk', 'coconut', 'soy']);
  const cereal = approved.products.find(p => p.name === 'Chocolate Chex');
  assert(cereal.ingredientLabelText.includes('Vitamins & minerals\nTricalcium Phosphate'));
}));

test('batch imports never touch existing local users or saved allergy selections', async () => isolated(async (db, adapter) => {
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(91,'Preserve','preserve@example.invalid','opaque-hash','file:///preserve.png'); INSERT INTO user_allergies(user_id,allergen) VALUES(91,'Preserve selection');");
  const users = db.prepare('SELECT * FROM users').all(); const allergies = db.prepare('SELECT * FROM user_allergies').all();
  await importStarterProductCatalog(adapter); await importStarterProductCatalog(adapter);
  assert.deepEqual(db.prepare('SELECT * FROM users').all(), users);
  assert.deepEqual(db.prepare('SELECT * FROM user_allergies').all(), allergies);
}));

test('SQLite rejects duplicate identities within a single import transaction', async () => isolated(async (db, adapter) => {
  const product = copy(approved.products[0]);
  const duplicate = copy(product); duplicate.id = 'same-transaction-duplicate';
  const result = await importProductCatalog(adapter, { ...approved, products: [product, duplicate] });
  assert.equal(result.inserted, 1); assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /Duplicate/);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 1);
}));
