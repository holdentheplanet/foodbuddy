import { resolveCategoryId } from './categories';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { CatalogProduct, ProductCatalog } from './types';
import { canonicalRecord, ingredientSegments, validateProductCatalog } from './validation';

type CatalogDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'runAsync'>;
export type CatalogImportResult = { inserted: number; updated: number; unchanged: number; skipped: { id: string; reason: string }[] };
type Existing = {
  ingredient_verification_status: string;
  last_verified_at: string | null;
  catalog_id: string | null;
  record_json: string | null;
};
const queues = new WeakMap<CatalogDatabase, Promise<unknown>>();

function downgrade(previous: CatalogProduct, next: CatalogProduct): boolean {
  if (previous.ingredientVerificationStatus === 'verified' && next.ingredientVerificationStatus !== 'verified') return true;
  if (previous.verifiedAt && (!next.verifiedAt || next.verifiedAt < previous.verifiedAt)) return true;
  for (const field of ['barcode', 'packageSize', 'imageReference', 'ingredientLabelText', 'allergenStatement', 'precautionaryStatement'] as const) {
    if (previous[field] !== null && next[field] === null) return true;
  }
  if (previous.allergenStatus === 'documented' && next.allergenStatus !== 'documented') return true;
  if (previous.precautionaryStatus === 'documented' && next.precautionaryStatus !== 'documented') return true;
  // A stale source review must not replace a more recently reviewed snapshot.
  const latest = (record: CatalogProduct) => record.sources.reduce((date, entry) => entry.checkedAt > date ? entry.checkedAt : date, '');
  return latest(next) < latest(previous);
}

/** All SQL values are bound. No network requests, inventory writes, or user-table writes. */
export function importProductCatalog(database: CatalogDatabase, input: unknown, today?: string): Promise<CatalogImportResult> {
  const catalog = validateProductCatalog(input, today);
  // Validate parsing before writing anything, including partially known labels.
  for (const product of catalog.products) if (product.ingredientLabelText) ingredientSegments(product.ingredientLabelText);
  const previous = queues.get(database) ?? Promise.resolve();
  const running = previous.catch(() => undefined).then(() => importValidated(database, catalog));
  queues.set(database, running);
  void running.finally(() => { if (queues.get(database) === running) queues.delete(database); }).catch(() => undefined);
  return running;
}

async function importValidated(database: CatalogDatabase, catalog: ProductCatalog): Promise<CatalogImportResult> {
  const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const foreignKeys = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (!version || version.user_version < 4 || foreignKeys?.foreign_keys !== 1) {
    throw new Error('Initialize the database migrations and foreign keys before importing a catalog.');
  }
  const result: CatalogImportResult = { inserted: 0, updated: 0, unchanged: 0, skipped: [] };
  const allergenIds = new Map<string, number | null>();
  await database.execAsync('BEGIN IMMEDIATE');
  try {
    for (const product of catalog.products) {
      const recordJson = canonicalRecord(product);
      const existing = await database.getFirstAsync<Existing>(
        `SELECT p.ingredient_verification_status, p.last_verified_at, c.catalog_id, c.record_json
         FROM products p LEFT JOIN product_catalog_entries c ON c.product_id = p.id WHERE p.id = ?`, [product.id]);
      if (existing) {
        // An imported ID cannot take over a manual product or another catalog's product.
        if (existing.catalog_id !== catalog.catalogId || !existing.record_json) {
          result.skipped.push({ id: product.id, reason: 'Product is not owned by this catalog.' }); continue;
        }
        if (existing.record_json === recordJson) { result.unchanged++; continue; }
        const old = JSON.parse(existing.record_json) as CatalogProduct;
        if (downgrade(old, product)
          || (existing.ingredient_verification_status === 'verified' && product.ingredientVerificationStatus !== 'verified')
          || (existing.last_verified_at && (!product.verifiedAt || product.verifiedAt < existing.last_verified_at))) {
          result.skipped.push({ id: product.id, reason: 'Incomplete, unverified, or older record would replace existing evidence.' }); continue;
        }
      }
      const ingredientSource = product.sources.find(entry => entry.id === product.ingredientSourceId);
      await database.runAsync(
        `INSERT INTO products(id, name, brand, barcode, variant, image_reference, ingredient_label_text,
          ingredient_verification_status, source_reference, last_verified_at, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, brand=excluded.brand, barcode=excluded.barcode,
          variant=excluded.variant, image_reference=excluded.image_reference,
          ingredient_label_text=excluded.ingredient_label_text,
          ingredient_verification_status=excluded.ingredient_verification_status,
          source_reference=excluded.source_reference, last_verified_at=excluded.last_verified_at, category_id=excluded.category_id`,
        [product.id, product.name, product.brand, product.barcode, product.variant, product.imageReference,
          product.ingredientLabelText, product.ingredientVerificationStatus,
          ingredientSource?.url ?? product.sources[0].url, product.verifiedAt, resolveCategoryId(product.category)]);
      // Replace only this catalog-owned product's derived rows, atomically. Never REPLACE the product:
      // that would cascade into other tables and erase provenance/inventory references.
      if (existing) {
        await database.runAsync('DELETE FROM product_ingredients WHERE product_id = ?', [product.id]);
        await database.runAsync('DELETE FROM product_allergens WHERE product_id = ?', [product.id]);
      }
      if (product.ingredientLabelText) {
        for (const segment of ingredientSegments(product.ingredientLabelText)) {
          await database.runAsync(`INSERT INTO product_ingredients(product_id, ingredient_name, normalized_ingredient_name)
            VALUES (?, ?, ?)`, [product.id, segment, segment.trim().toLowerCase()]);
        }
      }
      // Exact catalog-name matching only; never consult derivative mappings or infer absence.
      const assertions = new Map<string, { type: 'contains' | 'may_contain'; sourceId: string | null }>();
      for (const name of product.precautionaryAllergens ?? []) assertions.set(name, { type: 'may_contain', sourceId: product.precautionarySourceId });
      for (const name of product.declaredAllergens ?? []) assertions.set(name, { type: 'contains', sourceId: product.allergenSourceId });
      for (const [name, assertion] of assertions) {
        if (!allergenIds.has(name)) {
          const row = await database.getFirstAsync<{ id: number }>('SELECT id FROM allergens WHERE name = ? COLLATE NOCASE AND user_id IS NULL', [name]);
          allergenIds.set(name, row?.id ?? null);
        }
        const evidence = product.sources.find(entry => entry.id === assertion.sourceId)!;
        await database.runAsync(`INSERT INTO product_allergens(product_id, allergen_id, normalized_allergen_name, relationship_type, evidence_reference)
          VALUES (?, ?, ?, ?, ?)`, [product.id, allergenIds.get(name) ?? null, name, assertion.type, `${evidence.url} (reviewed ${evidence.checkedAt})`]);
      }
      await database.runAsync(`INSERT INTO product_catalog_revisions(product_id, catalog_id, record_json) VALUES (?, ?, ?)
        ON CONFLICT(product_id, catalog_id, record_json) DO NOTHING`, [product.id, catalog.catalogId, recordJson]);
      await database.runAsync(`INSERT INTO product_catalog_entries(product_id, catalog_id, record_json) VALUES (?, ?, ?)
        ON CONFLICT(product_id) DO UPDATE SET record_json=excluded.record_json, imported_at=CURRENT_TIMESTAMP`,
        [product.id, catalog.catalogId, recordJson]);
      if (existing) result.updated++; else result.inserted++;
    }
    await database.execAsync('COMMIT');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK');
    throw error;
  }
}
