const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const { initializeDatabaseConnection: initialize } = load(path.join(root, 'database/migrations.ts'));
const { importProductCatalog } = load(path.join(root, 'catalog/importer.ts'));
const { createLocalProductService } = load(path.join(root, 'services/localProductService.ts'));
const catalog = require('../catalog/data/us-starter.json');
async function isolated(run) {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params = []) { return db.prepare(sql).run(...params); },
    async getFirstAsync(sql, params = []) { return db.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, params = []) { return db.prepare(sql).all(...params); },
  };
  try {
    await initialize(adapter);
    await importProductCatalog(adapter, catalog, '2026-11-10');
    await run(createLocalProductService(adapter), db);
  } finally { db.close(); }
}
const ids = page => page.products.map(product => product.id);

test('exact name and partial name searches return real catalog identities', async () => isolated(async service => {
  assert.deepEqual(ids(await service.searchProductsByName('Original Cheerios')), ['cheerios-original-8-9oz']);
  assert.deepEqual(ids(await service.searchProductsByName('sandwich')), ['oreo-original-family']);
  assert.deepEqual(ids(await service.searchProductsByName('Goldfish')), ['goldfish-cheddar-26-3oz']);
  assert.equal((await service.searchProducts('Cheerios')).products.length, 2);
}));

test('case-insensitive matches, trimmed input, and partial brand searches', async () => isolated(async service => {
  assert.deepEqual(ids(await service.searchProducts('  oReO  ')), ['oreo-original-family']);
  assert.deepEqual(ids(await service.searchProductsByBrand('PEPPERIDGE')), ['goldfish-cheddar-26-3oz']);
  assert.deepEqual(ids(await service.searchProductsByBrand('Cheer')), ['cheerios-honey-nut-10-8oz', 'cheerios-original-8-9oz']);
  assert.equal((await service.searchProductsByName('Pepperidge')).products.length, 1);
  assert.equal((await service.searchProductsByBrand('Original')).products.length, 0);
}));

test('missing and blank searches yield empty pages; missing IDs yield null', async () => isolated(async service => {
  for (const query of ['nonexistent fixture product', '', '   ']) {
    assert.deepEqual(await service.searchProducts(query), { products: [], limit: 25, offset: 0, hasMore: false });
  }
  assert.equal(await service.getProductById('missing'), null);
  assert.equal(await service.getProductById(''), null);
  assert.equal(await service.getProductIngredients('missing'), null);
  assert.equal(await service.getProductAllergens('missing'), null);
}));

test('details return exact ingredients, segments, sources, variants, and review dates', async () => isolated(async service => {
  const product = await service.getProductById('oreo-original-family');
  const record = catalog.products.find(product => product.id === 'oreo-original-family');
  assert.equal(product.name, record.name);
  assert.equal(product.ingredients.labelText, record.ingredientLabelText);
  assert.equal(product.ingredients.verificationStatus, 'verified');
  assert.equal(product.ingredients.verifiedAt, '2026-11-10');
  assert.equal(product.ingredients.source.url, record.sources[0].url);
  assert.equal(product.provenance.catalogId, catalog.catalogId);
  assert.deepEqual(product.provenance.sources, record.sources);
  assert.equal(product.variant, record.variant);
  assert.equal(product.requiresLabelReview, true);
  assert.ok(product.ingredients.segments[0].name.includes('WHEAT FLOUR'));
  assert.ok(product.ingredients.segments[0].name.includes('FOLIC ACID'));
  assert.deepEqual(await service.getProductIngredients(product.id), product.ingredients);
}));

test('declared and precautionary allergens stay separate, with explicit evidence', async () => isolated(async service => {
  const result = await service.getProductAllergens('nature-valley-oats-honey-17-88oz');
  assert.equal(result.declared.status, 'documented');
  assert.deepEqual(result.declared.names, ['soy']);
  assert.deepEqual(result.precautionary.names, ['peanuts', 'almond', 'pecan']);
  assert.equal(result.precautionary.status, 'documented');
  assert.match(result.precautionary.statement, /may contain peanut/);
  assert.equal(result.relationships.filter(row => row.relationship === 'may_contain').length, 3);
  assert.equal(result.relationships.filter(row => row.relationship === 'contains').length, 1);
  assert.ok(result.relationships.every(row => row.evidenceReference.includes('reviewed 2026-11-10')));
}));

test('unverified ingredients and unknown warnings remain null, not empty safe lists', async () => isolated(async service => {
  const unverified = await service.getProductById('lays-classic-13oz');
  assert.equal(unverified.ingredients.verificationStatus, 'unverified');
  assert.equal(unverified.ingredients.labelText, null);
  assert.equal(unverified.ingredients.verifiedAt, null);
  assert.deepEqual(unverified.ingredients.segments, []);
  assert.equal(unverified.allergens.declared.status, 'unknown');
  assert.equal(unverified.allergens.declared.names, null);
  assert.equal(unverified.allergens.precautionary.names, null);
  const partial = await service.getProductById('rice-chex');
  assert.equal(partial.ingredients.verificationStatus, 'verified');
  assert.equal(partial.allergens.declared.status, 'unknown');
  assert.equal(partial.allergens.declared.names, null);
  const cheerios = await service.getProductById('cheerios-original-8-9oz');
  assert.equal(cheerios.allergens.declared.status, 'documented');
  assert.deepEqual(cheerios.allergens.declared.names, []);
  assert.equal(cheerios.allergens.precautionary.status, 'unknown');
  assert.equal(cheerios.requiresLabelReview, true);
}));

test('products without provenance remain retrievable with unknown declaration/completeness states', async () => isolated(async (service, db) => {
  db.exec("INSERT INTO products(id,name) VALUES('manual-fixture','Unknown fixture')");
  const product = await service.getProductById('manual-fixture');
  assert.equal(product.ingredients.verificationStatus, 'unknown');
  assert.equal(product.allergens.declared.names, null);
  assert.equal(product.provenance.completenessStatus, 'unknown');
  assert.deepEqual(product.provenance.sources, []);
  assert.equal(product.requiresLabelReview, true);
}));

test('pagination is bounded and deterministic; repeated searches are read-only', async () => isolated(async (service, db) => {
  const before = db.prepare('SELECT total_changes() AS n').get().n;
  const all = await service.searchProducts('cheerios');
  const first = await service.searchProducts('cheerios', { limit: 1 });
  const second = await service.searchProducts('cheerios', { limit: 1, offset: 1 });
  assert.equal(first.hasMore, true); assert.equal(second.hasMore, false);
  assert.deepEqual([...ids(first), ...ids(second)], ids(all));
  for (let i = 0; i < 3; i++) assert.deepEqual(await service.searchProducts('cheerios'), all);
  assert.equal(db.prepare('SELECT total_changes() AS n').get().n, before);
  await assert.rejects(service.searchProducts('a', { limit: 101 }), /Limit/);
  await assert.rejects(service.searchProducts('a', { offset: -1 }), /Offset/);
  await assert.rejects(service.searchProducts('a', { field: 'SQL' }), /field/);
}));

test('LIKE wildcard characters and SQL injection strings are literal bound input', async () => isolated(async (service, db) => {
  db.exec("INSERT INTO products(id,name) VALUES('literal-fixture','100%_test\\sample')");
  assert.deepEqual(ids(await service.searchProducts('%_test\\')), ['literal-fixture']);
  assert.deepEqual(ids(await service.searchProducts("' OR 1=1 --")), []);
  assert.equal(await service.getProductById("' OR 1=1 --"), null);
}));

test('inconsistent provenance raises an error instead of presenting trusted label evidence', async () => isolated(async (service, db) => {
  db.exec("UPDATE products SET ingredient_label_text='changed outside catalog' WHERE id='oreo-original-family'");
  await assert.rejects(service.getProductById('oreo-original-family'), /inconsistent catalog evidence/);
}));
