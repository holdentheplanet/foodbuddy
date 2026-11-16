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

// --- Match types and per-user tolerances (definite / possible / exclude; avoid / limit / ok) ---
const term = (name, matchType = 'definite', tolerance = 'avoid', note = null) => ({ term: name, matchType, note, tolerance });
// A verified, documented product whose label text we replace per test.
async function withLabel(labelText, run, verificationStatus = 'verified') {
  await withProducts(async products => {
    const base = await products.getProductById('cheerios-original-8-9oz');
    await run({ ...base, ingredients: { ...base.ingredients, labelText, verificationStatus } });
  });
}

test('a definite term the user avoids on a verified label is a conflict, with its type and note', () => withLabel('Sugar, Corn Syrup, Salt', product => {
  const result = compare([allergy('Corn', [term('corn syrup', 'definite', 'avoid', 'is made from corn')])], product);
  assert.equal(result.status, 'conflict');
  assert.deepEqual(result.matches.map(m => [m.matchedIngredient, m.kind, m.matchType, m.tolerance, m.note]),
    [['corn syrup', 'definite_derivative', 'definite', 'avoid', 'is made from corn']]);
}));

test('definite terms on an unverified label, and possible terms, stay a caution', async () => {
  await withLabel('Sugar, Corn Syrup', product => {
    assert.equal(compare([allergy('Corn', [term('corn syrup')])], product).status, 'caution');
  }, 'unverified');
  await withLabel('Water, Citric Acid', product => {
    const result = compare([allergy('Corn', [term('citric acid', 'possible')])], product);
    assert.equal(result.status, 'caution');
    assert.equal(result.matches[0].kind, 'possible_derivative');
  });
});

test('"small amounts" caps a definite term at caution', () => withLabel('Sugar, Corn Syrup', product => {
  const result = compare([allergy('Corn', [term('corn syrup', 'definite', 'limit')])], product);
  assert.equal(result.status, 'caution');
  assert.equal(result.matches[0].tolerance, 'limit');
}));

test('"OK for me" terms are skipped while other terms still match', async () => {
  await withLabel('Sugar, Maltodextrin, Salt', product => {
    const result = compare([allergy('Corn', [term('maltodextrin', 'definite', 'ok')])], product);
    assert.equal(result.status, 'no_matches');
    assert.equal(result.matches.length, 0);
    // Not flagged, but still reported so the user knows a setting applied.
    assert.deepEqual(result.allowedBySettings, [{ allergen: 'Corn', term: 'maltodextrin' }]);
  });
  await withLabel('Sugar, Maltodextrin, Corn Syrup', product => {
    const result = compare([allergy('Corn', [term('maltodextrin', 'definite', 'ok'), term('corn syrup')])], product);
    assert.equal(result.status, 'conflict');
    assert.deepEqual(result.matches.map(m => m.matchedIngredient), ['corn syrup']);
  });
});

test('tolerances never hide the allergen name itself', () => withLabel('Maltodextrin (Made from Corn), Salt', product => {
  const result = compare([allergy('Corn', [term('maltodextrin', 'definite', 'ok')])], product);
  assert.equal(result.status, 'conflict');
  assert.equal(result.matches[0].kind, 'ingredient');
  assert.equal(result.matches[0].matchedIngredient, 'corn');
}));

test('a tolerated phrase containing the allergen name uses the user setting (soy lecithin)', async () => {
  await withLabel('Sugar, Soy Lecithin, Salt', product => {
    assert.equal(compare([allergy('Soy', [term('soy lecithin', 'definite', 'ok')])], product).status, 'no_matches');
    const avoided = compare([allergy('Soy', [term('soy lecithin')])], product);
    assert.equal(avoided.status, 'conflict');
    assert.equal(avoided.matches[0].matchedIngredient, 'soy lecithin');
  });
  // ...but soy elsewhere on the label is still caught.
  await withLabel('Soy Lecithin, Soybean Oil, Soy', product => {
    const result = compare([allergy('Soy', [term('soy lecithin', 'definite', 'ok')])], product);
    assert.equal(result.status, 'conflict');
    assert.equal(result.matches[0].kind, 'ingredient');
  });
});

test('the allergen name itself cannot be set to OK', () => withLabel('Whole Milk, Vitamin D3', product => {
  const result = compare([allergy('Milk', [term('Milk', 'definite', 'ok')])], product);
  assert.equal(result.status, 'conflict');
  assert.equal(result.matches[0].kind, 'ingredient');
}));

test('exclude terms stop look-alike matches without hiding real ones', async () => {
  const milk = allergy('Milk', [term('butter'), term('cocoa butter', 'exclude'), term('peanut butter', 'exclude'), term('coconut milk', 'exclude')]);
  await withLabel('Sugar, Cocoa Butter, Chocolate, Peanut Butter, Coconut Milk', product => {
    assert.equal(compare([milk], product).status, 'no_matches');
  });
  await withLabel('Sugar, Cocoa Butter, Butter', product => {
    const result = compare([milk], product);
    assert.equal(result.status, 'conflict');
    assert.deepEqual(result.matches.map(m => m.matchedIngredient), ['butter']);
  });
  // Excludes belong to one allergen: peanut butter still matches Peanuts.
  await withLabel('Peanut Butter, Salt', product => {
    assert.equal(compare([milk, allergy('Peanuts', [term('peanut butter')])], product).status, 'conflict');
  });
});

test('whole-word matching: eggplant is not egg', () => withLabel('Eggplant, Olive Oil, Salt', product => {
  assert.equal(compare([allergy('Eggs', [term('egg'), term('eggs')])], product).status, 'no_matches');
}));

test('nacho chips sample: corn and milk conflict even with some corn terms marked OK', () => withLabel(
  "Corn, Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Maltodextrin (Made from Corn), Salt, Cheddar Cheese (Milk, Cheese Cultures, Salt, Enzymes), Whey, Monosodium Glutamate, Buttermilk, Natural and Artificial Flavor, Dextrose, Lactose, Citric Acid",
  product => {
    const corn = allergy('Corn', [term('maltodextrin', 'definite', 'ok'), term('dextrose'), term('citric acid', 'possible', 'limit')]);
    const milk = allergy('Milk', [term('whey'), term('lactose'), term('buttermilk')]);
    const result = compare([corn, milk], product);
    assert.equal(result.status, 'conflict');
    assert.ok(result.matches.some(m => m.allergen === 'Corn' && m.kind === 'ingredient'));
    assert.ok(result.matches.some(m => m.allergen === 'Milk' && m.kind === 'ingredient'));
    assert.ok(!result.matches.some(m => m.matchedIngredient === 'maltodextrin'));
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
