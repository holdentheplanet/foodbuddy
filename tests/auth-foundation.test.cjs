const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { createSecureSessionStorage } = load('auth/secureSessionStorage.ts');
const { createSessionScope } = load('auth/sessionScope.ts');
const { validateSupabaseConfig } = load('auth/config.ts');
const { createAuthOperations } = load('auth/operations.ts');
const { initializeIdentitySchema, resolveLocalAccount, assertLocalOwner } = load('auth/localIdentity.ts');
const { initializeDatabaseConnection } = load('database/migrations.ts');
function secureDevice() {
  const values = new Map(); let n = 0;
  const backend = { async getItem(k) { return values.get(k) ?? null; }, async setItem(k,v) { assert(Buffer.byteLength(v)<=2048); values.set(k,Buffer.from(v).toString('utf8')); }, async removeItem(k) { values.delete(k); } };
  return { values, backend, adapter: createSecureSessionStorage(backend, () => `generation-${++n}`) };
}
function sqlite(file=':memory:') {
  const db = new DatabaseSync(file);
  return { db, adapter: { async execAsync(sql) { db.exec(sql); }, async getFirstAsync(sql,args=[]) { return db.prepare(sql).get(...args) ?? null; }, async runAsync(sql,args=[]) { const r=db.prepare(sql).run(...args); return { lastInsertRowId:Number(r.lastInsertRowid), changes:Number(r.changes) }; } } };
}
const A={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.invalid',user_metadata:{username:'Fixture'}};
const B={...A,id:'22222222-2222-4222-8222-222222222222'};
test('secure storage supports large Unicode sessions, replacement and cleanup',async()=>{
 const d=secureDevice(),value=JSON.stringify({token:'x🔐'.repeat(4000)});await d.adapter.setItem('session',value);assert.equal(await d.adapter.getItem('session'),value);
 await d.adapter.setItem('session','replacement');assert.equal(await d.adapter.getItem('session'),'replacement');assert.equal(d.values.size,2);await d.adapter.removeItem('session');assert.equal(await d.adapter.getItem('session'),null);assert.equal(d.values.size,0);
});
test('failed partial secure write preserves prior session and removes incomplete new chunks',async()=>{
 const d=secureDevice();await d.adapter.setItem('session','prior');const write=d.backend.setItem;d.backend.setItem=async(k,v)=>{if(k.endsWith('.1'))throw Error('native failure');return write(k,v);};await assert.rejects(d.adapter.setItem('session','x'.repeat(1000)));assert.equal(await d.adapter.getItem('session'),'prior');assert.equal(d.values.size,2);
});
test('missing or corrupt secure manifest/chunks never yield a partial session',async()=>{
 const d=secureDevice();d.values.set('session','invalid');assert.equal(await d.adapter.getItem('session'),null);await d.adapter.setItem('session','x'.repeat(800));d.values.delete('session.generation-1.1');assert.equal(await d.adapter.getItem('session'),null);
});
test('same Supabase account has independent per-device persisted tokens and local logout',async()=>{
 const a=secureDevice(),b=secureDevice();await a.adapter.setItem('session','device-a');await b.adapter.setItem('session','device-b');await a.adapter.removeItem('session');assert.equal(await b.adapter.getItem('session'),'device-b');assert.equal(await a.adapter.getItem('session'),null);
});
test('concurrent token refresh/storage operations serialize deterministically',async()=>{
 const d=secureDevice();await Promise.all([d.adapter.setItem('session','a'),d.adapter.setItem('session','b')]);assert.equal(await d.adapter.getItem('session'),'b');assert.equal(d.values.size,2);
});
test('scope rejects requests from old account, logout, and same-account re-login',()=>{
 const s=createSessionScope();assert.equal(s.capture().isCurrent(),false);s.replace(A.id);const old=s.capture();s.replace(B.id);assert.equal(old.isCurrent(),false);const b=s.capture();s.replace(null);assert.equal(b.isCurrent(),false);s.replace(A.id);assert.equal(old.isCurrent(),false);assert.equal(s.capture().isCurrent(),true);
});
test('config rejects placeholders/secret keys/insecure URLs without exposing values',()=>{
 for(const [url,key] of [[undefined,undefined],['http://example.invalid','sb_publishable_fixture'],['https://example.invalid','sb_secret_do-not-display'],['https://u:password@example.invalid','sb_publishable_fixture']]){
  assert.throws(()=>validateSupabaseConfig(url,key),e=>!e.message.includes('do-not-display')&&!e.message.includes('u:password'));
 }
 assert.equal(validateSupabaseConfig('https://example.invalid','sb_publishable_fixture').url,'https://example.invalid');
});
test('confirmation-required signup never treats a returned user as an authenticated session',async()=>{
 let request;const auth=createAuthOperations({auth:{async signUp(v){request=v;return {data:{session:null,user:A},error:null}}}});const result=await auth.register(' Shopper ',' SYNTHETIC@example.invalid ','test-only-password');assert.equal(result.session,null);assert.equal(result.confirmationRequired,true);assert.equal(request.email,'synthetic@example.invalid');assert.equal(request.options.data.username,'Shopper');
});
test('logout explicitly uses local scope, never global',async()=>{
 let scope;await createAuthOperations({auth:{async signOut(v){scope=v.scope;return {error:null}}}}).logout();assert.equal(scope,'local');
});
test('login errors are generic and do not echo tokens/server error strings',async()=>{
 const auth=createAuthOperations({auth:{async signInWithPassword(){return {data:{session:null},error:{message:'sensitive-token'}}}}});await assert.rejects(auth.login('synthetic@example.invalid','test-only-password'),e=>!e.message.includes('sensitive-token'));
});
test('account mappings do not auto-link same-email legacy accounts and preserve all legacy data',async()=>{
 const d=sqlite();try{await initializeDatabaseConnection(d.adapter);d.db.exec("INSERT INTO users(id,username,email,password_hash) VALUES(42,'Legacy','synthetic@example.invalid','preserved-hash'); INSERT INTO allergens(id,name) VALUES(1,'Fixture'); INSERT INTO user_allergy_profiles VALUES(42,1);");await initializeIdentitySchema(d.adapter);const user=await resolveLocalAccount(d.adapter,A);assert.notEqual(user.id,42);assert.equal(d.db.prepare('SELECT password_hash FROM users WHERE id=42').get().password_hash,'preserved-hash');assert.equal(d.db.prepare('SELECT count(*) n FROM user_allergy_profiles WHERE user_id=?').get(user.id).n,0);assert.equal(d.db.prepare('SELECT count(*) n FROM user_allergy_profiles WHERE user_id=42').get().n,1);}finally{d.db.close();}
});
test('different users on one device resolve to separate IDs; concurrent repeats do not duplicate',async()=>{
 const d=sqlite();try{await initializeDatabaseConnection(d.adapter);await initializeIdentitySchema(d.adapter);const [a,b,c]=await Promise.all([resolveLocalAccount(d.adapter,A),resolveLocalAccount(d.adapter,B),resolveLocalAccount(d.adapter,A)]);assert.notEqual(a.id,b.id);assert.equal(a.id,c.id);await assertLocalOwner(d.adapter,A.id,a.id);await assert.rejects(assertLocalOwner(d.adapter,B.id,a.id));assert.equal(d.db.prepare('SELECT count(*) n FROM cloud_account_links').get().n,2);}finally{d.db.close();}
});
test('UUID mapping survives restart and may differ across devices without affecting identity',async()=>{
 const file=join(mkdtempSync(join(tmpdir(),'foodbuddy-auth-')),'isolated.db');const d=sqlite(file);await initializeDatabaseConnection(d.adapter);await initializeIdentitySchema(d.adapter);const a=await resolveLocalAccount(d.adapter,A);d.db.close();const reopened=sqlite(file);try{await initializeIdentitySchema(reopened.adapter);assert.equal((await resolveLocalAccount(reopened.adapter,A)).id,a.id);}finally{reopened.db.close();}
 const second=sqlite();try{await initializeDatabaseConnection(second.adapter);await initializeIdentitySchema(second.adapter);await resolveLocalAccount(second.adapter,B);const a2=await resolveLocalAccount(second.adapter,A);assert.notEqual(a2.id,a.id);assert.equal(a2.supabaseId,a.supabaseId);}finally{second.db.close();}
});
test('mapping foreign keys prevent orphaned identities; malformed UUID rejected before writes',async()=>{
 const d=sqlite();try{await initializeDatabaseConnection(d.adapter);await initializeIdentitySchema(d.adapter);await assert.rejects(resolveLocalAccount(d.adapter,{id:'1'}));assert.throws(()=>d.db.prepare('INSERT INTO cloud_account_links VALUES(?,?)').run(A.id,99));assert.equal(d.db.prepare('SELECT count(*) n FROM users').get().n,0);}finally{d.db.close();}
});
test('cloud SQL includes explicit RLS ownership checks and never disables RLS',()=>{
 const sql=readFileSync('supabase/migrations/202611180001_foodbuddy_accounts.sql','utf8');assert.equal((sql.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,3);assert.equal((sql.match(/WITH CHECK \(\(SELECT auth.uid\(\)\)=user_id/g)||[]).length,3);assert(!/DISABLE ROW LEVEL SECURITY|DROP TABLE/i.test(sql));assert.match(sql,/FROM PUBLIC,anon,authenticated/);assert.equal((sql.match(/is_anonymous/g)||[]).length,6);assert.match(sql,/has_table_privilege\('anon',target,privilege_name\)/);assert.match(sql,/has_table_privilege\('authenticated',target,privilege_name\)/);
});
test('legacy ownership proof verifies existing hashes locally without accepting plaintext',async()=>{
 const { verifyLegacyPassword }=load('auth/legacyOwnership.ts');const { pbkdf2Sync }=require('node:crypto');const salt='00112233445566778899aabbccddeeff';const hash=pbkdf2Sync('fixture-only-password',Buffer.from(salt,'hex'),16,32,'sha256').toString('hex');const stored=`pbkdf2-sha256$16$${salt}$${hash}`;
 assert.equal(await verifyLegacyPassword('fixture-only-password',stored),true);assert.equal(await verifyLegacyPassword('wrong',stored),false);assert.equal(await verifyLegacyPassword('fixture-only-password','fixture-only-password'),false);
});
test('offline auth failure is explicit and recovery does not expose server details',async()=>{
 const auth=createAuthOperations({auth:{async signInWithPassword(){return {data:{session:null},error:{message:'network private details'}}},async resetPasswordForEmail(){return {error:{message:'sensitive fixture'}}}}});await assert.rejects(auth.login('synthetic@example.invalid','fixture'),/Could not sign in/);await assert.rejects(auth.requestPasswordReset('synthetic@example.invalid'),e=>!e.message.includes('sensitive fixture'));
});
