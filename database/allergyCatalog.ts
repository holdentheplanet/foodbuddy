
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

export async function searchAllergens(
  search: string
): Promise<{ id: number; name: string }[]> {
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT id, name FROM allergens
     WHERE name LIKE ?
     ORDER BY name LIMIT 50`,
    [`%${search.trim()}%`]
  );
}

export async function addCustomAllergen(
  name: string
): Promise<number> {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('Enter a food or ingredient name.');
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO allergens (name, is_custom)
     VALUES (?, 1)`,
    [cleanName]
  );

  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM allergens WHERE name = ? COLLATE NOCASE',
    [cleanName]
  );

  if (!row) throw new Error('Could not add allergy.');

  return row.id;
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
