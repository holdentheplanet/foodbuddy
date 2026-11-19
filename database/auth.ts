import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { db } from './db';
import { getSupabase } from '../auth/supabase';
import { createAuthOperations } from '../auth/operations';
import { assertLocalOwner, resolveLocalAccount, type Account } from '../auth/localIdentity';
import { createSessionScope } from '../auth/sessionScope';
import { canUseAccountSession } from '../auth/sessionEligibility';

export type User = Account;
export const accountScope = createSessionScope();
let activeId: string | null = null;
let eventRevision = 0;
const listeners = new Set<(user: User | null) => void>();
function clearAccount() { activeId = null; eventRevision++; accountScope.replace(null); for (const notify of listeners) notify(null); }
async function accountForSession(session: Session | null) {
  if (!session || !canUseAccountSession(session)) return null;
  return resolveLocalAccount(db, session.user);
}
async function requireOwner(localId: number) {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session || data.session.user.id !== activeId || !data.session.expires_at || data.session.expires_at * 1000 <= Date.now()) throw new Error('Sign in again to access this account.');
  const capture = accountScope.capture();
  await assertLocalOwner(db, data.session.user.id, localId);
  if (!capture.isCurrent()) throw new Error('Account changed. Please try again.');
  return capture;
}
export function watchCurrentUser(onChanged: (user: User | null) => void, onError: () => void) {
  const client = getSupabase();
  let alive = true;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  listeners.add(onChanged);
  function receive(session: Session | null) {
    if (!alive) return;
    if (expiry) clearTimeout(expiry);
    const nextId = session?.user.id ?? null;
    if (nextId !== activeId) { clearAccount(); activeId = nextId; accountScope.replace(nextId); }
    const revision = ++eventRevision;
    // Do not await auth APIs inside onAuthStateChange (the SDK holds its auth lock).
    void Promise.resolve().then(() => accountForSession(session)).then(user => {
      if (!alive || revision !== eventRevision) return;
      if (!user) { clearAccount(); return; }
      onChanged(user);
      expiry = setTimeout(() => { clearAccount(); }, Math.max(0, session!.expires_at! * 1000 - Date.now()));
    }).catch(() => { if (alive && revision === eventRevision) { clearAccount(); onError(); } });
  }
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => receive(session));
  const initialRevision = eventRevision;
  void client.auth.getSession().then(({ data, error }) => {
    if (!alive || initialRevision !== eventRevision) return;
    if (error) { clearAccount(); onError(); } else receive(data.session);
  }).catch(() => { if (alive) { clearAccount(); onError(); } });
  const refresh = (state: string) => { if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); };
  refresh(AppState.currentState);
  const app = AppState.addEventListener('change', refresh);
  return () => { alive = false; if (expiry) clearTimeout(expiry); listeners.delete(onChanged); subscription.unsubscribe(); app.remove(); client.auth.stopAutoRefresh(); };
}
export async function registerUser(username: string, email: string, password: string): Promise<User | null> {
  const { session } = await createAuthOperations(getSupabase()).register(username, email, password);
  return accountForSession(session);
}
export async function loginUser(email: string, password: string): Promise<User | null> {
  return accountForSession(await createAuthOperations(getSupabase()).login(email, password));
}
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw new Error('Session could not be restored. Connect to the internet and sign in again.');
  return accountForSession(data.session);
}
export async function logoutUser(): Promise<void> {
  clearAccount();
  await createAuthOperations(getSupabase()).logout();
}
export async function updateProfilePicture(localId: number, pictureUri: string): Promise<User> {
  const capture = await requireOwner(localId);
  await db.runAsync('UPDATE users SET profile_picture=? WHERE id=? AND EXISTS(SELECT 1 FROM cloud_account_links WHERE local_user_id=? AND supabase_id=?)',
    [pictureUri, localId, localId, capture.userId]);
  if (!capture.isCurrent()) throw new Error('Account changed.');
  const user = await getCurrentUser();
  if (!user || !capture.isCurrent()) throw new Error('Account changed.');
  return user;
}
export async function changePassword(localId: number, currentPassword: string, newPassword: string) {
  const capture = await requireOwner(localId);
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session?.user.email) throw new Error('Sign in again.');
  if (newPassword === currentPassword) throw new Error('Choose a different password.');
  // Isolated ephemeral auth client avoids switching the persisted device session during verification.
  const { createClient } = await import('@supabase/supabase-js');
  const { validateSupabaseConfig } = await import('../auth/config');
  const config = validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const verifier = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const checked = await verifier.auth.signInWithPassword({ email: data.session.user.email, password: currentPassword });
    if (checked.error || checked.data.user?.id !== capture.userId || !capture.isCurrent()) throw new Error('Current password incorrect or account changed.');
    await createAuthOperations(verifier).updatePassword(newPassword);
  } finally { await verifier.auth.signOut({ scope: 'local' }); }
}
