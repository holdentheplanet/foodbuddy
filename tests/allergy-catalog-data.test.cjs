const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { ALLERGY_CATALOG } = load(path.resolve(__dirname, '../database/allergyCatalogData.ts'));

test('every built-in allergen has terms, none blank or duplicated', () => {
  for (const [allergen, terms] of Object.entries(ALLERGY_CATALOG)) {
    assert.ok(allergen.trim(), 'allergen name is blank');
    assert.ok(terms.length > 0, `${allergen} has no terms`);
    const seen = new Set();
    for (const term of terms) {
      const key = term.trim().toLowerCase();
      assert.ok(key, `${allergen} has a blank term`);
      assert.ok(!seen.has(key), `${allergen} lists "${term}" twice`);
      seen.add(key);
    }
  }
});

test('allergen names are unique ignoring case (the database compares them NOCASE)', () => {
  const names = Object.keys(ALLERGY_CATALOG).map(name => name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});
