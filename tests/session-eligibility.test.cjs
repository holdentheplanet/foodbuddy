const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const { canUseAccountSession } = load('auth/sessionEligibility.ts');
const { createAuthOperations } = load('auth/operations.ts');
test('email-confirmation-disabled signup accepts the returned session without an email verification timestamp', async () => {
  const session={expires_at:2000,user:{id:'fixture-uuid',is_anonymous:false}};
  const auth=createAuthOperations({auth:{async signUp(){return {data:{session},error:null}}}});
  const result=await auth.register('Fixture','fixture@example.invalid','fixture-only-password');
  assert.equal(result.session,session);assert.equal(result.confirmationRequired,false);
  assert.equal(canUseAccountSession(result.session,1000000),true);
});
test('missing, expired, malformed and anonymous sessions remain rejected', () => {
  const valid={expires_at:2000,user:{id:'fixture-uuid'}};
  assert.equal(canUseAccountSession(null,1000000),false);
  assert.equal(canUseAccountSession({...valid,expires_at:1000},1000000),false);
  assert.equal(canUseAccountSession({...valid,expires_at:NaN},1000000),false);
  assert.equal(canUseAccountSession({...valid,expires_at:undefined},1000000),false);
  assert.equal(canUseAccountSession({...valid,user:{id:''}},1000000),false);
  assert.equal(canUseAccountSession({...valid,user:{id:'fixture-uuid',is_anonymous:true}},1000000),false);
});
