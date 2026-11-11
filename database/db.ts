
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('foodbuddy.db');

// increment this whenever the allergy tables change shape.
const DATABASE_VERSION = 1;

export async function initializeDatabase(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  // SQLite stores a schema version number in the database file (starts at 0).
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = versionRow?.user_version ?? 0;

  // Version 0 -> 1: the allergy tables gained match_type, note, and user_id.
  // CREATE TABLE IF NOT EXISTS can't add columns to existing tables, so drop
  // the allergy tables (children first) and let the block below rebuild them.
  // User accounts are kept; saved allergies are wiped and the catalog reseeds.
  if (currentVersion < 1) {
    await db.execAsync(`
      DROP TABLE IF EXISTS user_allergy_profiles;
      DROP TABLE IF EXISTS allergen_derivatives;
      DROP TABLE IF EXISTS allergens;
    `);
  }

  await db.execAsync(`
    -- User accounts
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      profile_picture TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Existing user allergy selections
    CREATE TABLE IF NOT EXISTS user_allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      allergen TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      UNIQUE(user_id, allergen)
    );

    -- Searchable food allergy catalog
    CREATE TABLE IF NOT EXISTS allergens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      is_custom INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    );

    -- Allergen derivatives and alternative ingredient names
    CREATE TABLE IF NOT EXISTS allergen_derivatives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allergen_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL COLLATE NOCASE,
      FOREIGN KEY (allergen_id) REFERENCES allergens(id)
        ON DELETE CASCADE,
      UNIQUE(allergen_id, ingredient_name)
    );

    -- Allergies saved to each user's profile
    CREATE TABLE IF NOT EXISTS user_allergy_profiles (
      user_id INTEGER NOT NULL,
      allergen_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, allergen_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      FOREIGN KEY (allergen_id) REFERENCES allergens(id)
        ON DELETE CASCADE
    );

    -- One built-in allergen per name, and one custom allergen per name per user.
    -- IFNULL turns NULL (built-in) into 0 so built-in duplicates are caught.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_allergens_name_user
      ON allergens(name, IFNULL(user_id, 0));

    -- Indexes for faster ingredient and allergy searches
    CREATE INDEX IF NOT EXISTS idx_allergen_derivatives_name
      ON allergen_derivatives(ingredient_name);

    CREATE INDEX IF NOT EXISTS idx_user_allergy_profiles_user
      ON user_allergy_profiles(user_id);
  `);

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);

  console.log('FoodBuddy database initialized!');
}

