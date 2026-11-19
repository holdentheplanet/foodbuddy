// Developer-only tool. Uses the existing TypeScript compiler; no network or app DB access.
// Usage: node scripts/review-product-candidates.cjs candidates.json [approved.json]
const fs = require('node:fs');
const path = require('node:path');
const load = require('../tests/helpers/load-typescript.cjs');
const { reviewCandidateBatch } = load(path.resolve(__dirname, '../catalog/review.ts'));

const input = process.argv[2];
if (!input) throw new Error('Provide a candidate JSON file.');
const batch = JSON.parse(fs.readFileSync(input, 'utf8'));
const existing = fs.readdirSync(path.resolve(__dirname, '../catalog/data')).filter(f => f.endsWith('.json'))
  .map(file => require('../catalog/data/' + file)).filter(c => c.catalogId !== batch.catalogId).flatMap(c => c.products);
const result = reviewCandidateBatch(batch, existing);
console.log(JSON.stringify({ approved: result.catalog.products.length, held: result.held }, null, 2));
if (process.argv[3]) {
  // Refuse accidental overwrite of an existing manifest. Updates require explicit review.
  fs.writeFileSync(process.argv[3], JSON.stringify(result.catalog, null, 2) + '\n', { flag: 'wx' });
}
