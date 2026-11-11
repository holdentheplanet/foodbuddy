import type { InventoryAssignment, InventorySeed } from './types';

// Versioned FNV-1a over stable IDs. No time, randomness, chain assumptions or live data.
function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
export function buildInventorySeed(input: InventorySeed): InventoryAssignment[] {
  if (!input || input.version !== 1 || !/^[a-z0-9-]+$/.test(input.seedId)) throw new Error('Invalid demo inventory version/seed ID.');
  for (const ids of [input.storeIds, input.productIds]) {
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]+$/.test(id))
      || new Set(ids).size !== ids.length) throw new Error('Invalid/duplicate inventory IDs.');
  }
  const records: InventoryAssignment[] = [];
  for (const storeId of [...input.storeIds].sort()) for (const productId of [...input.productIds].sort()) {
    const key = `${input.seedId}|${storeId}|${productId}`;
    if (hash(`assigned|${key}`) % 5 === 0) continue;
    const score = hash(`status|${key}`) % 10;
    records.push({ storeId, productId, status: score < 6 ? 'in_stock' : score < 8 ? 'limited_stock' : 'out_of_stock' });
  }
  return records;
}
