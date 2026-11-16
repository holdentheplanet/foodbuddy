
import { getDerivatives, getUserAllergyProfile } from '../database/allergyCatalog';
import type { GroceryProduct } from './productApi';
import type { LocalProductDetails } from './localProductService';
import { compareLocalProductAllergies, type SavedDerivative } from './localAllergyMatching';

export type AllergyMatch = {
  allergen: string;
  matchedIngredient: string;
  source: 'ingredients' | 'allergens' | 'traces';
};

export type AllergyCheckResult = {
  status: 'conflict' | 'caution' | 'no_matches' | 'unknown';
  matches: AllergyMatch[];
  savedAllergyCount: number;
};

type SavedAllergy = {
  id: number;
  name: string;
  derivatives: SavedDerivative[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsTerm(text: string, term: string): boolean {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);

  if (!normalizedTerm) return false;

  const escaped = normalizedTerm.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  return new RegExp(
    `(^|[^a-z0-9])${escaped}($|[^a-z0-9])`,
    'i'
  ).test(normalizedText);
}

async function loadSavedAllergies(
  userId: number
): Promise<SavedAllergy[]> {
  const profile = await getUserAllergyProfile(userId);

  const result: SavedAllergy[] = [];

  for (const allergy of profile) {
    // Built-in terms plus this user's own, with match type, note and the
    // user's tolerance. Other users' private terms are never included.
    const derivatives = await getDerivatives(allergy.id, userId);

    result.push({
      id: allergy.id,
      name: allergy.name,
      derivatives: derivatives.map(({ term, matchType, note, tolerance }) => ({
        term,
        matchType,
        note,
        tolerance,
      })),
    });
  }

  return result;
}

export async function checkProductAllergies(
  userId: number,
  product: GroceryProduct
): Promise<AllergyCheckResult> {
  const allergies = await loadSavedAllergies(userId);

  if (allergies.length === 0) {
    return {
      status: 'unknown',
      matches: [],
      savedAllergyCount: 0,
    };
  }

  const matches: AllergyMatch[] = [];
  const sources = [
    {
      name: 'ingredients' as const,
      text: product.ingredients,
    },
    {
      name: 'allergens' as const,
      text: product.allergens.join(', '),
    },
    {
      name: 'traces' as const,
      text: product.traces.join(', '),
    },
  ];

  for (const allergy of allergies) {
    // Legacy online checker (unused): plain term list, skipping exclude and
    // "OK for me" terms so it never flags something the user allowed.
    const terms = [
      allergy.name,
      ...allergy.derivatives
        .filter(d => d.matchType !== 'exclude' && d.tolerance !== 'ok')
        .map(d => d.term),
    ];

    for (const source of sources) {
      for (const term of terms) {
        if (containsTerm(source.text, term)) {
          const duplicate = matches.some(
            match =>
              match.allergen === allergy.name &&
              match.matchedIngredient === term &&
              match.source === source.name
          );

          if (!duplicate) {
            matches.push({
              allergen: allergy.name,
              matchedIngredient: term,
              source: source.name,
            });
          }
        }
      }
    }
  }

  const hasDirectMatch = matches.some(
    match =>
      match.source === 'ingredients' ||
      match.source === 'allergens'
  );

  if (hasDirectMatch) {
    return {
      status: 'conflict',
      matches,
      savedAllergyCount: allergies.length,
    };
  }

  if (matches.length > 0) {
    return {
      status: 'caution',
      matches,
      savedAllergyCount: allergies.length,
    };
  }

  // Missing ingredient data prevents a meaningful check.
  if (!product.ingredients.trim()) {
    return {
      status: 'unknown',
      matches: [],
      savedAllergyCount: allergies.length,
    };
  }

  return {
    status: 'no_matches',
    matches: [],
    savedAllergyCount: allergies.length,
  };
}

/** Uses the same saved profile/catalog as the legacy checker, without network access. */
export async function checkLocalProductAllergies(userId: number, product: LocalProductDetails) {
  return compareLocalProductAllergies(await loadSavedAllergies(userId), product);
}
