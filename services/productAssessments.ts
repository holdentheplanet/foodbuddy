import type { LocalProductDetails, LocalProductSummary } from './localProductService';
import type { LocalAllergyResult } from './localAllergyMatching';
/** No cross-account cache. The caller owns lifetime and profile refresh boundaries. */
export async function assessProductPage(userId: number, products: LocalProductSummary[], dependencies: {
  getProduct: (id: string) => Promise<LocalProductDetails | null>;
  check: (userId: number, product: LocalProductDetails) => Promise<LocalAllergyResult>;
  isCurrent: () => boolean;
  publish: (results: Record<string, LocalAllergyResult>) => void;
}) {
  const results: Record<string, LocalAllergyResult> = {};
  for (const summary of products) {
    if (!dependencies.isCurrent()) return;
    try {
      const product = await dependencies.getProduct(summary.id);
      if (!dependencies.isCurrent()) return;
      if (product) results[summary.id] = await dependencies.check(userId, product);
    } catch { /* Missing or failed assessments remain explicitly unavailable. */ }
    if (!dependencies.isCurrent()) return;
    dependencies.publish({ ...results });
  }
}
