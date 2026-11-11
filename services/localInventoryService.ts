import type { SQLiteDatabase } from 'expo-sqlite';
import type { DemoStatus } from '../inventory/types';

export type DemoAvailability = { storeId: string; name: string; address: string; status: DemoStatus; isDemo: true };
export function createLocalInventoryService(database: Pick<SQLiteDatabase, 'getAllAsync'>) {
  return {
    async getProductAvailability(productId: string): Promise<DemoAvailability[]> {
      if (typeof productId !== 'string' || !productId.trim() || productId.length > 300) throw new TypeError('Invalid product ID.');
      const rows = await database.getAllAsync<{ storeId: string; name: string; address: string; status: DemoStatus }>(
        `SELECT s.id AS storeId,s.name,s.street_address || ', ' || s.city || ', ' || s.state || ' ' || s.zip_code AS address,
        i.simulated_status AS status FROM store_inventory i JOIN stores s ON s.id=i.store_id
        WHERE i.product_id=? AND i.is_demo=1 ORDER BY s.name COLLATE NOCASE,s.id`, [productId]);
      return rows.map(row => ({ ...row, isDemo: true }));
    },
  };
}
