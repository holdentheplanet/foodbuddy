import { resolveCategoryId } from './categories';
import type { CatalogProduct, CatalogSource, ProductCatalog } from './types';

// Expand deliberately when reviewing a new manufacturer. A URL alone is not proof.
const sourceHosts = new Set([
  'www.cheezit.com', 'www.pringles.com', 'www.egglandsbest.com',
  'www.daveskillerbread.com', 'www.naturesownbread.com', 'www.birdseye.com',
  'www.goodnes.com', 'www.leggomyeggo.com', 'www.coca-cola.com', 'www.lacroixwater.com',
  'www.campbells.com', 'www.dole.com', 'dolefreshvegetables.com', 'starkist.com',
  'www.bumblebee.com', 'www.jimmydean.com', 'www.hellmanns.com', 'www.hiddenvalley.com',
  'www.oreo.com', 'www.snackworks.com', 'www.cheerios.com', 'www.chex.com',
  'www.jif.com', 'www.peanutbutter.com', 'www.naturevalley.com',
  'www.campbellsfoodservice.com', 'www.pepperidgefarm.com',
  'www.kraftheinz.com', 'smartlabel.kraftheinz.com',
  'www.pepsicoproductfacts.com', 'www.quakeroats.com', 'smartlabel.pepsico.info',
  'www.barilla.com', 'www.connect.syncpdi.com', 'www.mccormick.com',
  'www.daisybrand.com', 'www.chobani.com', 'chobani.com', 'www.hersheyland.com',
]);
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid product catalog: ${message}`);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected object');
}
function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function date(value: unknown, today: string): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value && value <= today;
}
export function canonicalRecord(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRecord).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalRecord(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function validBarcode(value: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}
function source(product: CatalogProduct, id: string | null, evidence: string): CatalogSource {
  const found = product.sources.find(entry => entry.id === id);
  requireValue(found && found.reviewStatus === 'label_reviewed'
    && found.evidence?.includes(evidence), `${product.id}: field lacks reviewed, exact source evidence`);
  return found;
}
function declaration(product: CatalogProduct, precaution: boolean): void {
  const status = precaution ? product.precautionaryStatus : product.allergenStatus;
  const statement = precaution ? product.precautionaryStatement : product.allergenStatement;
  const names = precaution ? product.precautionaryAllergens : product.declaredAllergens;
  const sourceId = precaution ? product.precautionarySourceId : product.allergenSourceId;
  requireValue(['unknown', 'documented'].includes(status), `${product.id}: invalid declaration status`);
  if (status === 'unknown') {
    requireValue(statement === null && names === null && sourceId === null,
      `${product.id}: unknown declarations must use null, not an empty safe/absent list`);
    return;
  }
  requireValue(nonblank(statement) && Array.isArray(names), `${product.id}: missing declaration`);
  source(product, sourceId, statement);
  const seen = new Set<string>();
  for (const name of names) {
    requireValue(nonblank(name) && name === name.trim().toLowerCase() && !seen.has(name),
      `${product.id}: invalid or duplicate declared allergen`);
    seen.add(name);
    // Lexical transcription only, never derivative inference (e.g. no whey -> milk).
    const term = name === 'peanuts' ? 'peanut' : name;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const clause = precaution ? statement.split(/\bmay contain\b/i).slice(1).join(' ')
      : statement.split(/\bmay contain\b/i)[0];
    requireValue(new RegExp(`\\b${escaped}s?\\b`, 'i').test(clause),
      `${product.id}: allergen ${name} is not explicitly named in the declaration clause`);
  }
  // Catch omissions for the explicit names supported by this starter catalog.
  // This is a transcription check, not an inference from the ingredient list.
  const clause = precaution ? statement.split(/\bmay contain\b/i).slice(1).join(' ')
    : statement.split(/\bmay contain\b/i)[0];
  for (const name of ['milk', 'wheat', 'soy', 'peanuts', 'almond', 'pecan', 'gluten', 'eggs', 'fish', 'sesame']) {
    const term = name === 'peanuts' ? 'peanut' : name;
    if (new RegExp(`\\b${term}s?\\b`, 'i').test(clause)) {
      requireValue(seen.has(name), `${product.id}: declaration omitted named allergen ${name}`);
    }
  }
}

/** Validates local reviewed evidence; never fetches a URL or claims to verify a label online. */
export function validateProductCatalog(input: unknown, today = new Date().toISOString().slice(0, 10)): ProductCatalog {
  requireValue(date(today, '9999-12-31'), 'invalid validation date');
  object(input);
  requireValue(input.formatVersion === 1 && nonblank(input.catalogId) && Array.isArray(input.products), 'invalid manifest');
  const seen = new Set<string>();
  for (const value of input.products) {
    object(value);
    for (const key of ['id', 'name', 'brand', 'variant', 'category', 'notes']) {
      requireValue(nonblank(value[key]), `missing ${key}`);
    }
    requireValue(typeof value.category === 'string' && resolveCategoryId(value.category), 'unknown grocery category');
    requireValue(typeof value.id === 'string' && /^[a-z0-9][a-z0-9-]+$/.test(value.id)
      && !seen.has(value.id), 'invalid or duplicate stable product ID');
    seen.add(value.id);
    requireValue(value.market === 'US', `${value.id}: only reviewed US variants are currently supported`);
    for (const key of ['packageSize', 'barcode', 'imageReference', 'ingredientLabelText', 'verifiedAt',
      'allergenStatement', 'precautionaryStatement', 'ingredientSourceId', 'allergenSourceId',
      'precautionarySourceId', 'barcodeSourceId']) {
      requireValue(value[key] === null || nonblank(value[key]), `${value.id}: ${key} must be nonblank or null`);
    }
    requireValue(Array.isArray(value.sources) && value.sources.length > 0, `${value.id}: sources required`);
    const sourceIds = new Set<string>();
    for (const entry of value.sources) {
      object(entry);
      requireValue(nonblank(entry.id) && !sourceIds.has(entry.id), `${value.id}: invalid source ID`);
      sourceIds.add(entry.id);
      requireValue(nonblank(entry.url), `${value.id}: source URL required`);
      let url: URL;
      try { url = new URL(entry.url); } catch { throw new Error(`Invalid source URL for ${value.id}`); }
      requireValue(url.protocol === 'https:' && !url.username && !url.password && sourceHosts.has(url.hostname),
        `${value.id}: source must be on a reviewed manufacturer host`);
      requireValue(['manufacturer_page', 'manufacturer_label_photo', 'manufacturer_linked_spec'].includes(String(entry.kind))
        && ['label_reviewed', 'identity_only', 'unavailable'].includes(String(entry.reviewStatus))
        && date(entry.checkedAt, today) && nonblank(entry.notes)
        && (entry.evidence === null || nonblank(entry.evidence)), `${value.id}: invalid source metadata`);
      if (entry.reviewStatus === 'label_reviewed') requireValue(nonblank(entry.evidence), `${value.id}: no reviewed evidence`);
    }
    const product = value as unknown as CatalogProduct;
    requireValue(['verified', 'unverified', 'unknown'].includes(product.ingredientVerificationStatus), `${product.id}: invalid ingredient status`);
    if (product.ingredientVerificationStatus === 'verified') {
      requireValue(nonblank(product.ingredientLabelText) && date(product.verifiedAt, today), `${product.id}: verified ingredients need label and date`);
      const evidence = source(product, product.ingredientSourceId, product.ingredientLabelText);
      requireValue(product.verifiedAt === evidence.checkedAt, `${product.id}: verification date must match source review`);
    } else {
      requireValue(product.verifiedAt === null, `${product.id}: unverified ingredients cannot have a verification date`);
      if (product.ingredientLabelText !== null) source(product, product.ingredientSourceId, product.ingredientLabelText);
      else requireValue(product.ingredientSourceId === null, `${product.id}: missing ingredient label`);
    }
    if (product.barcode !== null) {
      requireValue(validBarcode(product.barcode), `${product.id}: invalid barcode/check digit`);
      source(product, product.barcodeSourceId, product.barcode);
    } else requireValue(product.barcodeSourceId === null, `${product.id}: missing barcode`);
    declaration(product, false);
    declaration(product, true);
    const completeness = product.ingredientVerificationStatus !== 'verified' ? 'unverified'
      : product.allergenStatus === 'documented' && product.precautionaryStatus === 'documented' ? 'complete' : 'partial';
    requireValue(product.completenessStatus === completeness, `${product.id}: inconsistent completeness status`);
  }
  // Snapshot external input before the first await; caller mutations cannot bypass validation.
  return JSON.parse(canonicalRecord(input)) as ProductCatalog;
}

/** Conservative, verbatim top-level label segments; nested ingredients stay intact. */
export function ingredientSegments(label: string): string[] {
  const text = label.replace(/^INGREDIENTS:\s*/i, '');
  const segments: string[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) {
      requireValue(stack.pop() === ({ ')': '(', ']': '[', '}': '{' } as Record<string, string>)[char], 'unbalanced ingredient label');
    } else if ((char === ',' || char === ';') && stack.length === 0) {
      segments.push(text.slice(start, i).trim()); start = i + 1;
    }
  }
  requireValue(stack.length === 0, 'unbalanced ingredient label');
  segments.push(text.slice(start).trim());
  return [...new Map(segments.filter(Boolean).map(segment => [segment.toLowerCase(), segment])).values()];
}
