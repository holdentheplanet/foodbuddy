const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const pilot=require('../docs/reviews/official-manufacturer-image-pilot20.json');
const inventory=require('../docs/reviews/product-image-source-inventory219.json');
const products=fs.readdirSync('catalog/data').filter(f=>f.endsWith('.json')).flatMap(f=>require('../catalog/data/'+f).products);
test('official-image pilot records only 20 barcode-matched existing identities without granting reuse',()=>{
 assert.equal(pilot.length,20);assert.equal(new Set(pilot.map(row=>row.productId)).size,20);
 assert.equal(pilot.filter(row=>row.sizeEvidence).length,16);
 for(const row of pilot){const p=products.find(p=>p.id===row.productId);assert(p);assert.equal(row.barcode,p.barcode);assert.equal(row.manufacturerBarcode.padStart(14,'0'),p.barcode.padStart(14,'0'));assert.equal(row.packageSize,p.packageSize);assert.equal(row.reusePermissionStatus,'permission_required');assert.equal(row.applicableReuseLicense,null);assert.equal(row.downloaded,false);assert.equal(row.bundled,false);assert(row.termsUrl);assert(row.officialImageUrl.startsWith('https://'));assert.match(row.pageSha256,/^[a-f0-9]{64}$/);}
});
test('full source inventory keeps unreviewed image status explicit for the remaining 199 products',()=>{
 assert.equal(inventory.length,219);assert.equal(new Set(inventory.map(row=>row.productId)).size,219);
 assert.equal(inventory.filter(row=>row.officialImageReview==='not_reviewed').length,199);
 for(const row of inventory){const p=products.find(p=>p.id===row.productId);assert.equal(row.name,p.name);assert.deepEqual(row.sourceReferences,p.sources.map(source=>source.url));}
});
