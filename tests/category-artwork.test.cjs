const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const load=require('./helpers/load-typescript.cjs');const {categoryArtworkInfo,productImageMode}=load(path.resolve('ui/categoryArtworkInfo.ts'));const {GROCERY_CATEGORIES}=load(path.resolve('catalog/categories.ts'));
const manifest=require('../assets/categories/manifest.json');
test('all ten database categories have bundled original artwork with disclosed purpose and prompts',()=>{
 assert.equal(manifest.length,GROCERY_CATEGORIES.length);
 for(const category of GROCERY_CATEGORIES){const info=categoryArtworkInfo(category.id);const record=manifest.find(r=>r.categoryId===category.id);assert(record);assert.equal(record.file,info.file);assert.match(record.purpose,/not actual product packaging/);assert(record.prompt.length>40);assert.match(info.label,/illustration.*not actual product packaging/);const image=fs.readFileSync(path.resolve('assets/categories',info.file));assert.equal(image.readUInt16BE(0),0xffd8);assert(image.length>1000);}
});
test('approved product photos always win; failed and missing photos use category artwork',()=>{assert.equal(productImageMode(true,false),'photo');assert.equal(productImageMode(true,true),'category_art');assert.equal(productImageMode(false,false),'category_art');});
test('unknown categories and historical aliases resolve without external requests',()=>{assert.equal(categoryArtworkInfo('cookies').id,'snacks-candy');for(const id of [null,'missing','__proto__'])assert.equal(categoryArtworkInfo(id).id,'pantry');});
