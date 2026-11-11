import type { LocalProductDetails } from './localProductService';

export type SavedProductAllergy = { id: number; name: string; derivatives: string[] };
export type LocalAllergyMatch = {
  allergen: string;
  matchedIngredient: string;
  source: 'ingredients' | 'allergens' | 'traces';
  kind: 'declared' | 'ingredient' | 'possible_derivative';
};
export type LocalAllergyResult = {
  status: 'conflict' | 'caution' | 'no_matches' | 'unknown';
  matches: LocalAllergyMatch[];
  savedAllergyCount: number;
  informationIncomplete: boolean;
  missingInformation: string[];
};
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}
function contains(text: string, term: string): boolean {
  const clean = normalize(term);
  if (!clean) return false;
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(normalize(text));
}
function terms(name: string): string[] {
  const clean = normalize(name);
  // Lexical singular/plural forms, not ingredient or medical inference.
  const singular: Record<string, string> = { peanuts: 'peanut', eggs: 'egg', 'tree nuts': 'tree nut' };
  return singular[clean] ? [clean, singular[clean]] : [clean];
}

/** Explicit offline mapping; never flatten unknown declarations into an empty safe list. */
export function compareLocalProductAllergies(allergies: SavedProductAllergy[], product: LocalProductDetails): LocalAllergyResult {
  const missingInformation: string[] = [];
  if (!product.ingredients.labelText?.trim()) missingInformation.push('Ingredient label unavailable.');
  else if (product.ingredients.verificationStatus !== 'verified') missingInformation.push('Ingredient label is unverified.');
  if (product.allergens.declared.status === 'unknown') missingInformation.push('Manufacturer allergen declaration is unknown.');
  if (product.allergens.precautionary.status === 'unknown') missingInformation.push('Precautionary / cross-contact warning is unknown.');
  const matches: LocalAllergyMatch[] = [];
  const sources = [
    { name: 'ingredients' as const, values: product.ingredients.labelText ? [product.ingredients.labelText] : [] },
    { name: 'allergens' as const, values: product.allergens.declared.status === 'documented' ? product.allergens.declared.names ?? [] : [] },
    { name: 'traces' as const, values: product.allergens.precautionary.status === 'documented' ? product.allergens.precautionary.names ?? [] : [] },
  ];
  for (const allergy of allergies) {
    for (const source of sources) {
      const direct = terms(allergy.name).find(term => source.values.some(value => contains(value, term)));
      const derivative = direct ? undefined : allergy.derivatives.find(term => source.values.some(value => contains(value, term)));
      const matchedIngredient = direct ?? derivative;
      if (!matchedIngredient) continue;
      matches.push({ allergen: allergy.name, matchedIngredient, source: source.name,
        kind: derivative ? 'possible_derivative' : source.name === 'allergens' ? 'declared' : 'ingredient' });
    }
  }
  // Unknown relational assertions cannot establish absence, even if no declaration is known.
  if (product.allergens.relationships.some(row => row.relationship === 'unknown')) {
    missingInformation.push('One or more allergen relationships are unresolved.');
  }
  const directConflict = matches.some(match => match.kind === 'declared'
    || (match.source === 'ingredients' && match.kind === 'ingredient' && product.ingredients.verificationStatus === 'verified'));
  const usable = product.ingredients.verificationStatus === 'verified' && !!product.ingredients.labelText?.trim()
    && product.allergens.declared.status === 'documented';
  return {
    status: allergies.length === 0 ? 'unknown' : directConflict ? 'conflict' : matches.length > 0 ? 'caution' : usable ? 'no_matches' : 'unknown',
    matches, savedAllergyCount: allergies.length,
    informationIncomplete: missingInformation.length > 0, missingInformation,
  };
}
