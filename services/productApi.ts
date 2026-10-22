
export type GroceryProduct = {
  code: string;
  name: string;
  brand: string;
  image: string;
  ingredients: string;
  allergens: string[];
  traces: string[];
};

type USDAFood = {
  fdcId: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  ingredients?: string;
  gtinUpc?: string;
};

type USDASearchResponse = {
  foods?: USDAFood[];
};

// FoodBuddy backend running on your Mac
const API_URL = 'http://10.0.0.121:3001';

function mapFood(food: USDAFood): GroceryProduct {
  return {
    code: String(food.fdcId),
    name: food.description || 'Unnamed Product',
    brand: food.brandName || food.brandOwner || 'Unknown Brand',
    image: '',
    ingredients: food.ingredients || '',
    allergens: [],
    traces: [],
  };
}

export async function searchProducts(
  query: string
): Promise<GroceryProduct[]> {
  const search = query.trim();

  if (!search) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const url =
      `${API_URL}/api/products/search?q=${encodeURIComponent(search)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Product search failed (${response.status}).`
      );
    }

    const results: USDASearchResponse = data;

    if (!Array.isArray(results.foods)) {
      throw new Error('Invalid product search response.');
    }

    const seen = new Set<number>();

    return results.foods
      .filter(food => {
        if (!food.fdcId || seen.has(food.fdcId)) {
          return false;
        }

        seen.add(food.fdcId);
        return true;
      })
      .map(mapFood);
  } catch (error) {
    console.error('FoodBuddy product search error:', error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export async function searchHarrisTeeter(
  term: string,
  locationId: string
): Promise<GroceryProduct[]> {
  const response = await fetch(
    `http://10.0.0.121:3001/api/harristeeter/search?q=${encodeURIComponent(term)}&locationId=${encodeURIComponent(locationId)}`
  );

  if (!response.ok) {
    throw new Error('Harris Teeter product search unavailable');
  }

  const data = await response.json();
  return data.products || [];
}
export async function getHarrisTeeterProductDetails(
  upc: string,
  locationId: string
): Promise<GroceryProduct> {
  const response = await fetch(
    `http://10.0.0.121:3001/api/harristeeter/product/${encodeURIComponent(upc)}?locationId=${encodeURIComponent(locationId)}`
  );

  if (!response.ok) {
    throw new Error('Unable to load product ingredients');
  }

  return response.json();
}