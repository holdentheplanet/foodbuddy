import type { LocalAllergyResult } from '../services/localAllergyMatching';
/** Presentation only: the existing evaluator owns all matching and tolerances. */
export function productAllergyStatus(result: LocalAllergyResult | null | undefined, evidenceComplete = true) {
  if (result?.status === 'conflict') return { tone: 'red' as const, label: 'Allergy match', reason: [...new Set(result.matches.map(match => `${match.allergen}: ${match.matchedIngredient}`))].join(' · ') };
  if (!result || !result.savedAllergyCount || result.status !== 'no_matches' || result.informationIncomplete || !evidenceComplete) {
    return { tone: 'yellow' as const, label: 'Check ingredients', reason: !result ? 'Assessment pending or unavailable'
      : !result.savedAllergyCount ? 'Set up your allergy profile'
      : result.matches.length ? [...new Set(result.matches.map(match => `${match.allergen}: ${match.matchedIngredient}`))].join(' · ')
      : 'Information is incomplete or unverified' };
  }
  return { tone: 'green' as const, label: 'No known matches', reason: 'Based on your saved allergies and available label evidence' };
}
