import { db } from '../database/db';
import { accountScope, type User } from '../database/auth';
import { assertLocalOwner } from './localIdentity';
import { getSupabase } from './supabase';
const inFlight = new Map<string, Promise<void>>();
const key = (name: string) => name.trim().toLowerCase();
async function selections(localId: number) {
  return db.getAllAsync<{ id: number; name: string }>('SELECT a.id,a.name FROM allergens a JOIN user_allergy_profiles p ON p.allergen_id=a.id WHERE p.user_id=? ORDER BY a.name', [localId]);
}
/** Persisted baseline is an outbox-by-difference: offline changes survive restarts. */
export function syncCloudProfile(user: User): Promise<void> {
  const running = inFlight.get(user.supabaseId);
  if (running) return running;
  const result = sync(user).finally(() => inFlight.delete(user.supabaseId));
  inFlight.set(user.supabaseId, result);
  return result;
}
async function sync(user: User) {
  const scope = accountScope.capture();
  const check = () => { if (scope.userId !== user.supabaseId || !scope.isCurrent()) throw new Error('Account changed.'); };
  check();
  await assertLocalOwner(db, user.supabaseId, user.id); check();
  const client = getSupabase();
  const profile = await client.from('foodbuddy_profiles').upsert({ user_id: user.supabaseId, username: user.username }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (profile.error) throw new Error('Cloud sync unavailable. Check connection and apply the FoodBuddy SQL migration. Local data is preserved.');
  check();
  const selected = await selections(user.id); check();
  const baseline = await db.getFirstAsync<{ names_json: string }>('SELECT names_json FROM cloud_allergy_sync WHERE supabase_id=?', [user.supabaseId]);
  const prior: string[] = baseline ? JSON.parse(baseline.names_json) : [];
  const current = new Map(selected.map(a => [key(a.name), a.name]));
  const changes = [...current].filter(([k]) => !prior.includes(k)).map(([k, name]) => ({ user_id: user.supabaseId, allergen_key: k, allergen_name: name, selected: true }));
  for (const name of prior) if (!current.has(name)) changes.push({ user_id: user.supabaseId, allergen_key: name, allergen_name: name, selected: false });
  check();
  if (changes.length) {
    const pushed = await client.from('foodbuddy_allergy_selections').upsert(changes, { onConflict: 'user_id,allergen_key' });
    if (pushed.error) throw new Error('Allergy sync failed. Local changes will be retried.');
    // Persist acknowledged intent before pulling. If a user edits during the
    // network round-trip, the next sync must diff against what actually reached
    // the cloud, rather than resurrecting a just-removed selection.
    await db.withExclusiveTransactionAsync(async tx => {
      check();
      await tx.runAsync('INSERT INTO cloud_allergy_sync(supabase_id,names_json) VALUES (?,?) ON CONFLICT(supabase_id) DO UPDATE SET names_json=excluded.names_json',
        [user.supabaseId, JSON.stringify([...current.keys()].sort())]);
      check();
    });
  }
  check();
  const pulled = await client.from('foodbuddy_allergy_selections').select('allergen_key,allergen_name').eq('user_id', user.supabaseId).eq('selected', true).limit(500);
  if (pulled.error || !pulled.data || pulled.data.length === 500) throw new Error('Could not safely load the complete cloud allergy profile.');
  check();
  // Exclusive transaction prevents user edits during the compare/apply phase.
  await db.withExclusiveTransactionAsync(async tx => {
    check();
    const now = await tx.getAllAsync<{ name: string }>('SELECT a.name FROM allergens a JOIN user_allergy_profiles p ON p.allergen_id=a.id WHERE p.user_id=? ORDER BY a.name', [user.id]);
    if (JSON.stringify(now.map(a => key(a.name))) !== JSON.stringify(selected.map(a => key(a.name)))) throw new Error('Allergy profile changed during sync. Retry.');
    const wanted = new Set<string>();
    for (const remote of pulled.data) {
      check();
      const name = remote.allergen_name;
      if (typeof name !== 'string' || !name.trim() || key(name) !== remote.allergen_key) throw new Error('Invalid cloud allergy record.');
      let local = await tx.getFirstAsync<{ id: number }>('SELECT id FROM allergens WHERE name=? COLLATE NOCASE AND (user_id IS NULL OR user_id=?)', [name, user.id]);
      if (!local) {
        const collision = await tx.getFirstAsync<{ id: number }>('SELECT id FROM allergens WHERE name=? COLLATE NOCASE', [name]);
        if (collision) throw new Error('A private custom-allergen name conflicts on this device. Local data was preserved.');
        const created = await tx.runAsync('INSERT INTO allergens(name,is_custom,user_id) VALUES (?,1,?)', [name, user.id]);
        local = { id: created.lastInsertRowId };
      }
      await tx.runAsync('INSERT OR IGNORE INTO user_allergy_profiles(user_id,allergen_id) VALUES (?,?)', [user.id, local.id]);
      wanted.add(key(name));
    }
    for (const local of selected) if (!wanted.has(key(local.name))) {
      check(); await tx.runAsync('DELETE FROM user_allergy_profiles WHERE user_id=? AND allergen_id=?', [user.id, local.id]);
    }
    check();
    await tx.runAsync('INSERT INTO cloud_allergy_sync(supabase_id,names_json) VALUES (?,?) ON CONFLICT(supabase_id) DO UPDATE SET names_json=excluded.names_json',
      [user.supabaseId, JSON.stringify([...wanted].sort())]);
  });
}
