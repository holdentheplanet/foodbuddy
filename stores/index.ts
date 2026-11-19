import catalog from './data/charleston-01.json';
import metroCatalog from './data/osm-us-metros.json';
import { importStoreCatalog } from './importer';
export async function importLocalStores(database: Parameters<typeof importStoreCatalog>[0]) {
  const original = await importStoreCatalog(database, catalog);
  const expansion = await importStoreCatalog(database, metroCatalog);
  return { inserted: original.inserted + expansion.inserted, updated: original.updated + expansion.updated,
    unchanged: original.unchanged + expansion.unchanged, skipped: [...original.skipped, ...expansion.skipped],
    conflicts: [...original.conflicts, ...expansion.conflicts] };
}
