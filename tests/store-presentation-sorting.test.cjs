const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { browseStores } = load(path.resolve(__dirname, '../services/storeBrowsing.ts'));
const stores = require('../stores/data/charleston-01.json').stores;
const options = { origin: stores[0], browseAll: true, query: '', chain: null, radiusMiles: 25 };

test('name sorting is global before pagination and does not mutate saved stores', () => {
  const original = JSON.stringify(stores);
  const first = browseStores(stores, { ...options, sort: 'name' });
  const all = browseStores(stores, { ...options, sort: 'name' }, 2);
  assert.deepEqual(first.visible, all.visible.slice(0, 10));
  assert(all.visible.every((store, i, rows) => i === 0 || rows[i - 1].name.localeCompare(store.name) <= 0));
  assert(all.visible.every(store => typeof store.distanceMiles === 'number'));
  assert.equal(JSON.stringify(stores), original);
});
test('name sorting respects combined chain, query and radius filters', () => {
  const result = browseStores(stores, { ...options, browseAll: false, chain: stores[0].chain, query: stores[0].city, radiusMiles: 100, sort: 'name' }, 2);
  assert(result.total > 0);
  assert(result.visible.every(store => store.chain === stores[0].chain && store.distanceMiles <= 100));
});
test('choosing name sorting never guesses a missing location', () => {
  const result = browseStores(stores, { ...options, browseAll: false, origin: null, sort: 'name' });
  assert.equal(result.emptyReason, 'location_required');
  assert.equal(result.total, 0);
});
