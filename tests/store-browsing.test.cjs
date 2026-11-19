const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { lookupZip } = load(path.resolve(__dirname, '../services/zipLocation.ts'));
const { browseStores } = load(path.resolve(__dirname, '../services/storeBrowsing.ts'));
const { validCoordinates, distanceMiles } = load(path.resolve(__dirname, '../services/storeDistance.ts'));
const { createLatestRequest } = load(path.resolve(__dirname, '../services/latestRequest.ts'));
const points = require('../stores/zip/us-zcta-2025.json');
const source = require('../stores/zip/source.json');
const saved = require('../stores/data/charleston-01.json').stores.map(store => ({ ...store, distanceMiles: null }));
const defaults = { origin: lookupZip('29401').position, browseAll: false, query: '', chain: null, radiusMiles: 25 };

test('bundled Census reference has broad coverage, valid unique five-digit keys and source provenance', () => {
  assert.equal(Object.keys(points).length, source.pointCount);
  assert(source.pointCount > 33000);
  assert.equal(new URL(source.sourceUrl).hostname, 'www2.census.gov');
  assert.match(source.archiveSha256, /^[a-f0-9]{64}$/);
  for (const [zip, point] of Object.entries(points)) {
    assert.match(zip, /^\d{5}$/);
    assert(validCoordinates({ latitude: point[0], longitude: point[1] }));
  }
  for (const zip of ['00601', '02108', '10001', '20001', '29401', '33101', '60601', '73301', '80202', '90210', '94103', '96815', '99501']) {
    // Census does not cover every postal ZIP, including some unique/PO-box ZIPs.
    if (['73301', '33101'].includes(zip)) continue;
    assert.equal(lookupZip(zip).ok, true, zip);
  }
});

test('ZIP lookup preserves leading zeros and labels reference points approximate', () => {
  const result = lookupZip(' 02108 ');
  assert.equal(result.zip, '02108'); assert.match(result.label, /approximate/);
  assert.deepEqual(result.position, { latitude: points['02108'][0], longitude: points['02108'][1] });
});

test('invalid and unsupported ZIPs have no fallback coordinates', () => {
  for (const zip of ['', '2940', '294010', '29a01', '29401-1234', '00000', '99999']) {
    const result = lookupZip(zip); assert.equal(result.ok, false); assert.equal(result.position, undefined); assert(result.message);
  }
});

test('nearby stores use actual selected origin, sort globally before pagination, and preserve input records', () => {
  const before = JSON.stringify(saved);
  const result = browseStores(saved, defaults);
  assert(result.total > 10); assert.equal(result.visible.length, 10); assert.equal(result.hasMore, true);
  assert(result.visible.every((s, i, a) => s.distanceMiles <= 25 && (!i || s.distanceMiles >= a[i - 1].distanceMiles)));
  const all = browseStores(saved, defaults, 2);
  assert.equal(new Set(all.visible.map(s => s.id)).size, all.total); assert.equal(all.hasMore, false);
  assert.deepEqual(all.visible.slice(0, 10), result.visible); assert.equal(JSON.stringify(saved), before);
  assert(Math.abs(result.visible[0].distanceMiles - distanceMiles(defaults.origin, result.visible[0])) < 1e-9);
});

test('radius filtering is inclusive and missing coordinates never become nearby', () => {
  const origin = { latitude: saved[0].latitude, longitude: saved[0].longitude };
  const stores = [...saved, { ...saved[0], id: 'missing', latitude: null, longitude: null }];
  const result = browseStores(stores, { ...defaults, origin, radiusMiles: 0.01 });
  assert.equal(result.visible[0].id, saved[0].id); assert.equal(result.visible[0].distanceMiles, 0);
  assert(!result.visible.some(s => s.id === 'missing'));
  assert(browseStores(stores, { ...defaults, browseAll: true }, 2).visible.some(s => s.id === 'missing'));
});

test('store name, chain, address and ZIP searches are partial and case insensitive; filters combine', () => {
  for (const query of ['tArGeT', saved[0].streetAddress.slice(0, 8).toUpperCase(), saved[0].zipCode]) {
    const result = browseStores(saved, { ...defaults, browseAll: true, query });
    assert(result.total > 0, query);
  }
  const targets = browseStores(saved, { ...defaults, browseAll: true, chain: 'Target', query: 'charleston' });
  assert(targets.total > 0); assert(targets.visible.every(s => s.chain === 'Target' && JSON.stringify(s).toLowerCase().includes('charleston')));
  assert.equal(browseStores(saved, { ...defaults, query: 'zzzz no store' }).emptyReason, 'no_matches');
});

test('out-of-coverage locations show empty nearby results rather than pretending stores are near', () => {
  for (const zip of ['10001', '94103', '99501']) {
    const origin = lookupZip(zip).position;
    const nearby = browseStores(saved, { ...defaults, origin });
    assert.equal(nearby.total, 0); assert.equal(nearby.emptyReason, 'outside_coverage');
    const directory = browseStores(saved, { ...defaults, origin, browseAll: true }, 2);
    assert.equal(directory.total, 17); assert(directory.visible.every(s => s.distanceMiles > 25));
  }
});

test('absent or invalid GPS requires explicit all-stores mode and never invents an origin', () => {
  for (const origin of [null, { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 181 }]) {
    assert.equal(browseStores(saved, { ...defaults, origin }).emptyReason, 'location_required');
    const directory = browseStores(saved, { ...defaults, origin, browseAll: true }, 2);
    assert.equal(directory.total, 17); assert(directory.visible.every(s => s.distanceMiles === null));
    assert.deepEqual(directory.visible.map(s => s.name), directory.visible.map(s => s.name).sort((a,b) => a.localeCompare(b)));
  }
});

test('page bounds are defensive; filtered results restart at the first ten', () => {
  for (const page of [0, -1, NaN, Infinity]) assert.equal(browseStores(saved, { ...defaults, browseAll: true }, page).visible.length, 10);
  assert.equal(browseStores(saved, { ...defaults, browseAll: true }, 100).visible.length, 17);
  assert.equal(browseStores(saved, { ...defaults, browseAll: true, chain: 'Target' }).hasMore, false);
});

test('switching to ZIP/manual mode invalidates pending GPS results', () => {
  const requests = createLatestRequest(); const gps = requests.start(); requests.invalidate();
  assert.equal(requests.isCurrent(gps), false);
  const later = requests.start(); assert.equal(requests.isCurrent(later), true); assert.equal(requests.isCurrent(gps), false);
});
