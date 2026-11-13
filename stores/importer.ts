import type { SQLiteDatabase } from 'expo-sqlite';
import { canonicalRecord } from '../catalog/validation';
import type { StoreRecord } from './types';
import { validateStoreCatalog } from './validation';

type Database = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync'>;
const queues = new WeakMap<Database, Promise<unknown>>();
export function importStoreCatalog(database: Database, input: unknown, today?: string) {
  const catalog = validateStoreCatalog(input, today);
  const prior = queues.get(database) ?? Promise.resolve();
  const task = prior.catch(() => undefined).then(async () => {
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const fk = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (!version || version.user_version < 5 || fk?.foreign_keys !== 1) throw new Error('Initialize migrations before store import.');
    const result = { inserted: 0, updated: 0, unchanged: 0, skipped: [] as string[] };
    await database.execAsync('BEGIN IMMEDIATE');
    try {
      for (const store of catalog.stores) {
        const existing = await database.getFirstAsync<{ catalog_id: string | null; record_json: string | null; location_verification_status: string }>(
          `SELECT c.catalog_id, c.record_json, s.location_verification_status FROM stores s
           LEFT JOIN store_catalog_entries c ON c.store_id=s.id WHERE s.id=?`, [store.id]);
        const json = canonicalRecord(store);
        if (existing) {
          if (existing.catalog_id !== catalog.catalogId || !existing.record_json) { result.skipped.push(store.id); continue; }
          if (existing.record_json === json) { result.unchanged++; continue; }
          const old = JSON.parse(existing.record_json) as StoreRecord;
          if ((existing.location_verification_status === 'verified' && store.verificationStatus !== 'verified')
            || old.checkedAt > store.checkedAt || (old.latitude !== null && store.latitude === null)
            || old.sources.some(source => !store.sources.some(next => next.url === source.url))) { result.skipped.push(store.id); continue; }
        }
        // Never REPLACE an existing store, which could cascade into inventory later.
        await database.runAsync(`INSERT INTO stores(id,name,chain,street_address,city,state,zip_code,latitude,longitude,
          location_verification_status,location_source_reference) VALUES(?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name,chain=excluded.chain,street_address=excluded.street_address,
          city=excluded.city,state=excluded.state,zip_code=excluded.zip_code,latitude=excluded.latitude,longitude=excluded.longitude,
          location_verification_status=excluded.location_verification_status,location_source_reference=excluded.location_source_reference`,
          [store.id,store.name,store.chain,store.streetAddress,store.city,store.state,store.zipCode,store.latitude,store.longitude,
            store.verificationStatus,store.sources.map(source => source.url).join('\n')]);
        await database.runAsync(`INSERT INTO store_catalog_entries(store_id,catalog_id,record_json) VALUES(?,?,?)
          ON CONFLICT(store_id) DO UPDATE SET record_json=excluded.record_json,imported_at=CURRENT_TIMESTAMP`, [store.id,catalog.catalogId,json]);
        await database.runAsync('INSERT OR IGNORE INTO store_catalog_revisions(store_id,catalog_id,record_json) VALUES(?,?,?)', [store.id,catalog.catalogId,json]);
        if (existing) result.updated++; else result.inserted++;
      }
      await database.execAsync('COMMIT'); return result;
    } catch (error) { await database.execAsync('ROLLBACK'); throw error; }
  });
  queues.set(database, task);
  void task.finally(() => { if (queues.get(database) === task) queues.delete(database); }).catch(() => undefined);
  return task;
}
