
import { db } from './db';

const ALLERGY_CATALOG: Record<string, string[]> = {
  Milk: [
    'Milk',
    'Casein',
    'Caseinate',
    'Whey',
    'Whey Protein',
    'Lactalbumin',
    'Lactoglobulin',
    'Ghee',
    'Butter',
    'Cheese',
    'Yogurt',
  ],
  Eggs: [
    'Eggs',
    'Egg',
    'Albumin',
    'Ovalbumin',
    'Ovomucoid',
    'Egg White',
    'Egg Yolk',
    'Lysozyme',
  ],
  Peanuts: [
    'Peanuts',
    'Peanut',
    'Peanut Butter',
    'Peanut Oil',
    'Peanut Paste',
    'Hydrolyzed Peanut Protein',
    'Peanut Flour',
    'Peanut Protein',
    'Groundnuts',
    'Arachis Oil',
  ],
  Wheat: [
    'Wheat',
    'Wheat Flour',
    'Wheat Bran',
    'Wheat Germ',
    'Wheat Starch',
    'Wheat Protein',
    'Semolina',
    'Farina',
    'Bulgur',
    'Durum',
    'Spelt',
    'Wheat Gluten',
  ],
  Soy: [
    'Soy',
    'Soy Milk',
    'Soy Protein',
    'Soy Protein Isolate',
    'Tofu',
    'Tempeh',
    'Edamame',
    'Miso',
  ],
  Sesame: [
    'Sesame',
    'Sesame Seeds',
    'Tahini',
    'Sesame Flour',
    'Sesame Paste',
    'Sesame Oil',
  ],
  Fish: [
    'Anchovies',
    'Anchovy',
    'Cod',
    'Salmon',
    'Tuna',
    'Fish Sauce',
  ],
  Shellfish: [
    'Shrimp',
    'Prawn',
    'Crab',
    'Lobster',
    'Crayfish',
  ],
  'Tree Nuts': [
    'Almonds',
    'Almond',
    'Cashew',
    'Cashews',
    'Walnut',
    'Walnuts',
    'Pecan',
    'Pecans',
    'Pistachio',
    'Pistachios',
    'Hazelnut',
    'Hazelnuts',
    'Macadamia',
    'Macadamia Nuts',
  ],
  Corn: [
    'Cornmeal',
    'Corn Flour',
    'Cornstarch',
    'Corn Syrup',
    'Dextrose',
    'Maltodextrin',
    'High Fructose Corn Syrup',
    'Corn Oil',
    'Corn Fiber',
    'Polydextrose',
    'Corn Gluten',
    'Fructose',
    'Natural Flavors',
  ],
  Mustard: [
    'Mustard Seed',
    'Mustard Flour',
    'Mustard Powder',
  ],
  Celery: [
    'Celery Seed',
    'Celery Salt',
    'Celeriac',
  ],
  Lupin: [
    'Lupin Flour',
    'Lupine Protein',
  ],
  Buckwheat: [
    'Buckwheat Flour',
    'Soba',
  ],
  Coconut: [
    'Coconut Milk',
    'Coconut Flour',
    'Coconut Oil',
  ],
  Garlic: [
    'Garlic Powder',
    'Garlic Salt',
    'Dehydrated Garlic',
  ],
  Onion: [
    'Onion Powder',
    'Dried Onion',
    'Onion Flakes',
  ],
  Strawberry: [
    'Strawberry Puree',
    'Strawberry Powder',
  ],
  Avocado: [
    'Avocado Oil',
    'Avocado Powder',
  ],

  // for celiac disease and gluten sensitivity-- different than wheat allergy, though there is some overlap
  Gluten: [
    'Wheat',
    'Barley',
    'Rye',
    'Wheatberries',
    'Durum',
    'Emmer',
    'Semolina',
    'Spelt',
    'Farina',
    'Farro',
    'Graham',
    'Kamut',
    'Einkorn Wheat',
    'Triticale',
    'Malted Barley Flour',
    'Malted Milk',
    'Malt Extract',
    'Malt Syrup',
    'Malt Flavoring',
    'Malt Flavor',
    'Malt vinegar',
    'Brewer\'s Yeast',
    'Brewers Yeast',
    'Wheat Starch',
  ]
};

export async function seedAllergyCatalog(): Promise<void> {
  for (const [allergen, derivatives] of Object.entries(
    ALLERGY_CATALOG
  )) {
    await db.runAsync(
      'INSERT OR IGNORE INTO allergens (name) VALUES (?)',
      [allergen]
    );

    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM allergens WHERE name = ? COLLATE NOCASE',
      [allergen]
    );

    if (!row) continue;

    for (const ingredient of derivatives) {
      await db.runAsync(
        `INSERT OR IGNORE INTO allergen_derivatives
         (allergen_id, ingredient_name)
         VALUES (?, ?)`,
        [row.id, ingredient]
      );
    }
  }
}

// Privacy rule used throughout this file: a user can only see built-in rows
// (user_id IS NULL) and rows they created themselves (user_id = their id).

export type MatchType = 'definite' | 'possible' | 'exclude';

// avoid = flag it (default), limit = caution at most, ok = ignore this term.
export type Tolerance = 'avoid' | 'limit' | 'ok';

const TOLERANCES: readonly Tolerance[] = ['avoid', 'limit', 'ok'];

export type Derivative = {
  id: number;
  term: string;
  matchType: MatchType;
  note: string | null;
  isCustom: boolean;
  // Exclude terms are never flagged, so their tolerance is always 'avoid'.
  tolerance: Tolerance;
};

export async function searchAllergens(
  search: string,
  userId: number
): Promise<{ id: number; name: string }[]> {
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM allergens
     WHERE name LIKE ?
       AND (user_id IS NULL OR user_id = ?)
     ORDER BY name LIMIT 50`,
    [`%${search.trim()}%`, userId]
  );
}

export async function addCustomAllergen(
  userId: number,
  name: string
): Promise<number> {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('Enter a food or ingredient name.');
  }

  // If it's already built in, or this user already made it, reuse that row.
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM allergens
     WHERE name = ? COLLATE NOCASE
       AND (user_id IS NULL OR user_id = ?)`,
    [cleanName, userId]
  );

  if (existing) return existing.id;

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO allergens (name, is_custom, user_id)
     VALUES (?, 1, ?)`,
    [cleanName, userId]
  );

  // Nothing inserted means another user on this device has a private allergen
  // with this name (names are unique device-wide). Keep the message generic
  // so it doesn't reveal that someone else's allergen exists.
  if (result.changes === 0) {
    throw new Error('Could not add this allergy. Try a different name.');
  }

  return result.lastInsertRowId;
}

export async function getDerivatives(
  allergenId: number,
  userId: number
): Promise<Derivative[]> {
  const rows = await db.getAllAsync<{
    id: number;
    term: string;
    match_type: MatchType;
    note: string | null;
    is_custom: number;
    tolerance: Tolerance;
  }>(
    `SELECT d.id,
            d.ingredient_name AS term,
            d.match_type,
            d.note,
            d.user_id IS NOT NULL AS is_custom,
            COALESCE(p.tolerance, 'avoid') AS tolerance
     FROM allergen_derivatives d
     JOIN allergens a
       ON a.id = d.allergen_id
      AND (a.user_id IS NULL OR a.user_id = ?)
     LEFT JOIN user_derivative_preferences p
       ON p.derivative_id = d.id
      AND p.user_id = ?
     WHERE d.allergen_id = ?
       AND (d.user_id IS NULL OR d.user_id = ?)
     ORDER BY CASE d.match_type
                WHEN 'definite' THEN 0
                WHEN 'possible' THEN 1
                ELSE 2
              END,
              d.ingredient_name`,
    [userId, userId, allergenId, userId]
  );

  return rows.map(row => ({
    id: row.id,
    term: row.term,
    matchType: row.match_type,
    note: row.note,
    isCustom: row.is_custom === 1,
    tolerance: row.tolerance,
  }));
}

export async function setDerivativeTolerance(
  userId: number,
  derivativeId: number,
  tolerance: Tolerance
): Promise<void> {
  if (!TOLERANCES.includes(tolerance)) {
    throw new Error('Unknown tolerance setting.');
  }

  // The term (and its allergen) must be built-in or this user's own.
  const derivative = await db.getFirstAsync<{ match_type: MatchType }>(
    `SELECT d.match_type
     FROM allergen_derivatives d
     JOIN allergens a ON a.id = d.allergen_id
     WHERE d.id = ?
       AND (d.user_id IS NULL OR d.user_id = ?)
       AND (a.user_id IS NULL OR a.user_id = ?)`,
    [derivativeId, userId, userId]
  );

  if (!derivative) {
    throw new Error('Could not update this ingredient.');
  }

  if (derivative.match_type === 'exclude') {
    throw new Error('This ingredient is never flagged, so it has no setting.');
  }

  // 'avoid' is the default, so it's stored as no row at all.
  if (tolerance === 'avoid') {
    await db.runAsync(
      `DELETE FROM user_derivative_preferences
       WHERE user_id = ? AND derivative_id = ?`,
      [userId, derivativeId]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO user_derivative_preferences (user_id, derivative_id, tolerance)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, derivative_id)
     DO UPDATE SET tolerance = excluded.tolerance`,
    [userId, derivativeId, tolerance]
  );
}

export async function getUserAllergyProfile(
  userId: number
): Promise<{ id: number; name: string }[]> {
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT a.id, a.name
     FROM allergens a
     JOIN user_allergy_profiles u
       ON u.allergen_id = a.id
     WHERE u.user_id = ?
     ORDER BY a.name`,
    [userId]
  );
}

export async function addUserAllergy(
  userId: number,
  allergenId: number
): Promise<void> {
  // Only built-in allergens or the user's own can be saved to their profile.
  const allergen = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM allergens
     WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
    [allergenId, userId]
  );

  if (!allergen) {
    throw new Error('Could not save this allergy.');
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO user_allergy_profiles
     (user_id, allergen_id) VALUES (?, ?)`,
    [userId, allergenId]
  );
}

export async function removeUserAllergy(
  userId: number,
  allergenId: number
): Promise<void> {
  await db.runAsync(
    `DELETE FROM user_allergy_profiles
     WHERE user_id = ? AND allergen_id = ?`,
    [userId, allergenId]
  );
}
