import type { SupabaseClient } from '@supabase/supabase-js';

function emailAddress(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}
function passwordValue(value: string) {
  if (value.length < 8) throw new Error('Password must be at least 8 characters.');
  return value;
}

/** Fixed messages only: never echo server text, submitted credentials, or arbitrary codes. */
function signupError(error: { code?: string; status?: number; name?: string }): Error {
  const messages: Record<string, string> = {
    email_address_invalid: 'Supabase rejected this email address. Use an email inbox you can access.',
    email_address_not_authorized: 'Supabase email delivery is restricted to project organization members. Use your Supabase organization email for this test, or configure custom SMTP.',
    weak_password: 'Your password does not meet the Supabase project requirements. Choose a stronger password.',
    over_email_send_rate_limit: 'Supabase email sending is rate-limited. Wait before trying again.',
    over_request_rate_limit: 'Too many authentication requests. Wait a few minutes before trying again.',
    email_provider_disabled: 'Email/password signup is disabled in the Supabase project.',
    signup_disabled: 'New account registration is disabled in the Supabase project.',
    captcha_failed: 'Supabase requires a valid CAPTCHA. The signup integration needs CAPTCHA configuration.',
    unexpected_failure: 'Supabase could not complete signup. Check the project Auth logs.',
  };
  const known = typeof error.code === 'string' && Object.prototype.hasOwnProperty.call(messages, error.code)
    ? messages[error.code] : undefined;
  if (known) return new Error(known);
  if (error.name === 'AuthRetryableFetchError') return new Error('Could not reach Supabase reliably. Check your internet connection and try again.');
  if (error.status === 401) return new Error('Supabase rejected app authorization (HTTP 401). Recheck the project URL and publishable key in .env.');
  if (error.status === 429) return new Error('Supabase is rate-limiting signup (HTTP 429). Wait before trying again.');
  const status = Number.isInteger(error.status) && error.status! >= 400 && error.status! <= 599 ? ` (HTTP ${error.status})` : '';
  return new Error(`Could not register${status}. Check the Supabase Auth logs for the failed signup.`);
}

/** Injected client keeps operations testable and never handles local password hashes. */
export function createAuthOperations(client: Pick<SupabaseClient, 'auth'>) {
  return {
    async register(username: string, email: string, password: string) {
      if (!username.trim() || username.trim().length > 100) throw new Error('Enter a username of 1–100 characters.');
      const { data, error } = await client.auth.signUp({ email: emailAddress(email), password: passwordValue(password),
        options: { data: { username: username.trim() } } });
      if (error) throw signupError(error);
      // A user object without a session does NOT grant access to account data.
      return { session: data.session, confirmationRequired: !data.session };
    },
    async login(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email: emailAddress(email), password });
      if (error || !data.session) throw new Error('Could not sign in. Check your email, password, and internet connection.');
      return data.session;
    },
    async logout() {
      // Supabase defaults to global sign-out; explicitly preserve other devices.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new Error('Could not finish signing out. Reconnect and try again.');
    },
    async requestPasswordReset(email: string) {
      const { error } = await client.auth.resetPasswordForEmail(emailAddress(email));
      if (error) throw new Error('Could not request a password reset. Please try again later.');
    },
    async verifyRecoveryCode(email: string, code: string) {
      if (!/^\d{6,10}$/.test(code.trim())) throw new Error('Enter the recovery code from your email.');
      const { data, error } = await client.auth.verifyOtp({ email: emailAddress(email), token: code.trim(), type: 'recovery' });
      if (error || !data.session) throw new Error('Recovery code expired or invalid. Request a new code.');
      return data.session;
    },
    async updatePassword(password: string) {
      const { error } = await client.auth.updateUser({ password: passwordValue(password) });
      if (error) throw new Error('Could not change your password. Sign in or verify a recovery code first.');
    },
  };
}
