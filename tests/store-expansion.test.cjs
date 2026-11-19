const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { initializeDatabaseConnection } = load(path.resolve('database/migrations.ts'));
const { importStoreCatalog } = load(path.resolve('stores/importer.ts'));
const { findStoreConflict, normalizedStoreAddress } = load(path.resolve('stores/identity.ts'));
const { createLocalStoreService } = load(path.resolve('services/localStoreService.ts'));
const legacy = require('../stores/data/charleston-01.json');
async function isolated(run) {
 const db = new DatabaseSync(':memory:');
 const adapter={async execAsync(sql){db.exec(sql)},async runAsync(sql,args=[]){return db.prepare(sql).run(...args)},async getFirstAsync(sql,args=[]){return db.prepare(sql).get(...args)??null},async getAllAsync(sql,args=[]){return db.prepare(sql).all(...args)}};
 try {await initializeDatabaseConnection(adapter);await importStoreCatalog(adapter,legacy);await run(db,adapter)}finally{db.close()}
}
function fixture(overrides={}) { return {...structuredClone(legacy.stores[0]), id:'fixture-new', ...overrides}; }

test('normalized addresses match abbreviations and punctuation without relying on chain',()=>{
 const first=fixture({streetAddress:'123 North Main Street',city:'Example',state:'NY'});
 const second=fixture({id:'other',streetAddress:'123 N. Main St.',city:'EXAMPLE',state:'NY',chain:'Different'});
 assert.equal(normalizedStoreAddress(first),normalizedStoreAddress(second));
 assert.equal(findStoreConflict(first,[second]).reason,'normalized_address');
});

test('original OSM type and ID deduplicate across catalog IDs and URL variants',()=>{
 const a=fixture({sources:[{url:'https://www.openstreetmap.org/node/123',kind:'openstreetmap',evidence:'Fixture'}]});
 const b=fixture({id:'other',streetAddress:'Different',latitude:0,longitude:0,sources:[{url:'https://openstreetmap.org/node/123/',kind:'openstreetmap',evidence:'Fixture'}]});
 assert.equal(findStoreConflict(a,[b]).reason,'source_identity');
});

test('nearby ambiguous locations are flagged rather than merged; distant branches stay distinct',()=>{
 const first=fixture(); const nearby=fixture({id:'nearby',name:'Different name',chain:'Different',streetAddress:'Other street',latitude:first.latitude+0.00001});
 assert.equal(findStoreConflict(first,[nearby]).reason,'proximity_review_required');
 const far=fixture({id:'far',streetAddress:'Different street',latitude:first.latitude+1});
 assert.equal(findStoreConflict(first,[far]),null);
});

test('cross-catalog duplicate address skips incoming record and preserves original evidence',async()=>isolated(async(db,adapter)=>{
 const before=db.prepare('SELECT * FROM store_catalog_entries ORDER BY store_id').all();
 const duplicate=fixture({id:'new-id',streetAddress:legacy.stores[0].streetAddress.toUpperCase()});
 duplicate.sources.forEach(source=>{source.evidence=source.evidence.replaceAll(legacy.stores[0].streetAddress,duplicate.streetAddress)});
 const result=await importStoreCatalog(adapter,{formatVersion:1,catalogId:'other-catalog',stores:[duplicate]});
 assert.equal(result.inserted,0);assert.equal(result.conflicts[0].reason,'normalized_address');
 assert.deepEqual(db.prepare('SELECT * FROM store_catalog_entries ORDER BY store_id').all(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM stores').get().n,17);
}));

test('cross-catalog proximity conflict preserves separate identities and performs no writes',async()=>isolated(async(db,adapter)=>{
 const existing=legacy.stores[0];const candidate=fixture({id:'nearby-other',name:'Fixture nearby',chain:'Different',streetAddress:'999 Different Street',latitude:existing.latitude+0.00001});
 candidate.verificationStatus='unverified';candidate.sources=[{url:'https://www.target.com/fixture',kind:'official_directory',evidence:`999 Different Street ${candidate.latitude} ${candidate.longitude}`}];
 const result=await importStoreCatalog(adapter,{formatVersion:1,catalogId:'fixture',stores:[candidate]});
 assert.equal(result.inserted,0);assert.equal(result.conflicts[0].reason,'proximity_review_required');
 assert.equal(db.prepare('SELECT count(*) n FROM stores').get().n,17);
}));

test('legacy stores without inventory return explicit false; store loading never creates inventory',async()=>isolated(async(db,adapter)=>{
 const stores=await createLocalStoreService(adapter).listStores();
 assert(stores.every(s=>s.hasInventory===false)); assert.equal(db.prepare('SELECT count(*) n FROM store_inventory').get().n,0);
}));

const expansion = require('../stores/data/osm-us-metros.json');
const { importLocalStores } = load(path.resolve('stores/index.ts'));
const { importStarterProductCatalog } = load(path.resolve('catalog/index.ts'));
const { importDemoInventory } = load(path.resolve('inventory/importer.ts'));
const demo = require('../inventory/data/demo-v1.json');
const { validateStoreCatalog } = load(path.resolve('stores/validation.ts'));
const { browseStores } = load(path.resolve('services/storeBrowsing.ts'));
const { lookupZip } = load(path.resolve('services/zipLocation.ts'));

test('150 documented OSM stores have complete original tags, exact source IDs and no independent verification claims',()=>{
 assert.equal(expansion.stores.length,150);validateStoreCatalog(expansion);
 const counts={};
 for(const store of expansion.stores){
  counts[store.dataset.metro]=(counts[store.dataset.metro]??0)+1;
  assert.equal(store.verificationStatus,'unverified');
  assert.equal(findStoreConflict(store,[...legacy.stores,...expansion.stores]),null);
 }
 assert.equal(Object.keys(counts).length,6);assert(Object.values(counts).every(n=>n===25));
 const invalid=structuredClone(expansion);invalid.stores[0].name+=' Unsupported';assert.throws(()=>validateStoreCatalog(invalid),/original grocery identity/);
 const stronger=structuredClone(expansion);stronger.stores[0].verificationStatus='verified';assert.throws(()=>validateStoreCatalog(stronger),/unverified status/);
});

test('expansion imports repeatably, preserves Charleston evidence, all 219 products and existing user/demo inventory',async()=>isolated(async(db,adapter)=>{
 await importStarterProductCatalog(adapter);await importDemoInventory(adapter,demo);
 db.exec("INSERT INTO users(id,username,email,password_hash) VALUES(1,'Fixture','fixture@example.invalid','unchanged');");
 const protectedTables=['users','products','product_ingredients','product_allergens','product_catalog_entries','product_catalog_revisions','store_inventory','demo_inventory_entries'];
 const snapshot=()=>protectedTables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all());
 const originalStores=db.prepare('SELECT * FROM stores ORDER BY id').all();
 const originalEvidence=db.prepare('SELECT * FROM store_catalog_entries ORDER BY store_id').all();
 const before=snapshot();
 const first=await importLocalStores(adapter);assert.equal(first.inserted,150);assert.equal(first.conflicts.length,0);
 const count=db.prepare('SELECT total_changes() n').get().n;
 for(let i=0;i<2;i++) {const again=await importLocalStores(adapter);assert.equal(again.unchanged,167);assert.equal(again.inserted,0)}
 assert.equal(db.prepare('SELECT total_changes() n').get().n,count);assert.deepEqual(snapshot(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,219);
 assert.equal(db.prepare('SELECT count(*) n FROM stores').get().n,167);
 assert.equal(db.prepare('SELECT count(*) n FROM store_inventory').get().n,671);
 for(const old of originalStores)assert.deepEqual(db.prepare('SELECT * FROM stores WHERE id=?').get(old.id),old);
 for(const old of originalEvidence)assert.deepEqual(db.prepare('SELECT * FROM store_catalog_entries WHERE store_id=?').get(old.store_id),old);
 const stores=await createLocalStoreService(adapter).listStores();
 assert.equal(stores.filter(s=>s.hasInventory).length,17);assert(stores.filter(s=>s.dataset).every(s=>!s.hasInventory));
 for(const zip of ['10001','30303','60601','75201','80202','90012']){
  const result=browseStores(stores,{origin:lookupZip(zip).position,browseAll:false,query:'',chain:null,radiusMiles:25});
  assert.equal(result.total,25,zip);assert.equal(result.visible.length,10);assert(result.hasMore);
  assert(result.visible.every((s,i,a)=>!i||s.distanceMiles>=a[i-1].distanceMiles));
 }
}));

test('chain filters match source capitalization variants without rewriting stored names',()=>{
 const values=[{...fixture({id:'a',chain:'ALDI'}),distanceMiles:null},{...fixture({id:'b',chain:'Aldi'}),distanceMiles:null}];
 const result=browseStores(values,{origin:null,browseAll:true,query:'',chain:'aldi',radiusMiles:25});
 assert.equal(result.total,2);assert.deepEqual(values.map(s=>s.chain),['ALDI','Aldi']);
});
