import { initializeDemoInventory } from '../inventory';
import { importLocalStores } from '../stores';
import * as SQLite from 'expo-sqlite';
import { initializeDatabaseConnection } from './migrations';
import { importStarterProductCatalog } from '../catalog';

// Keep this filename and connection: existing accounts and profiles live here.
export const db = SQLite.openDatabaseSync('foodbuddy.db');

export async function initializeDatabase(): Promise<void> {
  await initializeDatabaseConnection(db);
  await importStarterProductCatalog(db);
  await importLocalStores(db);
  await initializeDemoInventory(db);
  console.log('FoodBuddy database initialized!');
}
