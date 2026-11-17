import type { LocalProductDetails } from './localProductService';

// definite = always this allergen, possible = sometimes, exclude = looks similar but isn't.
export type DerivativeMatchType = 'definite' | 'possible' | 'exclude';
// The user's own setting: avoid (default) = flag, limit = caution at most, ok = ignore.
export type DerivativeTolerance = 'avoid' | 'limit' | 'ok';
export type SavedDerivative = {
  term: string;
  matchType: DerivativeMatchType;
  note: string | null;
  tolerance: DerivativeTolerance;
};
// A plain string is treated as a possible term set to avoid (the original behavior).
export type SavedProductAllergy = { id: number; name: string; derivatives: (string | SavedDerivative)[] };
export type LocalAllergyMatch = {
  allergen: string;
  matchedIngredient: string;
  source: 'ingredients' | 'allergens' | 'traces';
  kind: 'declared' | 'ingredient' | 'definite_derivative' | 'possible_derivative';
  // Set for derivative matches only; name and declared matches ignore tolerances.
  matchType?: 'definite' | 'possible';
  note?: string | null;
  tolerance?: DerivativeTolerance;
};
export type LocalAllergyResult = {
  status: 'conflict' | 'caution' | 'no_matches' | 'unknown';
  matches: LocalAllergyMatch[];
  savedAllergyCount: number;
  informationIncomplete: boolean;
  missingInformation: string[];
  // Terms found on the label but not flagged because the user set them to "OK for me".
  allowedBySettings: { allergen: string; term: string }[];
};
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}
function wholeWord(normalizedTerm: string, flags = 'i'): RegExp {
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, flags);
}
function contains(text: string, term: string): boolean {
  const clean = normalize(term);
  if (!clean) return false;
  return wholeWord(clean).test(normalize(text));
}
// Blank out an allergen's exclude phrases (e.g. "cocoa butter" for Milk) so the
// words inside them ("butter") can't match. Applies to that allergen only.
function stripExcluded(text: string, excludes: string[]): string {
  let result = normalize(text);
  for (const phrase of excludes) {
    const clean = normalize(phrase);
    if (clean) result = result.replace(wholeWord(clean, 'gi'), '$1 | $2');
  }
  return result;
}
function toSavedDerivative(derivative: string | SavedDerivative): SavedDerivative {
  return typeof derivative === 'string'
    ? { term: derivative, matchType: 'possible', note: null, tolerance: 'avoid' }
    : derivative;
}
function terms(name: string): string[] {
  const clean = normalize(name);
  // Lexical singular/plural forms, not ingredient or medical inference.
  const singular: Record<string, string> = { peanuts: 'peanut', eggs: 'egg', 'tree nuts': 'tree nut',
    oats: 'oat', 'pine nuts': 'pine nut', insects: 'insect' };
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
  const allowedBySettings: LocalAllergyResult['allowedBySettings'] = [];
  const sources = [
    { name: 'ingredients' as const, values: product.ingredients.labelText ? [product.ingredients.labelText] : [] },
    { name: 'allergens' as const, values: product.allergens.declared.status === 'documented' ? product.allergens.declared.names ?? [] : [] },
    { name: 'traces' as const, values: product.allergens.precautionary.status === 'documented' ? product.allergens.precautionary.names ?? [] : [] },
  ];
  for (const allergy of allergies) {
    const nameTerms = terms(allergy.name);
    const derivatives = allergy.derivatives.map(toSavedDerivative);
    const excludes = derivatives.filter(d => d.matchType === 'exclude').map(d => d.term);
    // A term identical to the allergen name ("Milk" under Milk) is the name
    // itself, so it's handled by the name rule and can't be set to OK.
    const named = derivatives.filter(d => d.matchType !== 'exclude' && !nameTerms.includes(normalize(d.term)));
    for (const source of sources) {
      let values = source.values.map(value => stripExcluded(value, excludes));
      const findName = () => nameTerms.find(term => values.some(value => contains(value, term)));
      const pushName = (matchedIngredient: string) => matches.push({ allergen: allergy.name, matchedIngredient,
        source: source.name, kind: source.name === 'allergens' ? 'declared' : 'ingredient' });

      // A declared allergen name always wins, exactly as before.
      if (source.name === 'allergens') {
        const declared = findName();
        if (declared) { pushName(declared); continue; }
      }

      // Check the user's terms first, so a tolerated phrase that contains the
      // allergen name ("soy lecithin", "corn syrup") uses the user's setting.
      const matched: string[] = [];
      for (const derivative of named) {
        const key = normalize(derivative.term);
        if (!key || matched.includes(key) || !values.some(value => contains(value, derivative.term))) continue;
        matched.push(key);
        if (derivative.tolerance === 'ok') { // "OK for me": not flagged, only listed.
          if (!allowedBySettings.some(a => a.allergen === allergy.name && normalize(a.term) === key)) {
            allowedBySettings.push({ allergen: allergy.name, term: derivative.term });
          }
          continue;
        }
        const matchType = derivative.matchType === 'definite' ? 'definite' : 'possible';
        matches.push({ allergen: allergy.name, matchedIngredient: derivative.term, source: source.name,
          kind: matchType === 'definite' ? 'definite_derivative' : 'possible_derivative',
          matchType, note: derivative.note, tolerance: derivative.tolerance });
      }

      // Then the allergen name anywhere outside those phrases. A standalone
      // "corn", e.g. "Maltodextrin (Made from Corn)", is always reported.
      if (source.name !== 'allergens') {
        values = values.map(value => stripExcluded(value, [...matched].sort((a, b) => b.length - a.length)));
        const direct = findName();
        if (direct) pushName(direct);
      }
    }
  }
  // Unknown relational assertions cannot establish absence, even if no declaration is known.
  if (product.allergens.relationships.some(row => row.relationship === 'unknown')) {
    missingInformation.push('One or more allergen relationships are unresolved.');
  }
  // Conflict: a declared allergen, or on a verified ingredient label either the
  // allergen's name or a definite term the user avoids. "Small amounts" terms,
  // possible terms, unverified labels and traces stay a caution.
  const verified = product.ingredients.verificationStatus === 'verified';
  const directConflict = matches.some(match => match.kind === 'declared'
    || (match.source === 'ingredients' && verified && (match.kind === 'ingredient'
      || (match.kind === 'definite_derivative' && match.tolerance === 'avoid'))));
  const usable = product.ingredients.verificationStatus === 'verified' && !!product.ingredients.labelText?.trim()
    && product.allergens.declared.status === 'documented';
  return {
    status: allergies.length === 0 ? 'unknown' : directConflict ? 'conflict' : matches.length > 0 ? 'caution' : usable ? 'no_matches' : 'unknown',
    matches, savedAllergyCount: allergies.length,
    informationIncomplete: missingInformation.length > 0, missingInformation, allowedBySettings,
  };
}
