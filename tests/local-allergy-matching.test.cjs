const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const { initializeDatabaseConnection } = load(path.join(root, 'database/migrations.ts'));
const { importProductCatalog } = load(path.join(root, 'catalog/importer.ts'));
const { createLocalProductService } = load(path.join(root, 'services/localProductService.ts'));
const { compareLocalProductAllergies: compare } = load(path.join(root, 'services/localAllergyMatching.ts'));
const { createLatestRequest } = load(path.join(root, 'services/latestRequest.ts'));
const catalog = require('../catalog/data/us-starter.json');
async function withProducts(run) {
  const db = new DatabaseSync(':memory:');
  const conn = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params = []) { return db.prepare(sql).run(...params); },
    async getFirstAsync(sql, params = []) { return db.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, params = []) { return db.prepare(sql).all(...params); },
  };
  try { await initializeDatabaseConnection(conn); await importProductCatalog(conn, catalog, '2026-11-10'); await run(createLocalProductService(conn)); }
  finally { db.close(); }
}
const allergy = (name, derivatives = []) => ({ id: 1, name, derivatives });

test('verified declared allergens match saved profiles without losing unknown warning state', async () => withProducts(async products => {
  const oreo = await products.getProductById('oreo-original-family');
  const result = compare([allergy('Wheat')], oreo);
  assert.equal(result.status, 'conflict');
  assert.ok(result.matches.some(match => match.kind === 'declared' && match.source === 'allergens'));
  assert.equal(result.informationIncomplete, true);
  assert.match(result.missingInformation.join(' '), /cross-contact/);
}));

test('precautionary peanut declarations match the saved plural name as caution', async () => withProducts(async products => {
  const product = await products.getProductById('nature-valley-oats-honey-17-88oz');
  const result = compare([allergy('Peanuts')], product);
  assert.equal(result.status, 'caution');
  assert.ok(result.matches.every(match => match.source === 'traces'));
  assert.equal(result.informationIncomplete, false);
}));

test('unverified derivative mappings are possible concerns, not confirmed allergen matches', async () => withProducts(async products => {
  const product = await products.getProductById('cheerios-honey-nut-10-8oz');
  const result = compare([allergy('Tree Nuts', ['Almond'])], product);
  assert.equal(result.status, 'caution');
  assert.ok(result.matches.every(match => match.kind === 'possible_derivative'));
}));

test('verified ingredients can match custom allergies without an allergen declaration', async () => withProducts(async products => {
  const product = await products.getProductById('frenchs-classic-yellow-8oz');
  const result = compare([allergy('Mustard')], product);
  assert.equal(result.status, 'conflict');
  assert.ok(result.matches.some(match => match.source === 'ingredients'));
  assert.equal(result.informationIncomplete, true);
}));

test('missing or unverified ingredients never become a no-match conclusion', async () => withProducts(async products => {
  const product = await products.getProductById('lays-classic-13oz');
  const result = compare([allergy('Milk')], product);
  assert.equal(result.status, 'unknown'); assert.equal(result.informationIncomplete, true);
  const unverified = { ...product, ingredients: { ...product.ingredients, labelText: 'Milk', verificationStatus: 'unverified' } };
  assert.equal(compare([allergy('Milk')], unverified).status, 'caution');
}));

test('no known matches stays distinct from unknown and never guarantees safety', async () => withProducts(async products => {
  const cheerios = await products.getProductById('cheerios-original-8-9oz');
  const result = compare([allergy('Milk')], cheerios);
  assert.equal(result.status, 'no_matches');
  assert.equal(result.informationIncomplete, true);
  const rice = await products.getProductById('rice-chex');
  assert.equal(compare([allergy('Milk')], rice).status, 'unknown');
  assert.equal(compare([], cheerios).status, 'unknown');
  assert.equal(compare([], cheerios).savedAllergyCount, 0);
}));

test('latest-request gate suppresses reversed completions and stale errors', async () => {
  const gate = createLatestRequest();
  const events = [];
  let resolveFirst;
  const first = gate.start();
  const slow = new Promise(resolve => { resolveFirst = resolve; }).then(() => {
    if (gate.isCurrent(first)) events.push('stale product');
  }).finally(() => { if (gate.isCurrent(first)) events.push('stale loading'); });
  const second = gate.start();
  if (gate.isCurrent(second)) events.push('current product');
  resolveFirst(); await slow;
  assert.deepEqual(events, ['current product']);
  gate.invalidate();
  assert.equal(gate.isCurrent(second), false);
  const third = gate.start();
  const lateError = Promise.reject(new Error('old error')).catch(() => {
    if (gate.isCurrent(third)) events.push('stale error');
  });
  gate.invalidate(); await lateError;
  assert.deepEqual(events, ['current product']);
});
