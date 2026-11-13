import type { SQLiteDatabase } from 'expo-sqlite';
import type { StoreRecord } from '../stores/types';
import { sortStoresByDistance } from './storeDistance';

export type LocalStore = Omit<StoreRecord, 'checkedAt'> & { checkedAt: string | null; distanceMiles: number | null };
export function createLocalStoreService(database: Pick<SQLiteDatabase, 'getAllAsync'>) {
  return {
    async listStores(origin: unknown = null): Promise<LocalStore[]> {
      const rows = await database.getAllAsync<{
        id: string; name: string; chain: string | null; street_address: string; city: string; state: string;
        zip_code: string; latitude: number | null; longitude: number | null;
        location_verification_status: StoreRecord['verificationStatus']; record_json: string | null;
      }>(`SELECT s.*, c.record_json FROM stores s LEFT JOIN store_catalog_entries c ON c.store_id=s.id`);
      const stores = rows.map(row => {
        const record = row.record_json ? JSON.parse(row.record_json) as StoreRecord : null;
        return { id: row.id, name: row.name, chain: row.chain ?? 'Independent', streetAddress: row.street_address,
          city: row.city, state: row.state, zipCode: row.zip_code, latitude: row.latitude, longitude: row.longitude,
          verificationStatus: row.location_verification_status, checkedAt: record?.checkedAt ?? null,
          sources: record?.sources ?? [], notes: record?.notes ?? 'Location evidence not recorded.', attribution: record?.attribution };
      });
      return sortStoresByDistance(stores, origin);
    },
  };
}
