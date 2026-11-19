const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const {productAllergyStatus}=load(path.resolve('ui/productAllergyStatus.ts'));
const base={status:'no_matches',matches:[],savedAllergyCount:1,informationIncomplete:false,missingInformation:[],allowedBySettings:[]};
test('confirmed conflicts take priority over missing evidence',()=>{const value=productAllergyStatus({...base,status:'conflict',informationIncomplete:true,matches:[{allergen:'Milk',matchedIngredient:'milk'}]},false);assert.equal(value.tone,'red');assert.match(value.reason,/Milk: milk/);});
test('missing profile, unknown check, caution and missing evidence remain yellow',()=>{for(const result of [null,{...base,savedAllergyCount:0},{...base,status:'unknown'},{...base,status:'caution'},{...base,informationIncomplete:true}])assert.equal(productAllergyStatus(result).tone,'yellow');assert.equal(productAllergyStatus(base,false).tone,'yellow');});
test('green requires evaluated profile and complete evidence',()=>{assert.equal(productAllergyStatus(base,true).tone,'green');assert.equal(productAllergyStatus(base,true).label,'No known matches');});
