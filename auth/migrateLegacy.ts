import { db } from '../database/db';
import { accountScope, type User } from '../database/auth';
import { getSupabase } from './supabase';
import { assertLocalOwner } from './localIdentity';
import { verifyLegacyPassword } from './legacyOwnership';
/** Explicit dual ownership proof. Does not modify legacy rows, derivatives, or password hashes. */
export async function importLegacyAllergySelections(user: User, oldPassword: string) {
  const scope = accountScope.capture();
  const check = () => { if (scope.userId !== user.supabaseId || !scope.isCurrent()) throw new Error('Account changed.'); };
  check();
  const { data, error } = await getSupabase().auth.getUser();
  if (error || data.user?.id !== user.supabaseId || !data.user.email_confirmed_at || !data.user.email) throw new Error('Verify your Supabase email and sign in online first.');
  await assertLocalOwner(db, user.supabaseId, user.id); check();
  const legacy = await db.getFirstAsync<{ id: number; password_hash: string }>(
    'SELECT id,password_hash FROM users WHERE email=? COLLATE NOCASE AND id NOT IN (SELECT local_user_id FROM cloud_account_links)', [data.user.email]);
  if (!legacy || !await verifyLegacyPassword(oldPassword, legacy.password_hash)) throw new Error('Legacy account ownership could not be verified.');
  check();
  const old = await db.getAllAsync<{ id: number; user_id: number | null }>('SELECT a.id,a.user_id FROM allergens a JOIN user_allergy_profiles p ON p.allergen_id=a.id WHERE p.user_id=?', [legacy.id]);
  // Custom terms belong to the legacy owner. Never move/copy teammate data silently.
  if (old.some(a => a.user_id !== null)) throw new Error('This legacy profile includes private custom allergens. Manual migration with your teammate is required; nothing was changed.');
  for (const allergy of old) { check(); await db.runAsync('INSERT OR IGNORE INTO user_allergy_profiles(user_id,allergen_id) VALUES (?,?)', [user.id, allergy.id]); }
}
