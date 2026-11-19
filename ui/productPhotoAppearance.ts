import { GROCERY_CATEGORIES } from '../catalog/categories';

// Category accents describe grocery aisles only; they never encode allergy safety.
const surfaces: Record<string, string> = {
  'snacks-candy': '#F4EFE8', 'dairy-eggs': '#EEF2F4', breakfast: '#F3F0E6',
  'bread-bakery': '#F3EDE5', 'frozen-foods': '#EDF3F4', beverages: '#EFF3F1',
  pantry: '#F0F1E9', produce: '#EDF2E9', 'meat-seafood': '#F3EFED',
  'condiments-dressings': '#F1EFE7',
};
export function productPhotoAppearance(categoryId: string | null) {
  const category = GROCERY_CATEGORIES.find(item => item.id === categoryId);
  return {
    categoryName: category?.name ?? 'Grocery product',
    icon: category?.icon ?? '▧',
    surface: category ? surfaces[category.id] : '#F0F2EF',
  };
}
