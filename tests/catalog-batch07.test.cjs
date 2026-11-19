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
const candidates = require('../catalog/candidates/us-reviewed-batch-07.json');
const approved = require('../catalog/data/us-reviewed-batch-07.json');
const previous = ['us-starter','us-expansion-01','us-reviewed-batch-01','us-reviewed-batch-02','us-reviewed-batch-03','us-reviewed-batch-04','us-reviewed-batch-05','us-reviewed-batch-06'].map(n=>require('../catalog/data/'+n+'.json'));
const oldProducts=previous.flatMap(c=>c.products);
async function isolated(run) {
  const db=new DatabaseSync(':memory:');
  const adapter={async execAsync(sql){db.exec(sql)},async runAsync(sql,args=[]){return db.prepare(sql).run(...args)},async getFirstAsync(sql,args=[]){return db.prepare(sql).get(...args)??null},async getAllAsync(sql,args=[]){return db.prepare(sql).all(...args)}};
  try{await initializeDatabaseConnection(adapter);await run(db,adapter,createLocalProductService(adapter))}finally{db.close()}
}

test('batch07 review approves 22 distinct products in smaller grocery categories',()=>{
  const result=reviewCandidateBatch(candidates,oldProducts,'2026-11-18');
  assert.deepEqual(result.held,[]);assert.equal(canonicalRecord(result.catalog),canonicalRecord(approved));
  assert.equal(oldProducts.length,197);assert.equal(approved.products.length,22);
  assert.deepEqual(approved.products.reduce((a,p)=>{a[p.category]=(a[p.category]||0)+1;return a},{}),{'dairy-eggs':4,'bread-bakery':6,breakfast:6,'condiments-dressings':6});
  assert(approved.products.every(p=>p.ingredientVerificationStatus==='verified'&&p.verifiedAt==='2026-11-18'));
  assert.equal(approved.products.filter(p=>p.allergenStatus==='documented').length,10);
  assert.equal(approved.products.filter(p=>p.completenessStatus==='complete').length,4);
  assert.equal(approved.products.filter(p=>p.precautionaryStatus==='documented').length,4);
});

test('batch07 imports preserve all 197 existing products, ingredients, allergens and provenance',async()=>isolated(async(db,adapter)=>{
  for(const manifest of previous)await importProductCatalog(adapter,manifest);
  const tables=['products','product_ingredients','product_allergens','product_catalog_entries','product_catalog_revisions'];
  const before=tables.map(t=>db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all());
  const result=await importProductCatalog(adapter,approved);assert.equal(result.inserted,22);assert.deepEqual(result.skipped,[]);
  const oldIds=new Set(oldProducts.map(p=>p.id));
  for(let i=0;i<tables.length;i++)assert.deepEqual(db.prepare(`SELECT * FROM ${tables[i]} ORDER BY 1`).all().filter(r=>oldIds.has(tables[i]==='products'?r.id:r.product_id)),before[i]);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,219);
  assert.equal(db.prepare("SELECT count(*) n FROM product_catalog_entries WHERE json_extract(record_json,'$.completenessStatus')='complete'").get().n,39);
  assert.equal(db.prepare("SELECT count(*) n FROM product_catalog_entries WHERE json_extract(record_json,'$.allergenStatus')='unknown' OR json_extract(record_json,'$.precautionaryStatus')='unknown'").get().n,180);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
}));

test('batch07 details retain exact full component panels, declarations and unknown information',async()=>isolated(async(_,adapter,service)=>{
  await importProductCatalog(adapter,approved);
  for(const record of approved.products){
    const detail=await service.getProductById(record.id);
    assert.equal(detail.ingredients.labelText,record.ingredientLabelText);
    assert.equal(detail.ingredients.source.url,record.sources[0].url);
    assert.equal(detail.allergens.declared.statement,record.allergenStatement);
    assert.deepEqual(detail.allergens.declared.names,record.declaredAllergens);
    assert.equal(detail.allergens.precautionary.status,record.precautionaryStatus);
    assert.equal(detail.allergens.precautionary.statement,record.precautionaryStatement);assert.deepEqual(detail.allergens.precautionary.names,record.precautionaryAllergens);
    assert.equal(detail.requiresLabelReview,true);
    if(record.allergenStatus==='unknown'){assert.equal(detail.allergens.declared.statement,null);assert.equal(detail.allergens.declared.names,null)}
  }
  const flip=await service.getProductById('batch07-chobani-flip-red-velvet-cupcake');
  assert.deepEqual(flip.allergens.declared.names,['milk','wheat','soy']);
  assert.deepEqual(flip.allergens.precautionary.names,['peanuts','tree nuts']);
  const sauce=await service.getProductById('batch07-stubbs-sticky-sweet-barbecue-sauce-18-oz');
  assert.equal(sauce.allergens.declared.status,'unknown');assert.equal(sauce.allergens.precautionary.status,'unknown');
  assert(sauce.ingredients.labelText.startsWith('Tomato Puree'));
  assert(!sauce.ingredients.labelText.includes('Gluten-Free'));
  assert(sauce.ingredients.source.evidence.includes('Gluten-Free Ingredients:'));
  const cereal=await service.getProductById('batch07-cheerios-cookies-creme-cheerios-protein');
  assert(cereal.ingredients.labelText.includes('Pea Protein'));
  assert(cereal.ingredients.labelText.includes('Vitamins and Minerals:'));
  assert.equal(cereal.allergens.declared.names,null);

}));

test('batch07 can be found by exact name, partial name, brand and category after repeat imports',async()=>isolated(async(db,adapter,service)=>{
  await importStarterProductCatalog(adapter);const writes=db.prepare('SELECT total_changes() n').get().n;
  for(const r of await Promise.all([importStarterProductCatalog(adapter),importStarterProductCatalog(adapter)])){assert.equal(r.unchanged,219);assert.equal(r.inserted,0);assert.deepEqual(r.skipped,[])}
  assert.equal(db.prepare('SELECT total_changes() n').get().n,writes);
  for(const p of approved.products){
    assert((await service.searchProductsByName(p.name.toLowerCase())).products.some(r=>r.id===p.id));
    assert((await service.searchProductsByName(p.name.slice(0,8),{limit:100})).products.some(r=>r.id===p.id));
    assert((await service.searchProductsByBrand(p.brand,{limit:100})).products.some(r=>r.id===p.id));
    assert((await service.browseProducts(p.category,{limit:100})).products.some(r=>r.id===p.id));
  }
}));

test('batch07 GTIN evidence protects duplicates even when a new identity and barcode format are supplied',()=>{
  const source=approved.products.find(p=>p.barcode?.length===14);assert(source);
  const candidate=structuredClone(candidates.candidates.find(c=>c.product.id===source.id));
  candidate.product.id='duplicate-test';candidate.product.name='Different product name';candidate.product.variant='Different product variant';
  candidate.product.barcode=source.barcode.slice(2);
  candidate.review.identityEvidence=candidate.product.name+'\n'+candidate.product.variant+'\n'+candidate.product.packageSize;
  candidate.product.sources[0].evidence+='\n'+candidate.review.identityEvidence+'\n'+candidate.product.barcode;
  const result=reviewCandidateBatch({formatVersion:1,catalogId:'duplicate-test',candidates:[candidate]},approved.products,'2026-11-18');
  assert.equal(result.catalog.products.length,0);assert.match(result.held[0].reason,/Duplicate barcode or product identity/);
});

test('batch07 does not alter users, saved allergies or existing inventory and enforces foreign keys',async()=>isolated(async(db,adapter)=>{
  db.exec("INSERT INTO users(id,username,email,password_hash,profile_picture) VALUES(94,'Preserve','preserve94@example.invalid','opaque','file:///picture');INSERT INTO user_allergies(user_id,allergen) VALUES(94,'Preserve allergy');");
  const snap=()=>['users','user_allergies','stores','store_inventory'].map(t=>db.prepare(`SELECT * FROM ${t}`).all());const before=snap();
  await importStarterProductCatalog(adapter);await importStarterProductCatalog(adapter);assert.deepEqual(snap(),before);
  assert.throws(()=>db.prepare('INSERT INTO product_ingredients(product_id,ingredient_name) VALUES(?,?)').run('nonexistent-product','fixture ingredient'),/FOREIGN KEY/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
}));

test('shared-line validation requires exact source evidence and keeps positive declarations separate',()=>{
  const original=approved.products.find(p=>p.id==='batch07-chobani-flip-red-velvet-cupcake');
  assert.equal(original.precautionaryStatement,'Manufactured on a line that also handles peanuts and tree nuts.');
  const validate=p=>validateProductCatalog({formatVersion:1,catalogId:'transcription-test',products:[p]},'2026-11-18');
  validate(original);
  const wrongClause=structuredClone(original);wrongClause.precautionaryAllergens=['milk'];
  assert.throws(()=>validate(wrongClause),/not explicitly named/);
  const noEvidence=structuredClone(original);noEvidence.sources[0].evidence=noEvidence.sources[0].evidence.replaceAll(noEvidence.precautionaryStatement,'');
  assert.throws(()=>validate(noEvidence),/exact source evidence/);
  const inventedType=structuredClone(original);inventedType.precautionaryAllergens.push('walnut');
  assert.throws(()=>validate(inventedType),/not explicitly named/);
});

test('final catalog reaches exactly 200 audited ingredient lists without counting unresolved legacy evidence',async()=>isolated(async(db,adapter,service)=>{
  await importStarterProductCatalog(adapter);
  const audit=require('../catalog/reviews/2026-11-18-audit.json');
  const historical=new Map(audit.products.map(p=>[p.productId,p.countTowardGoal]));
  const all=[...oldProducts,...approved.products];
  const eligible=all.filter(p=>p.ingredientVerificationStatus==='verified'&&(historical.get(p.id)??true));
  assert.equal(eligible.length,200);assert.equal(all.length,219);
  assert.equal(all.filter(p=>p.ingredientVerificationStatus!=='verified').length,17);
  const excluded=all.filter(p=>p.ingredientVerificationStatus==='verified'&&historical.get(p.id)===false);
  assert.equal(excluded.length,2);
  const ids=[];
  for(let offset=0;offset<all.length;offset+=100){
    const page=await service.browseProducts(null,{limit:100,offset});
    ids.push(...page.products.map(p=>p.id));
    assert.equal(page.hasMore,offset+page.products.length<all.length);
  }
  assert.equal(new Set(ids).size,219);assert.deepEqual(new Set(ids),new Set(all.map(p=>p.id)));
  assert.equal((await service.browseProducts(null,{limit:100,offset:300})).products.length,0);
  assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,219);
}));
