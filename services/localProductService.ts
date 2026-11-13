import type { DemoStatus } from '../inventory/types';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { CatalogProduct, CatalogSource } from '../catalog/types';
import { validateProductCatalog } from '../catalog/validation';

type ReadDatabase = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync'>;
type IngredientStatus = CatalogProduct['ingredientVerificationStatus'];
type DeclarationStatus = 'documented' | 'unknown';
export type LocalProductSummary = {
  simulatedAvailability: DemoStatus | null;
  completenessStatus: CatalogProduct['completenessStatus'] | 'unknown';
  categoryId: string | null;
  categoryName: string | null;
  id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  barcode: string | null;
  imageReference: string | null;
  ingredientVerificationStatus: IngredientStatus;
  ingredientLabelAvailable: boolean;
  lastVerifiedAt: string | null;
  // No result from this service is an allergy-safety determination.
  requiresLabelReview: true;
};
export type ProductIngredient = { name: string; normalizedName: string | null };
export type ProductAllergen = {
  allergenId: number | null;
  name: string;
  relationship: 'contains' | 'may_contain' | 'unknown';
  evidenceReference: string | null;
};
export type LocalProductDetails = LocalProductSummary & {
  ingredients: {
    labelText: string | null;
    verificationStatus: IngredientStatus;
    verifiedAt: string | null;
    segments: ProductIngredient[];
    source: CatalogSource | null;
  };
  allergens: {
    declared: { status: DeclarationStatus; statement: string | null; names: string[] | null; source: CatalogSource | null };
    precautionary: { status: DeclarationStatus; statement: string | null; names: string[] | null; source: CatalogSource | null };
    relationships: ProductAllergen[];
  };
  provenance: {
    catalogId: string | null;
    packageSize: string | null;
    category: string | null;
    market: string | null;
    completenessStatus: CatalogProduct['completenessStatus'] | 'unknown';
    sourceReference: string | null;
    sources: CatalogSource[];
    notes: string | null;
  };
};
export type LocalProductCategory = { id: string; name: string; productCount: number };
export type ProductSearchOptions = { storeId?: string; categoryId?: string | null; field?: 'name' | 'brand' | 'all'; limit?: number; offset?: number };
export type ProductSearchPage = { products: LocalProductSummary[]; limit: number; offset: number; hasMore: boolean };
type ProductRow = {
  demo_status?: DemoStatus | null;
  completeness_status: LocalProductSummary['completenessStatus'];
  category_id: string | null; category_name: string | null;
  id: string; name: string; brand: string | null; barcode: string | null;
  variant: string | null; image_reference: string | null;
  ingredient_verification_status: IngredientStatus; ingredient_label_available: number;
  last_verified_at: string | null;
};
const summaryColumns = `COALESCE((SELECT json_extract(record_json, '$.completenessStatus') FROM product_catalog_entries WHERE product_id = p.id), 'unknown') AS completeness_status, p.category_id, (SELECT name FROM product_categories WHERE id = p.category_id) AS category_name, p.id, p.name, p.brand, p.barcode, p.variant, p.image_reference,
  p.ingredient_verification_status, p.last_verified_at,
  CASE WHEN length(trim(p.ingredient_label_text)) > 0 THEN 1 ELSE 0 END AS ingredient_label_available`;
function summary(row: ProductRow): LocalProductSummary {
  return {
    simulatedAvailability: row.demo_status ?? null, completenessStatus: row.completeness_status, categoryId: row.category_id, categoryName: row.category_name,
    id: row.id, name: row.name, brand: row.brand, variant: row.variant,
    barcode: row.barcode, imageReference: row.image_reference,
    ingredientVerificationStatus: row.ingredient_verification_status,
    ingredientLabelAvailable: row.ingredient_label_available === 1,
    lastVerifiedAt: row.last_verified_at, requiresLabelReview: true,
  };
}
function text(value: string, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  if (value.length > 300) throw new RangeError(`${label} must be at most 300 characters.`);
  return value.trim();
}
function escapeLike(value: string): string { return value.replace(/[\\%_]/g, '\\$&'); }

/** Bind to the existing initialized connection; this factory never opens or writes a database. */
export function createLocalProductService(database: ReadDatabase) {
  async function queryProducts(query: string, options: ProductSearchOptions = {}, browse = false): Promise<ProductSearchPage> {
    const term = text(query, 'Search query');
    const { field = 'all', limit = 25, offset = 0, categoryId = null, storeId } = options;
    if (!['name', 'brand', 'all'].includes(field)) throw new TypeError('Unsupported search field.');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Limit must be between 1 and 100.');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('Offset must be a nonnegative integer.');
    if (categoryId !== null && (typeof categoryId !== 'string' || !categoryId.trim() || categoryId.length > 100)) throw new TypeError('Invalid category ID.');
    if (storeId !== undefined && (!text(storeId, 'Store ID'))) throw new TypeError('Store ID is required.');
    if (!term && !browse) return { products: [], limit, offset, hasMore: false };
    // All SQL fragments are fixed/allowlisted. LIKE metacharacters in user input are literal.
    const name = "p.name COLLATE NOCASE LIKE ? ESCAPE '\\'";
    const brand = "p.brand COLLATE NOCASE LIKE ? ESCAPE '\\'";
    const termWhere = field === 'name' ? name : field === 'brand' ? brand : `(${name} OR ${brand})`;
    const pattern = `%${escapeLike(term)}%`;
    const parameters: (string | number)[] = term ? (field === 'all' ? [pattern, pattern] : [pattern]) : [];
    const where = [term ? termWhere : '1 = 1', ...(categoryId === null ? [] : ['p.category_id = ?'])].join(' AND ');
    if (categoryId !== null) parameters.push(categoryId);
    if (storeId !== undefined) parameters.unshift(storeId);
    parameters.push(limit + 1, offset);
    const rows = await database.getAllAsync<ProductRow>(
      `SELECT ${summaryColumns}, ${storeId !== undefined ? 'inv.simulated_status' : 'NULL'} AS demo_status FROM products p
       ${storeId !== undefined ? 'JOIN store_inventory inv ON inv.product_id=p.id AND inv.store_id=? AND inv.is_demo=1' : ''} WHERE ${where}
       ORDER BY p.name COLLATE NOCASE, p.id LIMIT ? OFFSET ?`, parameters);
    return { products: rows.slice(0, limit).map(summary), limit, offset, hasMore: rows.length > limit };
  }
  const searchProducts = (query: string, options: ProductSearchOptions = {}) => queryProducts(query, options);
  async function getProductById(id: string): Promise<LocalProductDetails | null> {
    const key = text(id, 'Product ID');
    if (!key) return null;
    const row = await database.getFirstAsync<ProductRow & {
      ingredient_label_text: string | null; source_reference: string | null;
      catalog_id: string | null; record_json: string | null;
      // Child rows are read in this same SQLite statement so an import cannot mix revisions.
      ingredients_json: string; allergens_json: string;
    }>(`SELECT ${summaryColumns}, p.ingredient_label_text, p.source_reference, c.catalog_id, c.record_json,
       (SELECT json_group_array(json_object('name', i.ingredient_name, 'normalizedName', i.normalized_ingredient_name))
        FROM (SELECT * FROM product_ingredients WHERE product_id = p.id ORDER BY id) i) AS ingredients_json,
       (SELECT json_group_array(json_object('allergenId', a.allergen_id,
          'name', COALESCE(a.normalized_allergen_name, cat.name), 'relationship', a.relationship_type,
          'evidenceReference', a.evidence_reference))
        FROM (SELECT * FROM product_allergens WHERE product_id = p.id ORDER BY id) a
        LEFT JOIN allergens cat ON cat.id = a.allergen_id) AS allergens_json
       FROM products p LEFT JOIN product_catalog_entries c ON c.product_id = p.id WHERE p.id = ?`, [key]);
    if (!row) return null;
    let record: CatalogProduct | null = null;
    if (row.record_json !== null) {
      // Corrupt/mismatched evidence fails explicitly, never quietly becomes a safe result.
      record = validateProductCatalog({ formatVersion: 1, catalogId: row.catalog_id, products: [JSON.parse(row.record_json)] }).products[0];
      if (record.id !== row.id || record.ingredientLabelText !== row.ingredient_label_text
        || record.ingredientVerificationStatus !== row.ingredient_verification_status || record.verifiedAt !== row.last_verified_at) {
        throw new Error(`Product ${row.id} has inconsistent catalog evidence.`);
      }
    }
    const source = (id: string | null | undefined) => record?.sources.find(entry => entry.id === id) ?? null;
    return {
      ...summary(row),
      ingredients: {
        labelText: row.ingredient_label_text, verificationStatus: row.ingredient_verification_status,
        verifiedAt: row.last_verified_at, segments: JSON.parse(row.ingredients_json) as ProductIngredient[],
        source: source(record?.ingredientSourceId),
      },
      allergens: {
        declared: { status: record?.allergenStatus ?? 'unknown', statement: record?.allergenStatement ?? null,
          names: record?.declaredAllergens ?? null, source: source(record?.allergenSourceId) },
        precautionary: { status: record?.precautionaryStatus ?? 'unknown', statement: record?.precautionaryStatement ?? null,
          names: record?.precautionaryAllergens ?? null, source: source(record?.precautionarySourceId) },
        relationships: JSON.parse(row.allergens_json) as ProductAllergen[],
      },
      provenance: {
        catalogId: row.catalog_id, packageSize: record?.packageSize ?? null, category: row.category_name,
        market: record?.market ?? null, completenessStatus: record?.completenessStatus ?? 'unknown',
        sourceReference: row.source_reference, sources: record?.sources ?? [], notes: record?.notes ?? null,
      },
    };
  }
  return {
    searchProducts,
    browseProducts: (categoryId: string | null, options: Omit<ProductSearchOptions, 'field' | 'categoryId'> = {}) => queryProducts('', { ...options, categoryId }, true),
    async listCategories(storeId?: string): Promise<LocalProductCategory[]> {
      return database.getAllAsync<LocalProductCategory>(`SELECT c.id, c.name, count(p.id) AS productCount
        FROM product_categories c LEFT JOIN products p ON p.category_id = c.id
          AND (? IS NULL OR EXISTS(SELECT 1 FROM store_inventory i WHERE i.product_id=p.id AND i.store_id=? AND i.is_demo=1))
        GROUP BY c.id ORDER BY c.sort_order`, [storeId ?? null, storeId ?? null]);
    },
    searchProductsByName: (query: string, options: Omit<ProductSearchOptions, 'field'> = {}) => searchProducts(query, { ...options, field: 'name' }),
    searchProductsByBrand: (query: string, options: Omit<ProductSearchOptions, 'field'> = {}) => searchProducts(query, { ...options, field: 'brand' }),
    getProductById,
    async getProductIngredients(id: string) { return (await getProductById(id))?.ingredients ?? null; },
    async getProductAllergens(id: string) { return (await getProductById(id))?.allergens ?? null; },
  };
}
