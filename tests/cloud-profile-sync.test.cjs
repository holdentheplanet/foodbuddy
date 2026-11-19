const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const load = require('./helpers/load-typescript.cjs');
const { createSessionScope } = load('auth/sessionScope.ts');
const { waitForProfileSync } = load('auth/navigationSync.ts');

function harness() {
 const db = new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE allergens(id INTEGER PRIMARY KEY,name TEXT,user_id INTEGER,is_custom INTEGER);
 CREATE TABLE user_allergy_profiles(user_id INTEGER,allergen_id INTEGER,PRIMARY KEY(user_id,allergen_id));
 CREATE TABLE cloud_allergy_sync(supabase_id TEXT PRIMARY KEY,names_json TEXT);
 INSERT INTO allergens VALUES(1,'Peanut',NULL,0),(2,'Milk',NULL,0);`);
 const adapter={async getAllAsync(sql,args=[]){return db.prepare(sql).all(...args)},async getFirstAsync(sql,args=[]){return db.prepare(sql).get(...args)??null},async runAsync(sql,args=[]){const r=db.prepare(sql).run(...args);return {lastInsertRowId:Number(r.lastInsertRowid)}},async withExclusiveTransactionAsync(fn){db.exec('BEGIN');try{await fn(adapter);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}};
 const scope=createSessionScope();scope.replace('account-a');
 const remote=new Map();let afterPush=()=>{};let failPull=false;let pushes=0;let profiles=0;
 const client = {
  from(table) {
   return {
    async upsert(rows) {
     if (table === 'foodbuddy_profiles') { profiles++; return { error: null }; }
     pushes++;
     for (const row of rows) remote.set(row.allergen_key, { ...row });
     await afterPush();
     return { error: null };
    },
    select() {
     return {
      eq() { return this; },
      async limit() {
       return failPull ? { error: { message: 'offline' }, data: null } : {
        error: null,
        data: [...remote.values()].filter(row => row.selected).map(row => ({ allergen_key: row.allergen_key, allergen_name: row.allergen_name })),
       };
      },
     };
    },
   };
  },
 };
 const filename=path.resolve('auth/cloudProfile.ts');const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=request=>{
  if(request==='../database/db')return {db:adapter};
  if(request==='../database/auth')return {accountScope:scope};
  if(request==='./supabase')return {getSupabase:()=>client};
  if(request==='./localIdentity')return {assertLocalOwner:async(_db,uuid,id)=>{assert.equal(uuid,'account-a');assert.equal(id,1)}};
  throw Error('Unexpected dependency '+request);
 };
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
 return {db,scope,remote,user:{id:1,supabaseId:'account-a',username:'Fixture'},sync:mod.exports.syncCloudProfile,
  setAfterPush(fn){afterPush=fn},setFailPull(value){failPull=value},pushes:()=>pushes,profiles:()=>profiles,
  selected:()=>db.prepare('SELECT allergen_id FROM user_allergy_profiles WHERE user_id=1 ORDER BY allergen_id').all().map(r=>r.allergen_id)};
}

test('cloud sync imports selected declarations without changing other users',async()=>{
 const h=harness();try{h.db.exec('INSERT INTO user_allergy_profiles VALUES(1,1),(2,2)');h.remote.set('milk',{allergen_key:'milk',allergen_name:'Milk',selected:true});await h.sync(h.user);assert.deepEqual(h.selected(),[1,2]);assert.equal(h.db.prepare('SELECT count(*) n FROM user_allergy_profiles WHERE user_id=2').get().n,1)}finally{h.db.close()}
});

test('removing a selection during its push is retained on retry instead of resurrected',async()=>{
 const h=harness();try{h.db.exec('INSERT INTO user_allergy_profiles VALUES(1,1)');h.setAfterPush(()=>h.db.exec('DELETE FROM user_allergy_profiles WHERE user_id=1'));
 await assert.rejects(h.sync(h.user),/changed during sync/);assert.deepEqual(h.selected(),[]);
 h.setAfterPush(()=>{});await h.sync(h.user);assert.deepEqual(h.selected(),[]);assert.equal(h.remote.get('peanut').selected,false);
 }finally{h.db.close()}
});

test('an acknowledged push survives pull failure and subsequent offline edits',async()=>{
 const h=harness();try{h.db.exec('INSERT INTO user_allergy_profiles VALUES(1,1)');h.setFailPull(true);await assert.rejects(h.sync(h.user),/complete cloud/);
 h.db.exec('DELETE FROM user_allergy_profiles WHERE user_id=1');h.setFailPull(false);await h.sync(h.user);assert.deepEqual(h.selected(),[]);assert.equal(h.remote.get('peanut').selected,false);
 }finally{h.db.close()}
});

test('adding a selection mid-sync is preserved and pushed on retry',async()=>{
 const h=harness();try{h.db.exec('INSERT INTO user_allergy_profiles VALUES(1,1)');h.setAfterPush(()=>h.db.exec('INSERT OR IGNORE INTO user_allergy_profiles VALUES(1,2)'));await assert.rejects(h.sync(h.user),/changed during sync/);
 h.setAfterPush(()=>{});await h.sync(h.user);assert.deepEqual(h.selected(),[1,2]);assert.equal(h.remote.get('milk').selected,true);
 }finally{h.db.close()}
});

test('account switching rejects stale sync before local changes are applied',async()=>{
 const h=harness();try{h.db.exec('INSERT INTO user_allergy_profiles VALUES(1,1)');h.setAfterPush(()=>h.scope.replace('account-b'));await assert.rejects(h.sync(h.user),/Account changed/);assert.deepEqual(h.selected(),[1]);assert.equal(h.db.prepare('SELECT count(*) n FROM cloud_allergy_sync').get().n,0)}finally{h.db.close()}
});

test('overlapping sync calls share one request per account',async()=>{
 const h=harness();try{await Promise.all([h.sync(h.user),h.sync(h.user)]);assert.equal(h.profiles(),1)}finally{h.db.close()}
});

test('profile navigation allows bounded local fallback and handles late failures',async()=>{
 assert.equal(await waitForProfileSync(Promise.resolve(),20),'synced');
 assert.equal(await waitForProfileSync(Promise.reject(Error('offline')),20),'offline');
 let reject;const slow=new Promise((_,r)=>{reject=r});assert.equal(await waitForProfileSync(slow,2),'pending');reject(Error('late offline'));await new Promise(r=>setTimeout(r,1));
});
