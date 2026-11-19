import { useEffect, useState } from 'react';
import { assessProductPage } from '../services/productAssessments';
import { localProducts } from '../services/localProducts';
import { checkLocalProductAllergies } from '../services/allergyChecker';
import type { LocalAllergyResult } from '../services/localAllergyMatching';
import type { LocalProductSummary } from '../services/localProductService';
/** Bounded sequential reads; discard results on account, page, or activity changes. */
export function useProductAssessments(userId: number, products: LocalProductSummary[], active = true) {
  const [state, setState] = useState<{ userId: number; products: LocalProductSummary[]; values: Record<string, LocalAllergyResult> } | null>(null);
  useEffect(() => {
    let alive = true;
    if (active) void assessProductPage(userId, products, {
      getProduct: localProducts.getProductById,
      check: checkLocalProductAllergies,
      isCurrent: () => alive,
      publish: values => setState({ userId, products, values }),
    });
    return () => { alive = false; };
  }, [userId, products, active]);
  return active && state?.userId === userId && state.products === products ? state.values : {};
}
