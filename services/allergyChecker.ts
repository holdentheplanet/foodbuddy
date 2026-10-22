
import { db } from '../database/db';
import { getUserAllergyProfile } from '../database/allergyCatalog';
import { GroceryProduct } from './productApi';

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
  derivatives: string[];
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
    const rows = await db.getAllAsync<{
      ingredient_name: string;
    }>(
      `SELECT ingredient_name
       FROM allergen_derivatives
       WHERE allergen_id = ?`,
      [allergy.id]
    );

    result.push({
      id: allergy.id,
      name: allergy.name,
      derivatives: rows.map(row => row.ingredient_name),
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
    const terms = [
      allergy.name,
      ...allergy.derivatives,
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
