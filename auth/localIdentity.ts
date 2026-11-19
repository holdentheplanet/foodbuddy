import type { SQLiteDatabase } from 'expo-sqlite';
type IdentityDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'runAsync'>;
export type CloudIdentity = { id: string; email?: string; user_metadata?: { username?: unknown } };
export type Account = { id: number; supabaseId: string; username: string; email: string; profile_picture: string | null };
export async function initializeIdentitySchema(db: IdentityDatabase) {
  // Separate additive infrastructure; existing migration versions and derivative SQL stay unchanged.
  await db.execAsync(`CREATE TABLE IF NOT EXISTS cloud_account_links (
    supabase_id TEXT PRIMARY KEY NOT NULL,
    local_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE IF NOT EXISTS cloud_allergy_sync (
    supabase_id TEXT PRIMARY KEY NOT NULL REFERENCES cloud_account_links(supabase_id),
    names_json TEXT NOT NULL
  );`);
}
const reads = new WeakMap<IdentityDatabase, Promise<unknown>>();
/** Never associate a legacy row by email. UUID is the only identity lookup key. */
export function resolveLocalAccount(db: IdentityDatabase, identity: CloudIdentity): Promise<Account> {
  const previous = reads.get(db) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(async () => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.id)) throw new Error('Invalid authenticated account ID.');
    const existing = await db.getFirstAsync<{ id: number; username: string; profile_picture: string | null }>(
      'SELECT u.id,u.username,u.profile_picture FROM cloud_account_links c JOIN users u ON u.id=c.local_user_id WHERE c.supabase_id=?', [identity.id]);
    if (existing) return { ...existing, supabaseId: identity.id, email: identity.email ?? '' };
    const username = typeof identity.user_metadata?.username === 'string' && identity.user_metadata.username.trim()
      ? identity.user_metadata.username.trim() : 'FoodBuddy shopper';
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      // Deliberately non-loginable local shadow row; no Supabase password/token is stored in SQLite.
      const row = await db.runAsync('INSERT INTO users(username,email,password_hash) VALUES (?,?,?)',
        [username, `${identity.id}@supabase.invalid`, 'supabase-managed-no-local-password']);
      await db.runAsync('INSERT INTO cloud_account_links(supabase_id,local_user_id) VALUES (?,?)', [identity.id, row.lastInsertRowId]);
      await db.execAsync('COMMIT');
      return { id: row.lastInsertRowId, supabaseId: identity.id, email: identity.email ?? '', username, profile_picture: null };
    } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
  });
  reads.set(db, result);
  return result;
}
export async function assertLocalOwner(db: IdentityDatabase, supabaseId: string, localId: number) {
  const row = await db.getFirstAsync<{ local_user_id: number }>('SELECT local_user_id FROM cloud_account_links WHERE supabase_id=?', [supabaseId]);
  if (row?.local_user_id !== localId) throw new Error('Account changed. Please try again.');
}
