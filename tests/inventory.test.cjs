const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { initializeDatabaseConnection: initialize } = load(path.resolve('database/migrations.ts'));
const { importStarterProductCatalog } = load(path.resolve('catalog/index.ts'));
const { importLocalStores } = load(path.resolve('stores/index.ts'));
const { buildInventorySeed } = load(path.resolve('inventory/seed.ts'));
const { importDemoInventory } = load(path.resolve('inventory/importer.ts'));
const { createLocalProductService } = load(path.resolve('services/localProductService.ts'));
const { createLocalInventoryService } = load(path.resolve('services/localInventoryService.ts'));
const { demoStatusLabel, DEMO_DISCLAIMER } = load(path.resolve('inventory/types.ts'));
const seed = require('../inventory/data/demo-v1.json');
const records = buildInventorySeed(seed);
async function isolated(run) {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql,args=[]) { return db.prepare(sql).run(...args); },
    async getFirstAsync(sql,args=[]) { return db.prepare(sql).get(...args) ?? null; },
    async getAllAsync(sql,args=[]) { return db.prepare(sql).all(...args); },
  };
  try { await initialize(adapter); await importStarterProductCatalog(adapter); await importLocalStores(adapter);
    await run(db,adapter,createLocalProductService(adapter),createLocalInventoryService(adapter)); }
  finally { db.close(); }
}

test('versioned assignment is deterministic regardless of ID order and uses only bundled product/store IDs', () => {
  assert.equal(records.length,671);
  assert.equal(new Set(records.map(r=>r.storeId)).size,17);
  assert.equal(new Set(records.map(r=>r.productId)).size,50);
  assert.equal(new Set(records.map(r=>r.storeId+'|'+r.productId)).size,671);
  assert.deepEqual(buildInventorySeed({...seed,storeIds:[...seed.storeIds].reverse(),productIds:[...seed.productIds].reverse()}),records);
  assert.deepEqual([...new Set(records.map(r=>r.status))].sort(),['in_stock','limited_stock','out_of_stock']);
  for(const store of seed.storeIds) assert(records.filter(r=>r.storeId===store).length>=30);
});

test('seed imports once, repeats and concurrent calls do no writes or duplicates', async () => isolated(async (db,adapter) => {
  assert.equal((await importDemoInventory(adapter,seed)).inserted,671);
  const before=db.prepare('SELECT total_changes() n').get().n;
  for(const result of await Promise.all([importDemoInventory(adapter,seed),importDemoInventory(adapter,seed)])) assert.equal(result.unchanged,671);
  assert.equal(db.prepare('SELECT total_changes() n').get().n,before);
  assert.equal(db.prepare('SELECT count(*) n FROM demo_inventory_entries').get().n,671);
  assert.equal(db.prepare('SELECT count(*) n FROM store_inventory WHERE is_demo=1').get().n,671);
}));

test('status retrieval preserves all three demo labels and global availability lists only assignments', async () => isolated(async (_,adapter,products,inventory) => {
  await importDemoInventory(adapter,seed);
  for(const status of ['in_stock','limited_stock','out_of_stock']) {
    const record=records.find(r=>r.status===status);
    const page=await products.browseProducts(null,{storeId:record.storeId,limit:100});
    assert.equal(page.products.find(p=>p.id===record.productId).simulatedAvailability,status);
    const availability=await inventory.getProductAvailability(record.productId);
    assert.equal(availability.find(s=>s.storeId===record.storeId).status,status);
    assert(availability.every(s=>s.isDemo===true));
    assert(demoStatusLabel(status).includes('(demo)'));
  }
  assert(DEMO_DISCLAIMER.includes('simulated, not live availability'));
  assert.equal(demoStatusLabel('unknown'),'Demo stock unknown');
  assert.deepEqual(await inventory.getProductAvailability('missing'),[]);
}));

test('store search is partial, case-insensitive, by name or brand, and never leaks unassigned products', async () => isolated(async (_,adapter,products) => {
  await importDemoInventory(adapter,seed);
  const storeId='target-1391';
  const all=await products.browseProducts(null,{storeId,limit:100});
  assert.equal(all.products.length,41);
  for(const query of ['oReO','Cheer','Pepperidge','pasta','NoSuchItem','%','_','\' OR 1=1 --']) {
    const expected=all.products.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())||(p.brand??'').toLowerCase().includes(query.toLowerCase()));
    const actual=await products.searchProducts(query,{storeId,limit:100});
    assert.deepEqual(actual.products.map(p=>p.id),expected.map(p=>p.id));
  }
  assert.equal((await products.browseProducts(null,{limit:100})).products.length,50);
  assert.equal((await products.browseProducts(null,{storeId:'missing'})).products.length,0);
  await assert.rejects(products.browseProducts(null,{storeId:''}), /Store ID/);
}));

test('inventory category counts and filters combine with search without changing global counts', async () => isolated(async (_,adapter,products) => {
  await importDemoInventory(adapter,seed);
  const storeId='target-1391';
  const categories=await products.listCategories(storeId);
  assert.equal(categories.reduce((n,c)=>n+c.productCount,0),41);
  assert.equal((await products.listCategories()).reduce((n,c)=>n+c.productCount,0),50);
  for(const c of categories) {
    const page=await products.browseProducts(c.id,{storeId,limit:100});
    assert.equal(page.products.length,c.productCount);
    assert(page.products.every(p=>p.categoryId===c.id));
    const filtered=await products.searchProducts('a',{storeId,categoryId:c.id,limit:100});
    assert(filtered.products.every(p=>p.categoryId===c.id&&(p.name.toLowerCase().includes('a')||(p.brand??'').toLowerCase().includes('a'))));
  }
}));

test('store pagination, repeated searches and missing categories are bounded and read-only', async () => isolated(async (db,adapter,products) => {
  await importDemoInventory(adapter,seed);
  const before=db.prepare('SELECT total_changes() n').get().n;
  const first=await products.browseProducts(null,{storeId:'target-1391',limit:24});
  const second=await products.browseProducts(null,{storeId:'target-1391',limit:24,offset:24});
  assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
  assert.equal(new Set([...first.products,...second.products].map(p=>p.id)).size,41);
  assert.deepEqual(await products.searchProducts('Oreo',{storeId:'target-1391'}),await products.searchProducts('Oreo',{storeId:'target-1391'}));
  assert.equal((await products.browseProducts('missing',{storeId:'target-1391'})).products.length,0);
  assert.equal(db.prepare('SELECT total_changes() n').get().n,before);
}));

test('inventory product IDs open the same SQLite details and preserve missing-allergen warnings and provenance', async () => isolated(async (_,adapter,products) => {
  const before=await products.getProductById('oreo-original-family');
  await importDemoInventory(adapter,seed);
  assert.deepEqual(await products.getProductById('oreo-original-family'),before);
  const record=records.find(r=>r.productId==='us-lacroix-original');
  const page=await products.browseProducts(null,{storeId:record.storeId,limit:100});
  const card=page.products.find(p=>p.id===record.productId);
  const details=await products.getProductById(card.id);
  assert.equal(card.completenessStatus,'unverified');
  assert.equal(details.ingredients.labelText,null);
  assert.equal(details.allergens.declared.names,null);
  assert.equal(details.allergens.declared.status,'unknown');
  assert.equal(details.allergens.precautionary.status,'unknown');
  assert.equal(details.requiresLabelReview,true);
}));

test('existing accounts, saved profiles, product evidence and store records remain byte-for-byte unchanged', async () => isolated(async (db,adapter) => {
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(500,'Fixture','fixture@example.invalid','same-hash','file://same'); INSERT INTO allergens(id,name,is_custom) VALUES(500,'Fixture allergy',1); INSERT INTO user_allergy_profiles VALUES(500,500); INSERT INTO user_allergies(user_id,allergen) VALUES(500,'Legacy');");
  const tables=['users','allergens','user_allergy_profiles','user_allergies','products','product_ingredients','product_allergens','product_catalog_entries','product_catalog_revisions','stores','store_catalog_entries','store_catalog_revisions'];
  const snapshot=()=>tables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const before=snapshot();await importDemoInventory(adapter,seed);await initialize(adapter);await importDemoInventory(adapter,seed);
  assert.deepEqual(snapshot(),before);
}));

test('invalid seed IDs and foreign keys reject safely and roll back partial imports', async () => isolated(async (db,adapter) => {
  for(const changed of [{...seed,version:2},{...seed,storeIds:[seed.storeIds[0],seed.storeIds[0]]},{...seed,productIds:['bad id']}]) assert.throws(()=>importDemoInventory(adapter,changed));
  await assert.rejects(importDemoInventory(adapter,{...seed,storeIds:[...seed.storeIds,'zz-missing-store']}), /FOREIGN KEY/);
  assert.equal(db.prepare('SELECT count(*) n FROM store_inventory').get().n,0);
  assert.equal((await importDemoInventory(adapter,seed)).inserted,671);
  assert.throws(()=>db.prepare('INSERT INTO demo_inventory_entries VALUES(?,?,?)').run('orphan','orphan','fixture'), /FOREIGN KEY/);
  assert.throws(()=>db.prepare("UPDATE store_inventory SET is_demo=0" ).run(), /CHECK/);
  assert.throws(()=>db.prepare("UPDATE store_inventory SET simulated_status='invented'").run(), /CHECK/);
  assert.throws(()=>db.prepare("UPDATE store_inventory SET simulated_status='out_of_stock',availability_status='available'").run(), /Inconsistent/);
}));

test('unowned inventory and records belonging to another seed are preserved', async () => isolated(async (db,adapter) => {
  const row=records[0];
  db.prepare('INSERT INTO store_inventory(store_id,product_id,availability_status) VALUES(?,?,?)').run(row.storeId,row.productId,'unknown');
  const result=await importDemoInventory(adapter,seed);assert.equal(result.skipped,1);assert.equal(result.inserted,670);
  assert.equal(db.prepare('SELECT simulated_status FROM store_inventory WHERE store_id=? AND product_id=?').get(row.storeId,row.productId).simulated_status,'unknown');
  const other=await importDemoInventory(adapter,{...seed,seedId:'other-demo-v1'});assert(other.skipped>0);
  assert.equal(db.prepare('SELECT simulated_status FROM store_inventory WHERE store_id=? AND product_id=?').get(row.storeId,row.productId).simulated_status,'unknown');
}));

test('v5 inventory upgrades additively, retaining old statuses, rows and foreign keys on repeated initialization', async () => {
  const db=new DatabaseSync(':memory:');
  const adapter={async execAsync(sql){db.exec(sql)},async getFirstAsync(sql){return db.prepare(sql).get()}};
  try {
    // Minimal allergy tables: every real v5 database has them (from v1), and v8 extends them.
    db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE allergens(id INTEGER PRIMARY KEY);
      CREATE TABLE allergen_derivatives(id INTEGER PRIMARY KEY, allergen_id INTEGER);
      CREATE TABLE stores(id TEXT PRIMARY KEY); CREATE TABLE products(id TEXT PRIMARY KEY);
      CREATE TABLE store_inventory(
        store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        availability_status TEXT NOT NULL DEFAULT 'unknown' CHECK(availability_status IN ('available','unavailable','unknown')),
        is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo=1), PRIMARY KEY(store_id,product_id));
      INSERT INTO stores VALUES('fixture'); INSERT INTO products VALUES('one'),('two'),('three');
      INSERT INTO store_inventory VALUES('fixture','one','available',1),('fixture','two','unavailable',1),('fixture','three','unknown',1);
      PRAGMA user_version=5;`);
    const before=db.prepare('SELECT * FROM store_inventory ORDER BY product_id').all();
    await initialize(adapter);await initialize(adapter);
    assert.deepEqual(db.prepare('SELECT store_id,product_id,availability_status,is_demo FROM store_inventory ORDER BY product_id').all(),before);
    const statuses=db.prepare('SELECT product_id,simulated_status FROM store_inventory ORDER BY product_id').all();
    assert.deepEqual(statuses.map(r=>r.simulated_status),['in_stock','unknown','out_of_stock']);
    assert.equal(db.prepare('SELECT count(*) n FROM demo_inventory_entries').get().n,0);
    assert.throws(()=>db.prepare("INSERT INTO store_inventory(store_id,product_id) VALUES('missing','one')").run(), /FOREIGN KEY/);
  } finally {db.close();}
});
