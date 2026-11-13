

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
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      is_custom INTEGER NOT NULL DEFAULT 0
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

    -- Indexes for faster ingredient and allergy searches
    CREATE INDEX IF NOT EXISTS idx_allergen_derivatives_name
      ON allergen_derivatives(ingredient_name);

    CREATE INDEX IF NOT EXISTS idx_user_allergy_profiles_user
      ON user_allergy_profiles(user_id);
