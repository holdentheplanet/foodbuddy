const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const { initializeDatabaseConnection: initialize } = load(path.join(root, 'database/migrations.ts'));
const { importStoreCatalog } = load(path.join(root, 'stores/importer.ts'));
const { importStarterProductCatalog } = load(path.join(root, 'catalog/index.ts'));
const { validateStoreCatalog } = load(path.join(root, 'stores/validation.ts'));
const { createLocalStoreService } = load(path.join(root, 'services/localStoreService.ts'));
const { distanceMiles, sortStoresByDistance } = load(path.join(root, 'services/storeDistance.ts'));
const { resolveForegroundLocation } = load(path.join(root, 'services/foregroundLocation.ts'));
const catalog = require('../stores/data/charleston-01.json');
const clone = () => structuredClone(catalog);
async function isolated(run) {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, args = []) { return db.prepare(sql).run(...args); },
    async getFirstAsync(sql, args = []) { return db.prepare(sql).get(...args) ?? null; },
    async getAllAsync(sql, args = []) { return db.prepare(sql).all(...args); },
  };
  try { await initialize(adapter); await run(db, adapter, createLocalStoreService(adapter)); }
  finally { db.close(); }
}

test('17 sourced Charleston-area stores include five chains; unverified coordinates remain flagged', () => {
  assert.equal(validateStoreCatalog(catalog, '2026-11-11').stores.length, 17);
  assert.equal(new Set(catalog.stores.map(s => s.id)).size, 17);
  assert.deepEqual([...new Set(catalog.stores.map(s => s.chain))].sort(), ['Food Lion','Harris Teeter','Publix','Target','Walmart']);
  assert.equal(catalog.stores.filter(s => s.verificationStatus === 'verified').length, 16);
  assert.equal(catalog.stores.find(s => s.chain === 'Harris Teeter').verificationStatus, 'unverified');
  assert(catalog.stores.every(s => s.latitude > 32 && s.latitude < 34 && s.longitude < -79 && s.longitude > -81));
});

test('store imports and concurrent repeats do not duplicate stores or provenance', async () => isolated(async (db, adapter, service) => {
  assert.equal((await importStoreCatalog(adapter, catalog)).inserted, 17);
  const before = db.prepare('SELECT total_changes() n').get().n;
  const results = await Promise.all([importStoreCatalog(adapter, catalog),importStoreCatalog(adapter, catalog)]);
  assert(results.every(result => result.unchanged === 17));
  assert.equal(db.prepare('SELECT total_changes() n').get().n, before);
  assert.equal(db.prepare('SELECT count(*) n FROM store_catalog_revisions').get().n, 17);
  assert.equal((await service.listStores()).length, 17);
}));

test('invalid addresses, duplicate identities/addresses, missing evidence and impossible coordinates fail before writes', async () => isolated(async (db, adapter) => {
  for (const mutate of [
    c => c.stores.push(c.stores[0]),
    c => c.stores.push({ ...c.stores[0], id: 'other-id' }),
    c => c.stores[0].latitude = 91,
    c => c.stores[0].latitude = null,
    c => c.stores[0].zipCode = 'bad',
    c => c.stores[0].streetAddress = '',
    c => c.stores[0].sources = [],
    c => c.stores[0].sources[0].evidence = 'missing coordinates',
    c => c.stores[0].sources[0].url = 'https://unreviewed.example/point',
    c => c.stores[0].checkedAt = '2099-01-01',
    c => c.stores.find(s => s.chain === 'Walmart').attribution = null,
  ]) {
    const changed = clone(); mutate(changed);
    assert.throws(() => importStoreCatalog(adapter, changed));
    assert.equal(db.prepare('SELECT count(*) n FROM stores').get().n, 0);
  }
}));

test('incomplete and older store records cannot overwrite stronger evidence; accepted updates retain history', async () => isolated(async (db, adapter) => {
  await importStoreCatalog(adapter, catalog);
  const weaker = clone(); weaker.stores[0].verificationStatus = 'unverified';
  assert((await importStoreCatalog(adapter, weaker)).skipped.includes(weaker.stores[0].id));
  const older = clone(); older.stores[0].checkedAt = '2026-11-09';
  assert((await importStoreCatalog(adapter, older)).skipped.includes(older.stores[0].id));
  const updated = clone(); updated.stores[0].notes += ' Reviewed metadata.';
  assert.equal((await importStoreCatalog(adapter, updated)).updated, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM store_catalog_revisions').get().n, 18);
}));

test('manual stores and other catalogs cannot be taken over', async () => isolated(async (db, adapter) => {
  const s = catalog.stores[0];
  db.prepare('INSERT INTO stores(id,name,street_address,city,state,zip_code) VALUES(?,?,?,?,?,?)').run(s.id,'Manual','Existing','Charleston','SC','29401');
  assert((await importStoreCatalog(adapter,catalog)).skipped.includes(s.id));
  assert.equal(db.prepare('SELECT name FROM stores WHERE id=?').get(s.id).name, 'Manual');
  const other = clone(); other.catalogId = 'another-catalog';
  assert.equal((await importStoreCatalog(adapter,other)).skipped.length, 17);
}));

test('SQL failure rolls back the store batch, then a retry succeeds', async () => isolated(async (db, adapter) => {
  db.exec("CREATE TRIGGER reject_store BEFORE INSERT ON stores WHEN NEW.id='target-3428' BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  await assert.rejects(importStoreCatalog(adapter,catalog), /fixture/);
  assert.equal(db.prepare('SELECT count(*) n FROM stores').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM store_catalog_entries').get().n, 0);
  db.exec('DROP TRIGGER reject_store');
  assert.equal((await importStoreCatalog(adapter,catalog)).inserted, 17);
}));

test('store import preserves user data, all 50 products and empty inventory; foreign keys are enforced', async () => isolated(async (db, adapter) => {
  await importStarterProductCatalog(adapter);
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(1,'Fixture','fixture@example.invalid','same-hash','file://same-picture'); INSERT INTO allergens(id,name,is_custom) VALUES(1,'Custom',1); INSERT INTO user_allergy_profiles VALUES(1,1); INSERT INTO allergen_derivatives(allergen_id,ingredient_name) VALUES(1,'Same derivative'); INSERT INTO user_allergies(user_id,allergen) VALUES(1,'Legacy');");
  const tables = ['users','allergens','user_allergy_profiles','user_allergies','allergen_derivatives','products','product_ingredients','product_allergens','product_catalog_entries','product_catalog_revisions'];
  const snapshot = () => tables.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all());
  const before = snapshot();
  await importStoreCatalog(adapter,catalog); await initialize(adapter); await importStoreCatalog(adapter,catalog);
  assert.deepEqual(snapshot(),before);
  assert.equal(db.prepare('SELECT count(*) n FROM store_inventory').get().n,0);
  assert.throws(() => db.prepare('INSERT INTO store_catalog_entries VALUES(?,?,?,CURRENT_TIMESTAMP)').run('orphan','fixture','{}'), /FOREIGN KEY/);
}));

test('Haversine distance handles zero, symmetry, antimeridian, poles and known equatorial separation', () => {
  const a={latitude:0,longitude:0}, b={latitude:0,longitude:1};
  assert.equal(distanceMiles(a,a),0);
  assert(Math.abs(distanceMiles(a,b) - 69.0934) < 0.001);
  assert.equal(distanceMiles(a,b),distanceMiles(b,a));
  assert(distanceMiles({latitude:0,longitude:179.9},{latitude:0,longitude:-179.9}) < 14);
  assert(Number.isFinite(distanceMiles({latitude:90,longitude:0},{latitude:-90,longitude:0})));
  for(const bad of [null,{}, {latitude:NaN,longitude:0},{latitude:0,longitude:181},{latitude:'0',longitude:0}]) assert.equal(distanceMiles(bad,a),null);
});

test('distance sorting is stable and non-mutating; no GPS means alphabetical order, never a zero origin', async () => isolated(async (_, adapter, service) => {
  await importStoreCatalog(adapter,catalog);
  const origin = {latitude:32.78045,longitude:-79.933401};
  const near = await service.listStores(origin);
  assert.equal(near[0].id,'target-3428'); assert.equal(near[0].distanceMiles,0);
  assert(near.every((store,i)=>i===0 || store.distanceMiles>=near[i-1].distanceMiles));
  const manual = await service.listStores();
  assert(manual.every(s=>s.distanceMiles===null));
  assert.deepEqual(manual.map(s=>s.name), [...manual.map(s=>s.name)].sort((a,b)=>a.localeCompare(b)));
  const original=JSON.stringify(catalog.stores);sortStoresByDistance(catalog.stores,origin);
  assert.equal(JSON.stringify(catalog.stores),original);
  const details = near.find(s=>s.chain==='Walmart');assert(details.attribution.includes('OpenStreetMap'));
}));

const adapter = (overrides={}) => ({ requestPermission:async()=>({granted:true,canAskAgain:true}),servicesEnabled:async()=>true,
  currentPosition:async()=>({coords:{latitude:32.78,longitude:-79.93,accuracy:10},timestamp:123456,mocked:true}),...overrides });

test('foreground location denial does not request GPS or location services', async () => {
  for(const canAskAgain of [true,false]) {
    const result=await resolveForegroundLocation(adapter({requestPermission:async()=>({granted:false,canAskAgain}),servicesEnabled:async()=>assert.fail('No location access'),currentPosition:async()=>assert.fail('No GPS access')}));
    assert.equal(result.status,'denied'); assert.equal(result.position,null);
  }
});

test('GPS services-off, rejected fix, invalid fix and timeout all retain manual browsing', async () => {
  const disabled=await resolveForegroundLocation(adapter({servicesEnabled:async()=>false,currentPosition:async()=>assert.fail('No GPS')}));
  assert.equal(disabled.status,'disabled');assert.equal(disabled.position,null);
  for(const currentPosition of [async()=>{throw Error('No GPS')},async()=>({coords:{latitude:NaN,longitude:0},timestamp:1}),()=>new Promise(()=>{})]) {
    const result=await resolveForegroundLocation(adapter({currentPosition}),5);
    assert.equal(result.status,'unavailable');assert.equal(result.position,null);
  }
});

test('granted foreground GPS preserves real coordinates, accuracy and simulator/mock status', async () => {
  const result=await resolveForegroundLocation(adapter());
  assert.equal(result.status,'available');assert.deepEqual(result.position,{latitude:32.78,longitude:-79.93});
  assert.equal(result.accuracy,10);assert.equal(result.mocked,true);assert.equal(result.timestamp,123456);
});
