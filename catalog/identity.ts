import type { CatalogProduct } from './types';

/** GTINs only (EAN-8, UPC-A, EAN-13, GTIN-14); UPC-E must first be expanded. */
export function canonicalBarcode(barcode: string | null): string | null {
  return barcode === null ? null : barcode.padStart(14, '0');
}
export function identityText(value: string | null): string {
  return (value ?? '').normalize('NFKC').toLowerCase().replace(/[®™]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
/** Package sizes do not create extra foods toward the goal. Ambiguous identities need review. */
export function productIdentity(product: Pick<CatalogProduct, 'brand' | 'name' | 'variant'>): string {
  return [product.brand, product.name, product.variant].map(identityText).join('|');
}
export function duplicateProduct(a: CatalogProduct, b: CatalogProduct): boolean {
  return a.id === b.id || (a.barcode !== null && b.barcode !== null
    && canonicalBarcode(a.barcode) === canonicalBarcode(b.barcode)) || productIdentity(a) === productIdentity(b);
}
