import type { LocalProductSummary } from '../services/localProductService';
import milestone from '../catalog/reviews/2026-11-18-goal-200.json';

const sourceReviewRequired = new Set(milestone.excludedHistoricalVerifiedProductIds);
/** Presentation only. Never changes catalog evidence or runs allergy matching. */
export function productEvidence(product: Pick<LocalProductSummary, 'id' | 'ingredientVerificationStatus' | 'completenessStatus'>) {
  const ingredientVerified = product.ingredientVerificationStatus === 'verified' && !sourceReviewRequired.has(product.id);
  const allergensDocumented = ingredientVerified && product.completenessStatus === 'complete';
  return {
    ingredientVerified,
    allergensDocumented,
    ingredientLabel: ingredientVerified ? 'Ingredient text verified'
      : sourceReviewRequired.has(product.id) ? 'Ingredient source needs review'
      : product.ingredientVerificationStatus === 'unverified' ? 'Ingredient information unverified' : 'Ingredient verification unknown',
    allergenLabel: allergensDocumented ? 'Allergen statements recorded' : 'Allergen information incomplete',
  };
}
