
import { db } from './db';
import { ALLERGY_CATALOG } from './allergyCatalogData';

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

// Users can add definite or possible terms. Exclude terms are built-in only.
export type CustomMatchType = Exclude<MatchType, 'exclude'>;

export async function addCustomDerivative(
  userId: number,
  allergenId: number,
  term: string,
  matchType: CustomMatchType
): Promise<number> {
  const cleanTerm = term.trim();

  if (!cleanTerm) {
    throw new Error('Enter an ingredient name.');
  }

  if (matchType !== 'definite' && matchType !== 'possible') {
    throw new Error('Choose Definite or Possible.');
  }

  // The allergen must be built-in or the user's own.
  const allergen = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM allergens
     WHERE id = ? AND (user_id IS NULL OR user_id = ?)`,
    [allergenId, userId]
  );

  if (!allergen) {
    throw new Error('Could not add this ingredient.');
  }

  // Already on the list this user can see (built-in or their own)?
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM allergen_derivatives
     WHERE allergen_id = ?
       AND ingredient_name = ? COLLATE NOCASE
       AND (user_id IS NULL OR user_id = ?)`,
    [allergenId, cleanTerm, userId]
  );

  if (existing) {
    throw new Error("That's already on the list.");
  }

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO allergen_derivatives
     (allergen_id, ingredient_name, match_type, user_id)
     VALUES (?, ?, ?, ?)`,
    [allergenId, cleanTerm, matchType, userId]
  );

  // Nothing inserted means another user on this device added the same term
  // privately (terms are unique per allergen device-wide). Stay generic.
  if (result.changes === 0) {
    throw new Error('Could not add this ingredient.');
  }

  return result.lastInsertRowId;
}

// Only the user's own terms can be removed; built-in terms have user_id NULL,
// so they never match. To stop flagging a built-in term, set it to 'ok'.
export async function removeCustomDerivative(
  userId: number,
  derivativeId: number
): Promise<void> {
  const result = await db.runAsync(
    `DELETE FROM allergen_derivatives
     WHERE id = ? AND user_id = ?`,
    [derivativeId, userId]
  );

  // The user's tolerance row for this term is removed by ON DELETE CASCADE.
  if (result.changes === 0) {
    throw new Error('Only ingredients you added can be removed.');
  }
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
