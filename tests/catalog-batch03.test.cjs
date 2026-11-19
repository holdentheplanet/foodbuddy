const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const { initializeDatabaseConnection } = load(path.resolve('database/migrations.ts'));
const { importProductCatalog } = load(path.resolve('catalog/importer.ts'));
const { importStarterProductCatalog } = load(path.resolve('catalog/index.ts'));
const { reviewCandidateBatch } = load(path.resolve('catalog/review.ts'));
const { createLocalProductService } = load(path.resolve('services/localProductService.ts'));
const { canonicalRecord, validateProductCatalog } = load(path.resolve('catalog/validation.ts'));
const candidates = require('../catalog/candidates/us-reviewed-batch-03.json');
const approved = require('../catalog/data/us-reviewed-batch-03.json');
const previous = ['us-starter','us-expansion-01','us-reviewed-batch-01','us-reviewed-batch-02'].map(n=>require('../catalog/data/'+n+'.json'));
const oldProducts=previous.flatMap(c=>c.products);
async function isolated(run) {
  const db=new DatabaseSync(':memory:');
  const adapter={async execAsync(sql){db.exec(sql)},async runAsync(sql,args=[]){return db.prepare(sql).run(...args)},async getFirstAsync(sql,args=[]){return db.prepare(sql).get(...args)??null},async getAllAsync(sql,args=[]){return db.prepare(sql).all(...args)}};
  try{await initializeDatabaseConnection(adapter);await run(db,adapter,createLocalProductService(adapter))}finally{db.close()}
}

test('batch03 review approves 25 distinct real products with 15 documented precautions and 10 unknowns',()=>{
  const result=reviewCandidateBatch(candidates,oldProducts,'2026-11-18');
  assert.deepEqual(result.held,[]);assert.equal(canonicalRecord(result.catalog),canonicalRecord(approved));
  assert.equal(approved.products.length,25);
  assert.equal(approved.products.filter(p=>p.brand==='Nature Valley').length,22);
  assert.equal(approved.products.filter(p=>p.brand==="HERSHEY'S").length,3);
  assert(approved.products.every(p=>p.ingredientVerificationStatus==='verified'&&p.allergenStatus==='documented'));
  assert.equal(approved.products.filter(p=>p.completenessStatus==='complete').length,15);
  assert.equal(approved.products.filter(p=>p.completenessStatus==='partial').length,10);
});

test('verbatim combined declarations separate contains from may-contain without ingredient inference',async()=>isolated(async(_,adapter,service)=>{
  await importProductCatalog(adapter,approved);
  for(const record of approved.products){
    const detail=await service.getProductById(record.id);
    assert.equal(detail.allergens.declared.statement,record.allergenStatement);
    assert.deepEqual(detail.allergens.declared.names,record.declaredAllergens);
    assert.equal(detail.allergens.precautionary.statement,record.precautionaryStatement);
    assert.deepEqual(detail.allergens.precautionary.names,record.precautionaryAllergens);
    if(record.precautionaryStatus==='unknown'){assert.equal(detail.allergens.precautionary.names,null);assert.equal(detail.completenessStatus,'partial')}
  }
  const cashew=await service.getProductById('batch03-nature-cashew-sweet-salty-granola-bars');
  assert(cashew.allergens.declared.names.includes('cashew'));
  assert.deepEqual(cashew.allergens.precautionary.names,['pecan','macadamia']);
  assert(!cashew.allergens.declared.names.includes('macadamia'));
}));

test('manufacturer-linked baking photographs retain exact label wording and provenance',()=>{
  const milk=approved.products.find(p=>p.name==="HERSHEY'S Milk Chocolate Chips");
  assert(milk.ingredientLabelText.includes('LECITHIN (SOY)'));
  assert(milk.ingredientLabelText.includes('[SUGAR; CHOCOLATE;'));
  assert.equal(milk.ingredientSourceId,'label-photo');
  const photo=milk.sources.find(s=>s.id==='label-photo');
  assert.equal(photo.kind,'manufacturer_label_photo');assert(photo.url.startsWith('https://s7d1.scene7.com/is/image/hersheyprodcloud/'));
  for(const bad of ['https://s7d1.scene7.com/is/image/unrelated/label','https://example.invalid/label']){
    const invalid=structuredClone(approved);invalid.products.find(p=>p.id===milk.id).sources.find(s=>s.id==='label-photo').url=bad;
    assert.throws(()=>validateProductCatalog(invalid),/manufacturer/);
  }
});

test('batch03 adds 25 products and preserves all 100 prior rows, ingredients, allergens and provenance',async()=>isolated(async(db,adapter)=>{
  for(const manifest of previous)await importProductCatalog(adapter,manifest);
  const tables=['products','product_ingredients','product_allergens','product_catalog_entries','product_catalog_revisions'];
  const before=tables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const result=await importProductCatalog(adapter,approved);assert.equal(result.inserted,25);assert.deepEqual(result.skipped,[]);
  const oldIds=new Set(oldProducts.map(p=>p.id));
  for(let i=0;i<tables.length;i++)assert.deepEqual(db.prepare(`SELECT * FROM ${tables[i]} ORDER BY 1`).all().filter(r=>oldIds.has(tables[i]==='products'?r.id:r.product_id)),before[i]);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,125);
  assert.equal(db.prepare("SELECT count(*) n FROM product_catalog_entries WHERE json_extract(record_json,'$.completenessStatus')='complete'").get().n,22);
  assert.equal(db.prepare("SELECT count(*) n FROM product_catalog_entries WHERE json_extract(record_json,'$.allergenStatus')='unknown' OR json_extract(record_json,'$.precautionaryStatus')='unknown'").get().n,103);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
}));

test('complete-catalog repeats are idempotent and product browsing stays local and searchable',async()=>isolated(async(db,adapter,service)=>{
  await importStarterProductCatalog(adapter);const writes=db.prepare('SELECT total_changes() n').get().n;
  for(const r of await Promise.all([importStarterProductCatalog(adapter),importStarterProductCatalog(adapter)])){assert.equal(r.unchanged,219);assert.equal(r.inserted,0);assert.deepEqual(r.skipped,[])}
  assert.equal(db.prepare('SELECT total_changes() n').get().n,writes);
  for(const p of approved.products){
    const detail=await service.getProductById(p.id);assert.equal(detail.ingredients.labelText,p.ingredientLabelText);assert.equal(detail.ingredients.source.id,p.ingredientSourceId);
    assert((await service.searchProductsByName(p.name)).products.some(r=>r.id===p.id));
    assert((await service.searchProductsByBrand(p.brand,{limit:100})).products.some(r=>r.id===p.id));
    assert((await service.browseProducts(p.category,{limit:100})).products.some(r=>r.id===p.id));
    assert.equal(detail.requiresLabelReview,true);
  }
}));

test('batch03 leaves account records and saved allergy selections unchanged',async()=>isolated(async(db,adapter)=>{
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(93,'Preserve','preserve93@example.invalid','opaque','file:///picture');INSERT INTO user_allergies(user_id,allergen) VALUES(93,'Preserve allergy');");
  const snap=()=>['users','user_allergies'].map(t=>db.prepare(`SELECT * FROM ${t}`).all());const before=snap();
  await importStarterProductCatalog(adapter);await importStarterProductCatalog(adapter);assert.deepEqual(snap(),before);
}));
