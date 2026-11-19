import { GROCERY_CATEGORIES, resolveCategoryId } from '../catalog/categories';
/** Generic aisle artwork is never evidence of product identity, ingredients, or safety. */
export function categoryArtworkInfo(categoryId: string | null) {
  const id = categoryId ? resolveCategoryId(categoryId) : null;
  return { id: id ?? 'pantry', file: `${id ?? 'pantry'}.jpg`,
    label: `${GROCERY_CATEGORIES.find(category => category.id === id)?.name ?? 'Grocery'} category illustration — not actual product packaging` };
}
export function productImageMode(hasApprovedPhoto: boolean, photoFailed: boolean) {
  return hasApprovedPhoto && !photoFailed ? 'photo' : 'category_art';
}
