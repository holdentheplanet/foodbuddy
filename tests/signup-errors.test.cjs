const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const { createAuthOperations } = load('auth/operations.ts');
function attempt(error) {
  return createAuthOperations({ auth: { async signUp() { return { data: {}, error }; } } }).register('Fixture', 'fixture@example.invalid', 'fixture-only-password');
}
test('signup reports restricted email delivery and rate limits with actionable fixed messages', async () => {
  await assert.rejects(attempt({ code: 'email_address_not_authorized' }), /restricted to project organization members/);
  await assert.rejects(attempt({ code: 'over_email_send_rate_limit' }), /rate-limited/);
});
test('signup distinguishes rejected app authorization from network and weak-password errors', async () => {
  await assert.rejects(attempt({ status: 401 }), /rejected app authorization \(HTTP 401\)/);
  await assert.rejects(attempt({ name: 'AuthRetryableFetchError' }), /internet connection/);
  await assert.rejects(attempt({ code: 'weak_password' }), /password does not meet/);
});
test('unknown signup errors never echo server messages, arbitrary codes, or unsafe status values', async () => {
  for (const error of [{ message: 'fixture-secret', code: 'fixture-secret', status: 500 }, { code: '__proto__' }, { status: 'fixture-secret' }]) {
    await assert.rejects(attempt(error), e => !e.message.includes('fixture-secret') && !e.message.includes('__proto__') && /Could not register/.test(e.message));
  }
});
