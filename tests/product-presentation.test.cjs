const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const load = require('./helpers/load-typescript.cjs');
const photos = require('../assets/products/manifest.json');
const audit = require('../assets/products/audit-2026-11-19.json');
const held = new Set(audit.filter(review=>review.decision==='hold').map(review=>review.productId));
const milestone = require('../catalog/reviews/2026-11-18-goal-200.json');
const products = fs.readdirSync(path.resolve('catalog/data')).filter(f=>f.endsWith('.json')).flatMap(f=>require('../catalog/data/'+f).products);
const { productEvidence } = load(path.resolve('ui/productEvidence.ts'));
const summary = p=>({id:p.id,ingredientVerificationStatus:p.ingredientVerificationStatus,completenessStatus:p.completenessStatus});

test('recorded photographs map only to exact existing product identities and barcodes',()=>{
  assert.equal(photos.length,14);assert.equal(new Set(photos.map(p=>p.productId)).size,14);
  for(const photo of photos){
    const product=products.find(p=>p.id===photo.productId);assert(product);
    for(const field of ['name','brand','variant','packageSize','barcode'])assert.equal(photo[field],product[field]);
    assert.equal(new URL(photo.sourceUrl).hostname,'world.openfoodfacts.org');
    assert.equal(new URL(photo.sourceUrl).pathname.split('/').pop().padStart(14,'0'),product.barcode.padStart(14,'0'));
    assert.equal(new URL(photo.imageUrl).hostname,'images.openfoodfacts.org');
    assert(photo.attribution.startsWith('Open Food Facts contributors ('));
    assert.equal(photo.license,'CC BY-SA 3.0');assert.equal(photo.licenseUrl,'https://creativecommons.org/licenses/by-sa/3.0/');
    assert(['2026-11-18','2026-11-19'].includes(photo.reviewedAt));assert(photo.identityReview);assert(photo.changes);
  }
});

test('bundled photos have intact JPEG bytes and matching source hashes with a small offline footprint',()=>{
  let bytes=0;
  for(const p of photos){
    assert.equal(path.basename(p.file),p.file);
    const data=fs.readFileSync(path.resolve('assets/products',p.file));bytes+=data.length;
    assert.equal(data.readUInt16BE(0),0xffd8);assert.equal(data.readUInt16BE(data.length-2),0xffd9);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),p.sha256);
  }
  assert(bytes<1024*1024);
});

test('photo registry uses exact bundled files and has no alternate-brand or remote-image fallback',()=>{
  const old= require.extensions['.jpg'];
  require.extensions['.jpg']=(module,filename)=>{module.exports={__bundledAssetPath:filename}};
  let getProductPhoto;
  try{({getProductPhoto}=load(path.resolve('ui/productPhotos.ts')))}finally{if(old)require.extensions['.jpg']=old;else delete require.extensions['.jpg']}
  for(const p of photos){ if(held.has(p.productId))assert.equal(getProductPhoto(p.productId),null); else assert.equal(getProductPhoto(p.productId).source.__bundledAssetPath,path.resolve('assets/products',p.file)); }
  for(const p of products.filter(p=>!photos.some(photo=>photo.productId===p.id)))assert.equal(getProductPhoto(p.id),null);
  assert.equal(getProductPhoto('missing-product'),null);
});

test('verified ingredient evidence never implies complete allergen information',()=>{
  const p={id:'presentation-fixture',ingredientVerificationStatus:'verified',completenessStatus:'partial'};
  assert.equal(productEvidence(p).ingredientVerified,true);assert.equal(productEvidence(p).allergensDocumented,false);
  assert.equal(productEvidence(p).allergenLabel,'Allergen information incomplete');
  const complete=productEvidence({...p,completenessStatus:'complete'});
  assert.equal(complete.allergensDocumented,true);assert.equal(complete.allergenLabel,'Allergen statements recorded');
  const unverified=productEvidence({...p,ingredientVerificationStatus:'unverified',completenessStatus:'complete'});
  assert.equal(unverified.ingredientVerified,false);assert.equal(unverified.allergensDocumented,false);
  assert.equal(productEvidence({...p,ingredientVerificationStatus:'unknown',completenessStatus:'unknown'}).ingredientVerified,false);
});

test('historical source-review holds remain visibly distinct without mutating their stored evidence',()=>{
  for(const id of milestone.excludedHistoricalVerifiedProductIds){
    const p=products.find(p=>p.id===id);const before=JSON.stringify(p);assert.equal(p.ingredientVerificationStatus,'verified');
    const evidence=productEvidence(summary(p));assert.equal(evidence.ingredientVerified,false);assert.equal(evidence.ingredientLabel,'Ingredient source needs review');
    assert.equal(JSON.stringify(p),before);
  }
});

test('presentation preserves the 219-product catalog and its 200 versus 39 evidence distinctions',()=>{
  assert.equal(products.length,219);
  assert.equal(products.filter(p=>productEvidence(summary(p)).ingredientVerified).length,200);
  assert.equal(products.filter(p=>productEvidence(summary(p)).allergensDocumented).length,39);
  assert.equal(products.filter(p=>!productEvidence(summary(p)).allergensDocumented).length,180);
  assert.equal(products.filter(p=>!photos.some(photo=>photo.productId===p.id)).length,205);
});

 test('photo audit retains six clear photos and withholds four unsuitable images without removing provenance',()=>{
  assert.equal(audit.length,10);assert.equal(held.size,4);
  assert.equal(new Set(audit.map(row=>row.productId)).size,10);
  for(const row of audit){assert(photos.some(photo=>photo.productId===row.productId));assert(row.reason);assert(row.sourceUrl);assert(row.licenseUrl);}
 });

test('photo pilot stays within exactly 15 new barcode-backed candidates and records every decision',()=>{
  const pilot=require('../assets/products/photo-pilot15-2026-11-19.json');
  assert.equal(pilot.length,15);assert.equal(new Set(pilot.map(row=>row.id)).size,15);
  assert.equal(pilot.filter(row=>row.decision==='approved').length,4);
  assert.equal(pilot.filter(row=>row.decision==='rejected').length,5);
  assert.equal(pilot.filter(row=>row.decision==='needs_review').length,6);
  for(const row of pilot){
    const product=products.find(p=>p.id===row.id);assert(product);
    for(const field of ['name','brand','variant','packageSize','barcode'])assert.equal(row[field],product[field]);
    assert(!audit.some(old=>old.productId===row.id));
    assert(row.reason);assert(row.manufacturerSourceUrl);assert(row.manufacturerTermsUrl);assert(row.manufacturerImageDecision);
    assert.equal(photos.some(p=>p.productId===row.id),row.decision==='approved');
  }
});
test('each pilot asset preserves uploader, selected-image evidence and redistribution conditions',()=>{
  for(const photo of photos.filter(row=>row.reviewBatch==='pilot15-2026-11-19')){
    const evidence=require('../assets/products/reviews/'+photo.productId+'.json');
    assert.equal(evidence.decision,'approved');assert.equal(evidence.imageUrl,photo.imageUrl);
    assert(evidence.uploader);assert(evidence.selectedImageId);assert(evidence.selectedImageRevision);
    assert.equal(photo.attribution,'Open Food Facts contributors ('+evidence.uploader+')');
    assert(photo.licenseEvidenceUrl);assert(photo.reuseConditions.includes('same license'));
    assert(photo.manufacturerSourceUrl);assert.equal(photo.reviewedAt,'2026-11-19');
  }
});
