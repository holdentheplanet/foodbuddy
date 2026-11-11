import type { SQLiteDatabase } from 'expo-sqlite';
import seed from './data/demo-v1.json';
import { importDemoInventory } from './importer';
import type { InventorySeed } from './types';
export function initializeDemoInventory(database: SQLiteDatabase) { return importDemoInventory(database, seed as InventorySeed); }
