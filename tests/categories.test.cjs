const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const { initializeDatabaseConnection: initialize } = load(path.join(root, 'database/migrations.ts'));
const { importStarterProductCatalog: importBundled } = load(path.join(root, 'catalog/index.ts'));
const { importProductCatalog } = load(path.join(root, 'catalog/importer.ts'));
const { validateProductCatalog, canonicalRecord } = load(path.join(root, 'catalog/validation.ts'));
const { GROCERY_CATEGORIES, resolveCategoryId } = load(path.join(root, 'catalog/categories.ts'));
const { createLocalProductService } = load(path.join(root, 'services/localProductService.ts'));
const starter = require('../catalog/data/us-starter.json');
const expansion = require('../catalog/data/us-expansion-01.json');
async function isolated(run, seed = true) {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, args = []) { return db.prepare(sql).run(...args); },
    async getFirstAsync(sql, args = []) { return db.prepare(sql).get(...args) ?? null; },
    async getAllAsync(sql, args = []) { return db.prepare(sql).all(...args); },
  };
  try { await initialize(adapter); if (seed) await importBundled(adapter); await run(createLocalProductService(adapter), db, adapter); }
  finally { db.close(); }
}

test('expansion contains 30 unique real identities, three per category, with honest completeness counts', () => {
  validateProductCatalog(expansion, '2026-11-10');
  const all = [...starter.products, ...expansion.products];
  assert.equal(new Set(all.map(p => p.id)).size, 50);
  for (const category of GROCERY_CATEGORIES) assert.equal(expansion.products.filter(p => p.category === category.id).length, 3);
  assert.equal(all.filter(p => p.ingredientVerificationStatus === 'verified').length, 33);
  assert.equal(all.filter(p => p.completenessStatus === 'complete').length, 3);
  assert.equal(all.filter(p => p.completenessStatus === 'partial').length, 30);
  assert.equal(all.filter(p => p.completenessStatus === 'unverified').length, 17);
});

test('SQLite category order, assignments and counts match the bundled catalog', async () => isolated(async (service, db) => {
  const categories = await service.listCategories();
  assert.deepEqual(categories.map(c => c.name), GROCERY_CATEGORIES.map(c => c.name));
  assert.equal(categories.reduce((sum, c) => sum + c.productCount, 0), 50);
  for (const record of [...starter.products, ...expansion.products]) {
    const details = await service.getProductById(record.id);
    assert.equal(details.categoryId, resolveCategoryId(record.category));
    assert.equal(details.provenance.category, details.categoryName);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM products WHERE category_id IS NULL').get().n, 0);
}));

test('category browsing returns only assigned products; global searches ignore prior selections', async () => isolated(async service => {
  const snacks = await service.browseProducts('snacks-candy', { limit: 100 });
  assert(snacks.products.some(p => /OREO/.test(p.name)));
  assert(snacks.products.every(p => p.categoryId === 'snacks-candy'));
  assert.equal((await service.browseProducts('produce')).products.length, 3);
  assert.equal((await service.searchProducts('oReO')).products.length, 1);
  assert.equal((await service.searchProducts('oReO', { categoryId: 'produce' })).products.length, 0);
  assert.equal((await service.searchProductsByBrand('bArIlLa')).products.length, 3);
  assert.equal((await service.searchProducts('Sausage')).products[0].categoryId, 'meat-seafood');
  assert.equal((await service.searchProducts('nonexistent')).products.length, 0);
  assert.equal((await service.searchProducts('')).products.length, 0);
  assert.equal((await service.browseProducts('unknown-category')).products.length, 0);
}));

test('all-product and category pagination are stable, repeatable and read-only', async () => isolated(async (service, db) => {
  const before = db.prepare('SELECT total_changes() n').get().n;
  const seen = [];
  for (let offset = 0; offset < 50; offset += 7) {
    const page = await service.browseProducts(null, { limit: 7, offset });
    seen.push(...page.products.map(p => p.id));
    assert.equal(page.hasMore, offset + 7 < 50);
  }
  assert.equal(new Set(seen).size, 50);
  assert.deepEqual(await service.browseProducts('breakfast'), await service.browseProducts('breakfast'));
  assert.equal(db.prepare('SELECT total_changes() n').get().n, before);
  await assert.rejects(service.browseProducts(''), /category/);
}));

test('empty categories expose zero counts and an empty page rather than keyword suggestions', async () => isolated(async (service) => {
  assert((await service.listCategories()).every(c => c.productCount === 0));
  assert.deepEqual((await service.browseProducts('produce')).products, []);
}, false));

test('repeated bundled imports preserve provenance and never duplicate ingredients or declarations', async () => isolated(async (service, db, adapter) => {
  const before = db.prepare('SELECT total_changes() n').get().n;
  const result = await importBundled(adapter);
  assert.equal(result.unchanged, 50); assert.equal(result.inserted, 0);
  assert.equal(db.prepare('SELECT total_changes() n').get().n, before);
  assert.equal(db.prepare('SELECT count(*) n FROM product_catalog_revisions').get().n, 50);
  assert.equal((await service.getProductById('us-penne-original')).allergens.precautionary.names[0], 'eggs');
}));

test('unknown labels and declarations remain explicit after import and retrieval', async () => isolated(async service => {
  const product = await service.getProductById('us-lacroix-original');
  assert.equal(product.ingredients.labelText, null);
  assert.equal(product.completenessStatus, 'unverified');
  assert.equal(product.allergens.declared.status, 'unknown');
  assert.equal(product.allergens.declared.names, null);
  assert.equal(product.allergens.precautionary.names, null);
  assert.equal(product.requiresLabelReview, true);
  const spinach = await service.getProductById('us-spinach-original');
  assert.equal(spinach.ingredients.labelText, 'BABY SPINACH');
  assert.equal(spinach.allergens.declared.status, 'unknown');
  assert.equal(spinach.completenessStatus, 'partial');
}));

test('unknown categories reject the whole import; category foreign keys reject invalid assignments', async () => isolated(async (_, db, adapter) => {
  const changed = structuredClone(expansion); changed.products[0].category = 'invented';
  assert.throws(() => importProductCatalog(adapter, changed), /category/);
  changed.products[0].category = 'constructor';
  assert.throws(() => importProductCatalog(adapter, changed), /category/);
  assert.throws(() => db.prepare('UPDATE products SET category_id = ? WHERE id = ?').run('invented', starter.products[0].id), /FOREIGN KEY/);
  assert.throws(() => db.prepare('DELETE FROM product_categories WHERE id = ?').run('snacks-candy'), /FOREIGN KEY/);
}));

test('v3 upgrade backfills categories without changing evidence or legacy account/profile data', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = { async execAsync(sql) { db.exec(sql); }, async getFirstAsync(sql) { return db.prepare(sql).get(); } };
  try {
    const { readFileSync } = require('node:fs');
    for (const fixture of ['legacy-schema.sql', 'v2-offline-schema.sql', 'v3-provenance-schema.sql']) {
      db.exec(readFileSync(path.join(__dirname, 'fixtures', fixture), 'utf8'));
    }
    db.exec("PRAGMA user_version=3; INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(1,'Legacy','legacy@example.test','unchanged-hash','file://unchanged'); INSERT INTO allergens(id,name,is_custom) VALUES(1,'Custom',1); INSERT INTO user_allergy_profiles VALUES(1,1); INSERT INTO allergen_derivatives(allergen_id,ingredient_name) VALUES(1,'Original term');");
    const record = starter.products[0];
    db.prepare('INSERT INTO products(id,name,ingredient_label_text,ingredient_verification_status,source_reference,last_verified_at) VALUES(?,?,?,?,?,?)').run(record.id,record.name,record.ingredientLabelText,'verified',record.sources[0].url,record.verifiedAt);
    db.prepare('INSERT INTO product_catalog_entries(product_id,catalog_id,record_json) VALUES(?,?,?)').run(record.id,starter.catalogId,canonicalRecord(record));
    const before = db.prepare('SELECT * FROM users').all();
    await initialize(adapter); await initialize(adapter);
    assert.deepEqual(db.prepare('SELECT * FROM users').all(), before);
    assert.equal(db.prepare('SELECT category_id FROM products').get().category_id, 'snacks-candy');
    assert.equal(db.prepare('SELECT record_json FROM product_catalog_entries').get().record_json, canonicalRecord(record));
    assert.equal(db.prepare('SELECT ingredient_label_text FROM products').get().ingredient_label_text, record.ingredientLabelText);
    assert.equal(db.prepare('SELECT count(*) n FROM user_allergy_profiles').get().n, 1);
    assert.equal(db.prepare('SELECT ingredient_name FROM allergen_derivatives').get().ingredient_name, 'Original term');
  } finally { db.close(); }
});


test('full expansion imports preserve existing accounts, custom allergies and derivative terms', async () => isolated(async (_, db, adapter) => {
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(7,'Fixture','fixture@example.invalid','opaque-hash','file://picture'); INSERT INTO allergens(id,name,is_custom) VALUES(31,'Fixture custom',1); INSERT INTO user_allergy_profiles VALUES(7,31); INSERT INTO user_allergies(user_id,allergen) VALUES(7,'Legacy custom'); INSERT INTO allergen_derivatives(allergen_id,ingredient_name) VALUES(31,'Fixture derivative');");
  const tables = ['users', 'allergens', 'user_allergies', 'user_allergy_profiles', 'allergen_derivatives'];
  const snapshot = () => tables.map(t => db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const before = snapshot();
  await importBundled(adapter); await importBundled(adapter);
  assert.deepEqual(snapshot(), before);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n, 50);
}, false));

test('new verified ingredient lists with unknown declarations never become a safe/no-match finding', async () => isolated(async service => {
  const { compareLocalProductAllergies: compare } = load(path.join(root, 'services/localAllergyMatching.ts'));
  const milk = [{ id: 1, name: 'Milk', derivatives: [] }];
  const coke = await service.getProductById('us-coke-original');
  assert.equal(compare(milk, coke).status, 'unknown');
  assert.equal(compare(milk, coke).informationIncomplete, true);
  const daisy = await service.getProductById('us-daisy-light-original');
  assert.equal(compare(milk, daisy).status, 'conflict');
  const penne = await service.getProductById('us-penne-original');
  assert.equal(compare([{ id: 2, name: 'Eggs', derivatives: [] }], penne).status, 'caution');
}));
