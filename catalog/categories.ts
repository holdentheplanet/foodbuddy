export const GROCERY_CATEGORIES = [
  { id: 'snacks-candy', name: 'Snacks & Candy', icon: '🍿' },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', icon: '🥚' },
  { id: 'breakfast', name: 'Breakfast', icon: '🥣' },
  { id: 'bread-bakery', name: 'Bread & Bakery', icon: '🍞' },
  { id: 'frozen-foods', name: 'Frozen Foods', icon: '❄️' },
  { id: 'beverages', name: 'Beverages', icon: '🥤' },
  { id: 'pantry', name: 'Pantry', icon: '🥫' },
  { id: 'produce', name: 'Produce', icon: '🥬' },
  { id: 'meat-seafood', name: 'Meat & Seafood', icon: '🐟' },
  { id: 'condiments-dressings', name: 'Condiments & Dressings', icon: '🥗' },
] as const;
export type GroceryCategoryId = typeof GROCERY_CATEGORIES[number]['id'];
// Preserve original source snapshots while mapping earlier catalog classifications.
const aliases: Record<string, GroceryCategoryId> = {
  cookies: 'snacks-candy', crackers: 'snacks-candy', chips: 'snacks-candy', candy: 'snacks-candy',
  'snack-bars': 'snacks-candy', cereal: 'breakfast', dairy: 'dairy-eggs',
  spreads: 'pantry', pasta: 'pantry', 'pantry-meals': 'pantry', condiments: 'condiments-dressings',
};
export function resolveCategoryId(category: string): GroceryCategoryId | null {
  return GROCERY_CATEGORIES.find(entry => entry.id === category)?.id ?? (Object.prototype.hasOwnProperty.call(aliases, category) ? aliases[category] : null);
}
