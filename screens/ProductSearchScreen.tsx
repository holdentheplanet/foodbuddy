import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  GroceryProduct,
  searchProducts,
  searchHarrisTeeter,
  getHarrisTeeterProductDetails,
} from '../services/productApi';

import {
  AllergyCheckResult,
  checkProductAllergies,
} from '../services/allergyChecker';

const GREEN = '#183D32';
const BLUE = '#172B4D';
const CREAM = '#F7F5EF';
const BORDER = '#E6E8E4';

const CATEGORIES = [
  { label: 'Dairy', icon: '🥛', search: 'milk' },
  { label: 'Bakery', icon: '🥖', search: 'bread' },
  { label: 'Breakfast', icon: '🥣', search: 'cereal' },
  { label: 'Snacks', icon: '🥨', search: 'snacks' },
  { label: 'Drinks', icon: '🥤', search: 'juice' },
  { label: 'Frozen', icon: '🧊', search: 'frozen' },
] as const;

type GroceryStore = { id: string; name: string; address: string; locationId: string; };

// Starter Charleston-area locations. Confirm the address before visiting.
const STORES: GroceryStore[] = [
  {
    id: 'east-bay',
    name: 'Harris Teeter — East Bay',
    address: '290 E Bay St, Charleston, SC 29401',
    locationId: '09700277',
  },
  {
    id: 'harbor-view',
    name: 'Harris Teeter — Harbor View',
    address: '1005 Harbor View Rd, Charleston, SC 29412',
    locationId: '09700456',
  },
  {
    id: 'james-island',
    name: 'Harris Teeter — James Island',
    address: '1739 Maybank Hwy, Charleston, SC 29412',
    locationId: '09700455',
  },
  {
    id: 'west-ashley',
    name: 'Harris Teeter — West Ashley',
    address: '3865 W Ashley Cir, Charleston, SC 29414',
    locationId: '09700406',
  },
];

type Props = {
  userId: number;
  onBack: () => void;
};

export default function ProductSearchScreen({
  userId,
  onBack,
}: Props) {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [choosingStore, setChoosingStore] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(`foodbuddy:store:${userId}`)
      .then(id => { if (mounted && id && STORES.some(store => store.id === id)) setStoreId(id); })
      .catch(error => console.warn('Could not load selected store', error));
    return () => { mounted = false; };
  }, [userId]);

  async function chooseStore(id: string) {
    setStoreSaving(true);
    try {
      await AsyncStorage.setItem(`foodbuddy:store:${userId}`, id);
      setStoreId(id);
      setChoosingStore(false);
    } catch (error) {
      Alert.alert('Unable to save store', 'Please try again.');
    } finally {
      setStoreSaving(false);
    }
  }

  const currentStore = STORES.find(store => store.id === storeId);
  async function openProduct(product: GroceryProduct) {
  setSelected(product);
  setCheckResult(null);
  setCheckError(false);

  if (!currentStore) return;

  setChecking(true);

  try {
    const details = await getHarrisTeeterProductDetails(
      product.code,
      currentStore.locationId
    );

    const updatedProduct = {
      ...product,
      ingredients: details.ingredients || '',
      allergens: details.allergens || [],
      traces: details.traces || [],
    };

    setSelected(updatedProduct);

    if (updatedProduct.ingredients || updatedProduct.allergens.length) {
      const result = await checkProductAllergies(
        userId,
        updatedProduct
      );
      setCheckResult(result);
    }
  } catch (error) {
    console.error('Unable to load Harris Teeter ingredients:', error);
    setCheckError(true);
  } finally {
    setChecking(false);
  }
}
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const searchId = useRef(0);
  const [products, setProducts] = useState<GroceryProduct[]>([]);
  const [selected, setSelected] = useState<GroceryProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [checkResult, setCheckResult] =
    useState<AllergyCheckResult | null>(null);
  const [checkError, setCheckError] = useState(false);
  const [cardChecks, setCardChecks] = useState<Record<string, AllergyCheckResult | 'error'>>({});


  async function handleSearch(searchTerm: string = query) {
    const term = searchTerm.trim();
    if (!term) return;

    const request = ++searchId.current;
    setLoading(true);
    setHasSearched(false);
    setProducts([]);

    try {
      const results = currentStore
  ? await searchHarrisTeeter(term, currentStore.locationId)
  : await searchProducts(term);
      if (request !== searchId.current) return;
      setProducts(results);
      setHasSearched(true);
    } catch (error) {
      if (request !== searchId.current) return;
      console.error('Product search failed:', error);
      Alert.alert(
        'Product Search Unavailable',
        error instanceof Error ? error.message : 'Please try again later.'
      );
    } finally {
      if (request === searchId.current) setLoading(false);
    }
  }

  function selectCategory(category: (typeof CATEGORIES)[number]) {
    setActiveCategory(category.label);
    setQuery(category.search);
    void handleSearch(category.search);
  }

  function searchTypedQuery() {
    setActiveCategory(null);
    void handleSearch(query);
  }

  useEffect(() => {
    let active = true;

    async function checkSelectedProduct() {
      setCheckResult(null);
      setCheckError(false);

      if (!selected) {
        setChecking(false);
        return;
      }

      setChecking(true);

      try {
        const result = await checkProductAllergies(
          userId,
          selected
        );

        if (active) {
          setCheckResult(result);
        }
      } catch (error) {
        console.error('Allergy check failed:', error);

        if (active) {
          setCheckError(true);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkSelectedProduct();

    return () => {
      active = false;
    };
  }, [selected, userId]);

  // Check products in small batches so category searches remain responsive.
  // Load Harris Teeter ingredients before checking product card allergies.
useEffect(() => {
  let cancelled = false;

  setCardChecks({});

  if (products.length === 0) {
    return () => {
      cancelled = true;
    };
  }

  const locationId = currentStore?.locationId;

  let nextIndex = 0;

  async function worker() {
    while (!cancelled && nextIndex < products.length) {
      const product = products[nextIndex++];

      try {
        let productToCheck = product;

        if (locationId) {
          const details = await getHarrisTeeterProductDetails(
            product.code,
            locationId
          );

          productToCheck = {
            ...product,
            ingredients: details.ingredients || '',
            allergens: details.allergens || [],
            traces: details.traces || [],
          };
        }

        // Never report "no known matches" without usable ingredient data.
        if (
          !productToCheck.ingredients?.trim() &&
          productToCheck.allergens.length === 0 &&
          productToCheck.traces.length === 0
        ) {
          if (!cancelled) {
            setCardChecks(previous => ({
              ...previous,
              [product.code]: 'error',
            }));
          }
          continue;
        }

        const result = await checkProductAllergies(
          userId,
          productToCheck
        );

        if (!cancelled) {
          setCardChecks(previous => ({
            ...previous,
            [product.code]: result,
          }));
        }
      } catch (error) {
        console.warn(
          'Product card allergy check failed:',
          product.code,
          error
        );

        if (!cancelled) {
          setCardChecks(previous => ({
            ...previous,
            [product.code]: 'error',
          }));
        }
      }
    }
  }

  void Promise.all(
    Array.from(
      { length: Math.min(4, products.length) },
      () => worker()
    )
  );

  return () => {
    cancelled = true;
  };
}, [products, userId, currentStore?.locationId]);

  function renderCardAllergyStatus(product: GroceryProduct) {
    const result = cardChecks[product.code];
    let label = 'Checking allergies...';
    let boxStyle = styles.cardStatusUnknown;
    let textStyle = styles.cardStatusText;

    if (result === 'error') {
  label = '⚠️ Allergy info unavailable';
}else if (result) {
      if (result.savedAllergyCount === 0) {
        label = '⚠️ Set up allergies';
      } else if (result.status === 'conflict') {
        label = '🚨 Allergy match';
        boxStyle = styles.cardStatusDanger;
      } else if (result.status === 'caution') {
        label = '⚠️ Possible traces';
        boxStyle = styles.cardStatusCaution;
      } else if (result.status === 'no_matches') {
        label = '🔎 No known matches';
        boxStyle = styles.cardStatusReview;
      } else {
        label = '⚠️ Info incomplete';
      }
    }

    return (
      <View style={[styles.cardStatus, boxStyle]}>
        <Text style={textStyle} numberOfLines={2}>{label}</Text>
      </View>
    );
  }

  function renderAllergyStatus() {
    if (checking) {
      return (
        <View style={styles.statusBox}>
          <ActivityIndicator color={GREEN} />
          <Text style={styles.statusDescription}>
            Checking your saved allergies...
          </Text>
        </View>
      );
    }

    if (checkError || !checkResult) {
      return (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>
            ⚠️ Unable to Verify
          </Text>
          <Text style={styles.statusDescription}>
            FoodBuddy could not complete the allergy check.
            Please check the product packaging.
          </Text>
        </View>
      );
    }

    if (checkResult.savedAllergyCount === 0) {
      return (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>
            ⚠️ No Saved Allergies
          </Text>
          <Text style={styles.statusDescription}>
            Add allergies to your profile for personalized
            ingredient warnings.
          </Text>
        </View>
      );
    }

    const result = checkResult;

    const title =
      result.status === 'conflict'
        ? '🚨 Potential Allergy Conflict'
        : result.status === 'caution'
        ? '⚠️ Possible Cross-Contact'
        : result.status === 'unknown'
        ? '⚠️ Unable to Verify'
        : '🔎 No Known Matches Found';

    const description =
      result.status === 'conflict'
        ? 'An ingredient matched your saved allergy profile.'
        : result.status === 'caution'
        ? 'A saved allergen appeared in possible traces.'
        : result.status === 'unknown'
        ? 'Ingredient information is missing or incomplete.'
        : 'No known matches were found in the available information. This does not guarantee safety.';

    return (
      <View
        style={[
          styles.statusBox,
          result.status === 'conflict' && styles.dangerBox,
        ]}
      >
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusDescription}>
          {description}
        </Text>

        {result.matches.map((match, index) => (
          <View
            key={`${match.allergen}-${match.source}-${index}`}
            style={styles.matchRow}
          >
            <Text style={styles.matchText}>
              {match.allergen}: {match.matchedIngredient}
            </Text>
            <Text style={styles.matchSource}>
              Found in {match.source}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  function renderProductImage(
    product: GroceryProduct,
    large = false
  ) {
    return (
      <View
        style={[
          styles.imageFrame,
          large && styles.largeImageFrame,
        ]}
      >
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🛒</Text>
            <Text style={styles.placeholderText}>
              Image unavailable
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (selected) {
            setSelected(null);
          } else {
            onBack();
          }
        }}
      >
        <Text style={styles.backText}>
          {selected ? '← Search Results' : '← Home'}
        </Text>
      </TouchableOpacity>

      {selected ? (
        <>
          <View style={styles.detailCard}>
            {renderProductImage(selected, true)}

            <Text style={styles.detailBrand}>
              {selected.brand}
            </Text>

            <Text style={styles.detailTitle}>
              {selected.name}
            </Text>

            {renderAllergyStatus()}

            <Text style={styles.sectionTitle}>
              Ingredients
            </Text>
            <Text style={styles.bodyText}>
              {selected.ingredients ||
                'English ingredient information unavailable.'}
            </Text>

            <Text style={styles.sectionTitle}>
              Listed Allergens
            </Text>
            <Text style={styles.bodyText}>
              {selected.allergens.length > 0
                ? selected.allergens.join(', ')
                : 'No allergen information provided.'}
            </Text>

            <Text style={styles.sectionTitle}>
              May Contain / Traces
            </Text>
            <Text style={styles.bodyText}>
              {selected.traces.length > 0
                ? selected.traces.join(', ')
                : 'No trace information provided.'}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            Shop Products
          </Text>

          <Text style={styles.subtitle}>
            Find groceries and review ingredients
            based on your saved allergies.
          </Text>

          <View style={styles.storePanel}>
            <Text style={styles.storeHeading}>🏬 My Grocery Store</Text>
            <Text style={styles.storeName}>{currentStore ? currentStore.name : 'Choose a Harris Teeter location'}</Text>
            {currentStore && <Text style={styles.storeAddress}>{currentStore.address}</Text>}
            <TouchableOpacity style={styles.storeButton} onPress={() => setChoosingStore(value => !value)}>
              <Text style={styles.storeButtonText}>{choosingStore ? 'Close store list' : currentStore ? 'Change store' : 'Choose store'}</Text>
            </TouchableOpacity>
            {choosingStore && STORES.map(store => (
              <TouchableOpacity
                key={store.id}
                disabled={storeSaving}
                style={[styles.storeOption, store.id === storeId && styles.storeOptionSelected]}
                onPress={() => void chooseStore(store.id)}
              >
                <Text style={styles.storeOptionTitle}>{store.name}{store.id === storeId ? '  ✓' : ''}</Text>
                <Text style={styles.storeAddress}>{store.address}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.storeNote}>Store selection is saved on this device. Product results below come from USDA, not live Harris Teeter inventory or pricing. Confirm store details before visiting.</Text>
          </View>

          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              style={styles.searchInput}
              placeholder="Search groceries or brands"
              placeholderTextColor="#929A95"
              value={query}
              onChangeText={text => { setQuery(text); setActiveCategory(null); }}
              returnKeyType="search"
              onSubmitEditing={searchTypedQuery}
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchTypedQuery}
              disabled={loading}
            >
              <Text style={styles.searchButtonText}>
                Search
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.categoryHeading}>Browse categories</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(category => (
              <TouchableOpacity
                key={category.label}
                style={[
                  styles.categoryCard,
                  activeCategory === category.label && styles.activeCategoryCard,
                ]}
                onPress={() => selectCategory(category)}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${category.label}`}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>
              Your personalized grocery guide
            </Text>
            <Text style={styles.infoText}>
              Select a product to check ingredients
              against your saved allergy profile.
            </Text>
          </View>

          {loading && (
            <ActivityIndicator
              size="large"
              color={GREEN}
              style={styles.loader}
            />
          )}

          {!loading && !hasSearched && (
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeIcon}>🛍️</Text>
              <Text style={styles.welcomeTitle}>
                What are you shopping for?
              </Text>
              <Text style={styles.welcomeText}>
                Search for cereal, snacks, drinks,
                or your favorite grocery brands.
              </Text>
            </View>
          )}

          {!loading && hasSearched && (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>
                  Search Results
                </Text>
                <Text style={styles.resultsCount}>
                  {products.length} products
                </Text>
              </View>

              {products.length === 0 ? (
                <View style={styles.welcomeCard}>
                  <Text style={styles.welcomeTitle}>
                    No products found
                  </Text>
                  <Text style={styles.welcomeText}>
                    Try another search term or brand.
                  </Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {products.map(product => (
                    <TouchableOpacity
                      key={product.code}
                      style={styles.productCard}
                      onPress={() => openProduct(product)}
                      activeOpacity={0.8}
                    >
                      {renderProductImage(product)}

                      <View style={styles.cardContent}>
                        <Text
                          style={styles.cardBrand}
                          numberOfLines={1}
                        >
                          {product.brand}
                        </Text>

                        <Text
                          style={styles.cardName}
                          numberOfLines={3}
                        >
                          {product.name}
                        </Text>

                        {renderCardAllergyStatus(product)}

                        <View style={styles.checkButton}>
                          <Text style={styles.checkButtonText}>
                            Check Ingredients
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      )}

      <Text style={styles.disclaimer}>
        Product information comes from USDA FoodData Central.
        Allergy checks are preliminary and may miss allergens or cross-contact.
        Always read current packaging and allergen warnings before consuming.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  storePanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16, marginBottom: 18 },
  storeHeading: { color: GREEN, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  storeName: { color: BLUE, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  storeAddress: { color: '#69736F', fontSize: 12, lineHeight: 18 },
  storeButton: { alignSelf: 'flex-start', backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  storeButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  storeOption: { paddingVertical: 12, paddingHorizontal: 10, marginTop: 10, borderWidth: 1, borderColor: BORDER, borderRadius: 10 },
  storeOptionSelected: { borderColor: GREEN, backgroundColor: '#E5EEE8' },
  storeOptionTitle: { color: BLUE, fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  storeNote: { color: '#737C77', fontSize: 11, lineHeight: 16, marginTop: 12 },
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 50,
  },
  backButton: {
    paddingVertical: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backText: {
    color: GREEN,
    fontWeight: 'bold',
    fontSize: 15,
  },
  title: {
    fontSize: 29,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 7,
  },
  subtitle: {
    color: '#69736F',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingLeft: 13,
    marginBottom: 18,
  },
  searchIcon: {
    fontSize: 25,
    color: GREEN,
    marginRight: 7,
  },
  searchInput: {
    flex: 1,
    color: BLUE,
    fontSize: 14,
    paddingVertical: 15,
    minWidth: 0,
  },
  searchButton: {
    backgroundColor: GREEN,
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  categoryHeading: {
    color: BLUE,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  categoryCard: {
    width: '31.5%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 17,
    marginBottom: 10,
  },
  activeCategoryCard: {
    backgroundColor: '#E5EEE8',
    borderColor: GREEN,
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 7,
  },
  categoryLabel: {
    color: GREEN,
    fontWeight: 'bold',
    fontSize: 12,
  },
  infoBanner: {
    backgroundColor: '#E5EEE8',
    borderRadius: 14,
    padding: 17,
    marginBottom: 23,
  },
  infoTitle: {
    color: GREEN,
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 5,
  },
  infoText: {
    color: '#53685B',
    fontSize: 13,
    lineHeight: 19,
  },
  loader: {
    marginTop: 35,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    marginTop: 14,
  },
  welcomeIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  welcomeTitle: {
    color: BLUE,
    fontWeight: 'bold',
    fontSize: 19,
    textAlign: 'center',
    marginBottom: 9,
  },
  welcomeText: {
    color: '#777',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BLUE,
  },
  resultsCount: {
    color: '#777',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
    overflow: 'hidden',
  },
  imageFrame: {
    width: '100%',
    height: 150,
    backgroundColor: '#FFFFFF',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeImageFrame: {
    height: 260,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 30,
    marginBottom: 6,
  },
  placeholderText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  cardStatus: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    minHeight: 34,
    justifyContent: 'center',
  },
  cardStatusUnknown: { backgroundColor: '#F1F1EF' },
  cardStatusDanger: { backgroundColor: '#FFE2E2' },
  cardStatusCaution: { backgroundColor: '#FFF0CE' },
  cardStatusReview: { backgroundColor: '#E7EDF5' },
  cardStatusText: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardBrand: {
    color: '#68716D',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 5,
  },
  cardName: {
    color: BLUE,
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 19,
    minHeight: 57,
    marginBottom: 13,
  },
  checkButton: {
    backgroundColor: GREEN,
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  detailBrand: {
    color: '#777',
    fontSize: 14,
    marginTop: 15,
    marginBottom: 6,
  },
  detailTitle: {
    color: BLUE,
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  statusBox: {
    backgroundColor: '#FFF1DB',
    borderRadius: 13,
    padding: 16,
    marginTop: 22,
  },
  dangerBox: {
    backgroundColor: '#FFE3E3',
  },
  statusTitle: {
    color: BLUE,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusDescription: {
    color: '#5F6260',
    fontSize: 13,
    lineHeight: 20,
  },
  matchRow: {
    borderTopWidth: 1,
    borderTopColor: '#DADADA',
    marginTop: 12,
    paddingTop: 10,
  },
  matchText: {
    color: BLUE,
    fontWeight: 'bold',
    fontSize: 14,
  },
  matchSource: {
    color: '#777',
    fontSize: 12,
    marginTop: 3,
  },
  sectionTitle: {
    color: GREEN,
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 25,
    marginBottom: 9,
  },
  bodyText: {
    color: '#555',
    fontSize: 14,
    lineHeight: 22,
  },
  disclaimer: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 28,
  },
});