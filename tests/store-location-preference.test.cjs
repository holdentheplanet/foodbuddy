const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const {createStoreLocationPreferences,selectedZipLocation,storeLocationKey,storeLocationAfterGPS}=load(path.resolve('services/storeLocationPreference.ts'));
const {lookupZip}=load(path.resolve('services/zipLocation.ts'));
function fixture(){const data=new Map();return {data,service:createStoreLocationPreferences({getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value);}})};}
test('new users get the documented Charleston ZIP reference, never an inferred GPS position',async()=>{const {service}=fixture();assert.equal(await service.load(1),null);assert.deepEqual(selectedZipLocation(null).position,lookupZip('29401').position);assert.match(selectedZipLocation(null).message,/Charleston.*Default/);});
test('manual ZIP survives new service instances and remains isolated by local account',async()=>{const {data,service}=fixture();await service.save(1,'10001');await service.save(2,'80202');const restarted=createStoreLocationPreferences({getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}});assert.equal(await restarted.load(1),'10001');assert.equal(await restarted.load(2),'80202');assert.equal(await restarted.load(3),null);assert.deepEqual(selectedZipLocation(await restarted.load(1)).position,lookupZip('10001').position);});
test('invalid ZIP and account IDs cannot overwrite preferences',async()=>{const {data,service}=fixture();await service.save(1,'10001');await assert.rejects(service.save(1,'00000'));assert.throws(()=>storeLocationKey(0));assert.equal(await service.load(1),'10001');assert.equal(data.size,1);});
test('corrupt or unsupported preferences default without rewriting existing bytes',async()=>{const {data,service}=fixture();for(const raw of ['bad','{"version":2,"zip":"10001"}','{"version":1,"zip":"00000"}']){data.set(storeLocationKey(1),raw);assert.equal(await service.load(1),null);assert.equal(data.get(storeLocationKey(1)),raw);}});
test('ordered writes preserve the latest manual ZIP even when saves overlap',async()=>{const {service}=fixture();await Promise.all([service.save(1,'10001'),service.save(1,'29401')]);assert.equal(await service.load(1),'29401');});

test('denied, disabled and unavailable GPS use saved manual location before Charleston default',()=>{for(const status of ['denied','disabled','unavailable']){const result={status,position:null,message:'GPS unavailable',accuracy:null,timestamp:null,mocked:false};assert.equal(storeLocationAfterGPS(result,'10001').source,'zip');assert.deepEqual(storeLocationAfterGPS(result,'10001').location.position,lookupZip('10001').position);assert.equal(storeLocationAfterGPS(result,null).source,'default');assert.deepEqual(storeLocationAfterGPS(result,null).location.position,lookupZip('29401').position);}});
test('explicit successful GPS selects its fix without changing a saved manual ZIP',async()=>{const {service}=fixture();await service.save(1,'10001');const result={status:'available',position:{latitude:37.7749,longitude:-122.4194},message:'GPS',accuracy:10,timestamp:1,mocked:true};assert.equal(storeLocationAfterGPS(result,await service.load(1)).source,'gps');assert.equal(await service.load(1),'10001');});

test('automatic GPS/cache records never become a persistent default and their original bytes are preserved',async()=>{
  const {data,service}=fixture();
  for(const source of ['gps','automatic','cached_gps']){
    const raw=JSON.stringify({version:1,source,zip:'10001',latitude:40.75,longitude:-73.99});
    data.set(storeLocationKey(1),raw);
    assert.equal(await service.load(1),null);
    assert.deepEqual(selectedZipLocation(await service.load(1)).position,{latitude:32.77718,longitude:-79.932});
    assert.equal(data.get(storeLocationKey(1)),raw);
  }
});
test('legacy manual NYC choice is respected; future explicit choices record manual provenance',async()=>{
  const {data,service}=fixture();const raw='{"version":1,"zip":"10001"}';data.set(storeLocationKey(1),raw);
  assert.equal(await service.load(1),'10001');assert.equal(data.get(storeLocationKey(1)),raw);
  assert.match((await service.loadPreference(1)).notice,/provenance/);
  await service.save(1,'29401');assert.deepEqual(JSON.parse(data.get(storeLocationKey(1))),{version:2,source:'manual_zip',zip:'29401'});
});
test('unknown formats do not silently overwrite a potentially manual location',async()=>{
  const {data,service}=fixture();const raw='{"version":9,"zip":"10001","coordinates":[40.75,-73.99]}';data.set(storeLocationKey(1),raw);
  assert.equal(await service.load(1),null);assert.match((await service.loadPreference(1)).notice,/preserved/);assert.equal(data.get(storeLocationKey(1)),raw);
});
test('shared default coordinates drive ZIP selection, map origin, and distance calculations',()=>{
  const {storeOriginRegion}=load(path.resolve('services/storeLocationPreference.ts'));
  const {distanceMiles}=load(path.resolve('services/storeDistance.ts'));
  const origin=selectedZipLocation(null).position;const region=storeOriginRegion(origin,25);
  assert.equal(region.latitude,32.77718);assert.equal(region.longitude,-79.932);
  assert.equal(distanceMiles(origin,region),0);assert.deepEqual(selectedZipLocation('29401').position,origin);
});
