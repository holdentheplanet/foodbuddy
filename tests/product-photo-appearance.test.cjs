const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const { productPhotoAppearance } = load(path.resolve('ui/productPhotoAppearance.ts'));
const { GROCERY_CATEGORIES } = load(path.resolve('catalog/categories.ts'));

test('every grocery category has an existing icon and subtle aisle styling without safety claims', () => {
  for (const category of GROCERY_CATEGORIES) {
    const appearance = productPhotoAppearance(category.id);
    assert.equal(appearance.categoryName, category.name);
    assert.equal(appearance.icon, category.icon);
    assert.match(appearance.surface, /^#[0-9A-F]{6}$/);
    const channels = appearance.surface.slice(1).match(/../g).map(value => parseInt(value, 16));
    assert(channels.every(value => value >= 225), 'category backgrounds stay subtle');
    assert(!/safe|free|verified|allergen/i.test(appearance.categoryName));
  }
});
test('unknown, null and inherited category names use the same neutral fallback', () => {
  for (const id of [null, '', 'missing', '__proto__', 'constructor']) {
    assert.deepEqual(productPhotoAppearance(id), { categoryName: 'Grocery product', icon: '▧', surface: '#F0F2EF' });
  }
});
