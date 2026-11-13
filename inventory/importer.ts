import type { SQLiteDatabase } from 'expo-sqlite';
import type { InventorySeed } from './types';
import { buildInventorySeed } from './seed';

type Database = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'runAsync'>;
const queues = new WeakMap<Database, Promise<unknown>>();
export function importDemoInventory(database: Database, seed: InventorySeed) {
  const records = buildInventorySeed(seed);
  const seedId = seed.seedId;
  const previous = queues.get(database) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const fk = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (!version || version.user_version < 7 || fk?.foreign_keys !== 1) throw new Error('Initialize inventory migrations first.');
    const result = { inserted: 0, unchanged: 0, skipped: 0 };
    await database.execAsync('BEGIN IMMEDIATE');
    try {
      for (const record of records) {
        const existing = await database.getFirstAsync<{ seed_id: string | null }>(`SELECT o.seed_id FROM store_inventory i
          LEFT JOIN demo_inventory_entries o ON o.store_id=i.store_id AND o.product_id=i.product_id
          WHERE i.store_id=? AND i.product_id=?`, [record.storeId, record.productId]);
        if (existing) { if (existing.seed_id === seedId) result.unchanged++; else result.skipped++; continue; }
        await database.runAsync(`INSERT INTO store_inventory(store_id,product_id,availability_status,is_demo,simulated_status)
          VALUES(?,?,?,1,?)`, [record.storeId,record.productId,record.status === 'out_of_stock' ? 'unavailable' : 'available',record.status]);
        await database.runAsync('INSERT INTO demo_inventory_entries(store_id,product_id,seed_id) VALUES(?,?,?)', [record.storeId,record.productId,seedId]);
        result.inserted++;
      }
      await database.execAsync('COMMIT'); return result;
    } catch (error) { await database.execAsync('ROLLBACK'); throw error; }
  });
  queues.set(database, task);
  void task.finally(() => { if (queues.get(database) === task) queues.delete(database); }).catch(() => undefined);
  return task;
}
