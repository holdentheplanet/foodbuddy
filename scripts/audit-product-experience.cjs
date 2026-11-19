// Development-only review inventory. Never fetches sources, changes catalog data,
// or treats ingredient text / image URLs as verification or permission.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const milestone=require('../catalog/reviews/2026-11-18-goal-200.json');
const photos=require('../assets/products/manifest.json');
const holds=new Set(require('../assets/products/audit-2026-11-19.json').filter(p=>p.decision==='hold').map(p=>p.productId));
const pilot=require('../docs/reviews/official-manufacturer-image-pilot20.json');
const pilotRows=Array.isArray(pilot)?pilot:pilot.products;
const records=new Map();
for(const filename of fs.readdirSync(path.join(root,'catalog/data')).filter(f=>f.endsWith('.json')).sort()){
 for(const p of JSON.parse(fs.readFileSync(path.join(root,'catalog/data',filename),'utf8')).products??[])records.set(p.id,p);
}
const excluded=new Set(milestone.excludedHistoricalVerifiedProductIds);
const products=[...records.values()].map(p=>{
 const verified=p.ingredientVerificationStatus==='verified'&&!excluded.has(p.id)&&!!p.ingredientLabelText?.trim();
 const image=pilotRows.find(row=>row.productId===p.id);
 return {id:p.id,name:p.name,brand:p.brand,variant:p.variant,packageSize:p.packageSize,barcode:p.barcode,
 ingredientTextPresent:!!p.ingredientLabelText?.trim(),documentedVerifiedIngredients:verified,
 verifiedAt:p.verifiedAt,ingredientSource:p.sources.find(s=>s.id===p.ingredientSourceId)??null,
 ingredientReview:verified?'documented_previous_review_not_live_reverified':p.ingredientLabelText?'source_or_identity_review_required':'missing_label',
 allergenStatus:p.allergenStatus,precautionaryStatus:p.precautionaryStatus,
 completeAllergenInformation:verified&&p.allergenStatus==='documented'&&p.precautionaryStatus==='documented',
 sourceReferences:p.sources.map(s=>s.url),
 authorizedBundledPhoto:photos.some(photo=>photo.productId===p.id)&&!holds.has(p.id),
 officialImageCandidate:image?{page:image.manufacturerProductUrl,image:image.officialImageUrl,permission:image.reusePermissionStatus}:null,
 hostedImagePermission:'not_established',
 nextAction:verified?'Recheck exact label when packaging changes; review date is not an expiration guarantee.':'Review exact manufacturer label, size and GTIN before updating through candidate pipeline.'};
});
const count=predicate=>products.filter(predicate).length;
const report={scope:'Structural audit of every bundled product, not fresh external verification of every label.',counts:{total:products.length,ingredientTextPresent:count(p=>p.ingredientTextPresent),missingIngredientText:count(p=>!p.ingredientTextPresent),documentedVerifiedIngredients:count(p=>p.documentedVerifiedIngredients),completeAllergenInformation:count(p=>p.completeAllergenInformation),incompleteAllergenInformation:count(p=>!p.completeAllergenInformation),authorizedBundledPhotos:count(p=>p.authorizedBundledPhoto)},products};
if(process.argv[2]){const output=path.resolve(process.argv[2]);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}else console.log(JSON.stringify(report,null,2));
