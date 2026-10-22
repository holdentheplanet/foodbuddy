
require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
});
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.json({ message: 'FoodBuddy backend is running!' });
});

app.get('/api/kroger/test', async (req, res) => {
  try {
    const clientId = process.env.KROGER_CLIENT_ID;
    const clientSecret = process.env.KROGER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Missing Kroger credentials in backend/.env',
      });
    }

    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString('base64');

    const response = await fetch(
      'https://api.kroger.com/v1/connect/oauth2/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
  grant_type: 'client_credentials',
}).toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
  console.error('Kroger authentication status:', response.status);
  console.error('Kroger authentication response:', data);

  return res.status(response.status).json({
    error: 'Kroger authentication failed',
    status: response.status,
    details: data.error || 'Unknown error',
    description: data.error_description || null,
  });
}

    res.json({
      success: true,
      message: 'FoodBuddy connected to Kroger!',
      expiresIn: data.expires_in,
    });
  } catch (error) {
    console.error('Kroger connection error:', error.message);
    res.status(500).json({
      error: 'Unable to connect to Kroger',
    });
  }
});

const productCache = new Map();

app.get('/api/products/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Search term required' });
  }

  if (query.length > 100) {
    return res.status(400).json({ error: 'Search term too long' });
  }

  const cacheKey = query.toLowerCase();
  const cached = productCache.get(cacheKey);

  if (cached && Date.now() - cached.time < 3600000) {
    return res.json(cached.data);
  }

  if (!process.env.USDA_API_KEY) {
    return res.status(500).json({
      error: 'USDA API key missing from backend/.env',
    });
  }

  try {
    const url = new URL(
      'https://api.nal.usda.gov/fdc/v1/foods/search'
    );

    url.searchParams.set('api_key', process.env.USDA_API_KEY);
    url.searchParams.set('query', query);
    url.searchParams.set('dataType', 'Branded');
    url.searchParams.set('pageSize', '30');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: response.status === 429
          ? 'USDA search limit reached. Try again later.'
          : 'USDA product search unavailable.',
      });
    }

    const data = await response.json();

    productCache.set(cacheKey, {
      data,
      time: Date.now(),
    });

    res.json(data);
  } catch (error) {
    console.error('USDA backend search failed:', error.message);

    res.status(502).json({
      error: 'Unable to reach USDA. Please try again.',
    });
  }
});
// ============================================
// HARRIS TEETER PRODUCT SEARCH
// Kroger Certification API
// ============================================

const KROGER_API = 'https://api-ce.kroger.com/v1';

let krogerToken = null;
let krogerTokenExpiresAt = 0;

async function getKrogerToken() {
  if (krogerToken && Date.now() < krogerTokenExpiresAt) {
    return krogerToken;
  }

  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Kroger credentials');
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64');

  const response = await fetch(
    `${KROGER_API}/connect/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'product.compact',
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Kroger authentication failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Kroger did not return an access token');
  }

  krogerToken = data.access_token;
  krogerTokenExpiresAt =
    Date.now() + Math.max(0, data.expires_in - 60) * 1000;

  return krogerToken;
}

app.get('/api/harristeeter/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  const locationId = String(
    req.query.locationId || '09700277'
  ).trim();

  if (!query || query.length > 100) {
    return res.status(400).json({
      error: 'Enter a valid product search term',
    });
  }

  if (!/^\d{8}$/.test(locationId)) {
    return res.status(400).json({
      error: 'Invalid Harris Teeter location ID',
    });
  }

  try {
    const token = await getKrogerToken();

    const url = new URL(`${KROGER_API}/products`);

    url.searchParams.set('filter.term', query);
    url.searchParams.set('filter.locationId', locationId);
    url.searchParams.set('filter.limit', '30');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Harris Teeter search failed (${response.status})`,
      });
    }

    const data = await response.json();

    const products = (data.data || []).map((product) => {
      const sizes = product.images?.flatMap(
        (image) => image.sizes || []
      ) || [];

      const preferredImage =
        sizes.find((size) => size.size === 'large') ||
        sizes.find((size) => size.size === 'medium') ||
        sizes[0];

      const item = product.items?.[0];

      return {
        code: product.upc || product.productId,
        name: product.description || 'Unknown Product',
        brand: product.brand || '',
        image: preferredImage?.url || '',
        price: item?.price?.promo ??
          item?.price?.regular ??
          null,
        size: item?.size || '',
        ingredients: '',
        allergens: [],
        traces: [],
        locationId,
      };
    });

    res.json({
      store: 'Harris Teeter',
      locationId,
      environment: 'certification',
      products,
    });
  } catch (error) {
    console.error('Harris Teeter search error:', error.message);

    res.status(502).json({
      error: 'Unable to search Harris Teeter products',
    });
  }
});
// ============================================
// HARRIS TEETER PRODUCT DETAILS
// ============================================

app.get('/api/harristeeter/product/:upc', async (req, res) => {
  const upc = String(req.params.upc || '');
  const locationId = String(req.query.locationId || '09700277');

  if (!/^\d{8,14}$/.test(upc) || !/^\d{8}$/.test(locationId)) {
    return res.status(400).json({
      error: 'Invalid product UPC or location ID',
    });
  }

  try {
    const token = await getKrogerToken();

    const url = new URL(
      `${KROGER_API}/products/${encodeURIComponent(upc)}`
    );
    url.searchParams.set('filter.locationId', locationId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Product details unavailable (${response.status})`,
      });
    }

    const result = await response.json();
    const product = result.data;

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
      });
    }

    const ingredients =
      product.nutritionInformation
        ?.map(info => info.ingredientStatement)
        .filter(Boolean)
        .join(' ') || '';

    const allergens = (product.allergens || [])
      .filter(item =>
        String(item.levelOfContainmentName || '')
          .toLowerCase() === 'contains'
      )
      .map(item => item.name)
      .filter(Boolean);

    const traces = (product.allergens || [])
      .filter(item =>
        String(item.levelOfContainmentName || '')
          .toLowerCase() !== 'contains'
      )
      .map(item => item.name)
      .filter(Boolean);

    res.json({
      code: product.upc || upc,
      name: product.description || '',
      brand: product.brand || '',
      ingredients,
      allergens,
      traces,
      locationId,
    });
  } catch (error) {
    console.error('Harris Teeter details error:', error.message);

    res.status(502).json({
      error: 'Unable to retrieve product details',
    });
  }
});
app.listen(PORT, () => {
  console.log(`FoodBuddy backend running at http://localhost:${PORT}`);
});
