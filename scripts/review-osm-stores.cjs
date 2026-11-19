// Development-only review gate. Input is produced by extract-osm-stores.py.
// Never downloads data, merges conflicts, or imports a database.
const fs = require('node:fs');
const path = require('node:path');
const load = require('../tests/helpers/load-typescript.cjs');
const { findStoreConflict } = load(path.resolve(__dirname, '../stores/identity.ts'));
const { validateStoreCatalog } = load(path.resolve(__dirname, '../stores/validation.ts'));
const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const legacy = require('../stores/data/charleston-01.json').stores;
const catalog = { formatVersion: 1, catalogId: 'osm-us-metros', stores: [] };
const report = { targetPerMetro: 25, datasets: source.reports, approved: {}, conflicts: [], invalid: [], notSelectedBeyondTarget: 0 };
for (const store of source.candidates) {
  const metro = store.dataset.metro;
  if ((report.approved[metro] ?? 0) >= 25) { report.notSelectedBeyondTarget++; continue; }
  try { validateStoreCatalog({ ...catalog, stores: [store] }); }
  catch (error) { report.invalid.push({ id: store.id, message: error.message }); continue; }
  const conflict = findStoreConflict(store, [...legacy, ...catalog.stores]);
  if (conflict) { report.conflicts.push({ id: store.id, metro, ...conflict }); continue; }
  catalog.stores.push(store); report.approved[metro] = (report.approved[metro] ?? 0) + 1;
}
validateStoreCatalog(catalog);
fs.writeFileSync(path.resolve(__dirname, '../stores/data/osm-us-metros.json'), JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync(path.resolve(__dirname, '../stores/data/osm-us-metros-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ approved: report.approved, total: catalog.stores.length, conflicts: report.conflicts.length, invalid: report.invalid.length }));
