import type { SQLiteDatabase } from 'expo-sqlite';
import expansionCatalog from './data/us-expansion-01.json';
import starterCatalog from './data/us-starter.json';
import { importProductCatalog } from './importer';

export async function importStarterProductCatalog(database: SQLiteDatabase) {
  const starter = await importProductCatalog(database, starterCatalog);
  const expansion = await importProductCatalog(database, expansionCatalog);
  return { inserted: starter.inserted + expansion.inserted, updated: starter.updated + expansion.updated,
    unchanged: starter.unchanged + expansion.unchanged, skipped: [...starter.skipped, ...expansion.skipped] };
}
