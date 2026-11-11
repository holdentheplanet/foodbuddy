import type { SQLiteDatabase } from 'expo-sqlite';
import catalog from './data/charleston-01.json';
import { importStoreCatalog } from './importer';
export function importLocalStores(database: SQLiteDatabase) { return importStoreCatalog(database, catalog); }
