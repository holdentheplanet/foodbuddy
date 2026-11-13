import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import StockBadge from '../components/StockBadge';
import { colors as c } from '../ui/theme';
import ProductDemoAvailability from '../components/ProductDemoAvailability';
import { DEMO_DISCLAIMER, demoStatusLabel } from '../inventory/types';
import type { LocalStore } from '../services/localStoreService';
import { GROCERY_CATEGORIES } from '../catalog/categories';
import type { LocalProductCategory, LocalProductDetails, LocalProductSummary } from '../services/localProductService';
import { localProducts } from '../services/localProducts';
import { checkLocalProductAllergies } from '../services/allergyChecker';
import type { LocalAllergyResult } from '../services/localAllergyMatching';
import { createLatestRequest } from '../services/latestRequest';

const GREEN = c.green;
const BLUE = c.blue;
const CREAM = c.cream;
const BORDER = c.border;

type Props = { userId: number; onBack: () => void; store?: LocalStore };
export default function ProductSearchScreen({ userId, onBack, store }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 370 || fontScale > 1.25;
  const lastSearchOffset = useRef(0);
  const restoreSearchPosition = useRef(false);
  const [categories, setCategories] = useState<LocalProductCategory[]>([]);
  useEffect(() => {
    let current = true;
    void localProducts.listCategories(store?.id).then(value => { if (current) setCategories(value); })
      .catch(() => { if (current) setSearchError('Could not load local categories.'); });
    return () => { current = false; };
  }, [store?.id]);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<LocalProductSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<LocalProductDetails | null>(null);
  const [checking, setChecking] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<LocalAllergyResult | null>(null);
  const searchRequests = useRef(createLatestRequest());
  const detailRequests = useRef(createLatestRequest());
  const scroll = useRef<ScrollView>(null);

  useEffect(() => () => {
    searchRequests.current.invalidate();
    detailRequests.current.invalidate();
  }, []);

  async function handleSearch(term = query, append = false, category: string | null = store ? activeCategory : null, browse = false) {
    Keyboard.dismiss();
    const request = searchRequests.current.start();
    const search = term.trim();
    if (!append) setActiveCategory(browse ? category : null);
    setSearchError(null);
    setLoading(true);
    if (!append) { setProducts([]); setHasMore(false); setHasSearched(false); setSubmittedQuery(search); }
    try {
      const options = { limit: 24, offset: append ? products.length : 0, storeId: store?.id };
      const page = browse || (store && !search) ? await localProducts.browseProducts(category, options) : await localProducts.searchProducts(search, { ...options, categoryId: store ? category : null });
      if (!searchRequests.current.isCurrent(request)) return;
      setProducts(previous => append ? [...previous, ...page.products] : page.products);
      setHasMore(page.hasMore);
      setHasSearched(true);
      if (!append) scroll.current?.scrollTo({ y: 0, animated: false });
    } catch (error) {
      if (searchRequests.current.isCurrent(request)) {
        setSearchError(error instanceof Error ? error.message : 'Could not read the local catalog.');
      }
    } finally {
      if (searchRequests.current.isCurrent(request)) setLoading(false);
    }
  }

  useEffect(() => { if (store) void handleSearch('', false, null, true); }, [store?.id]);

  useEffect(() => {
    if (selectedId === null && restoreSearchPosition.current) {
      const frame = requestAnimationFrame(() => {
        scroll.current?.scrollTo({ y: lastSearchOffset.current, animated: false });
        restoreSearchPosition.current = false;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [selectedId]);

  // One effect owns details + its allergy check. No checks in click handlers or cards.
  useEffect(() => {
    const request = detailRequests.current.start();
    setSelected(null); setCheckResult(null); setDetailError(null);
    setChecking(selectedId !== null);
    if (selectedId === null) return;
    async function load() {
      try {
        const product = await localProducts.getProductById(selectedId!);
        if (!detailRequests.current.isCurrent(request)) return;
        if (!product) throw new Error('This product is no longer in the local catalog.');
        setSelected(product);
        const result = await checkLocalProductAllergies(userId, product);
        if (detailRequests.current.isCurrent(request)) setCheckResult(result);
      } catch (error) {
        if (detailRequests.current.isCurrent(request)) {
          setDetailError(error instanceof Error ? error.message : 'Could not complete the local allergy check.');
        }
      } finally {
        if (detailRequests.current.isCurrent(request)) setChecking(false);
      }
    }
    void load();
    return () => detailRequests.current.invalidate();
  }, [selectedId, userId]);

  function openProduct(product: LocalProductSummary) {
    Keyboard.dismiss();
    restoreSearchPosition.current = false;
    detailRequests.current.invalidate();
    setSelected(null); setCheckResult(null); setDetailError(null); setChecking(true);
    setSelectedId(product.id);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function back() {
    detailRequests.current.invalidate();
    if (selectedId) { restoreSearchPosition.current = true; setSelectedId(null); setSelected(null); setCheckResult(null); setChecking(false); }
    else { searchRequests.current.invalidate(); onBack(); }
  }
  function renderProductImage(product: LocalProductSummary, large = false) {
    // Catalog images currently have no bundled files. Never fetch a remote image in this offline flow.
    const image = product.imageReference && /^(file:|content:|data:)/.test(product.imageReference) ? product.imageReference : null;
    return <View style={[styles.imageFrame, large && styles.largeImageFrame]}>
      {image ? <Image source={{ uri: image }} style={styles.productImage} resizeMode="contain" /> :
        <View style={styles.placeholder}><Text maxFontSizeMultiplier={1.2} style={styles.placeholderIcon}>🛒</Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.placeholderText}>No product photo</Text></View>}
    </View>;
  }
  function renderAllergyStatus() {
    if (checking) return <View style={styles.statusBox}><ActivityIndicator color={GREEN} />
      <Text style={styles.statusDescription}>Checking your saved allergies...</Text></View>;
    if (detailError || !checkResult) return <View style={styles.statusBox}>
      <Text style={styles.statusTitle}>Unable to complete allergy check</Text>
      <Text style={styles.statusDescription}>{detailError ?? 'Allergy information unavailable.'} Check the physical packaging.</Text></View>;
    const result = checkResult;
    const declaredMatch = result.matches.some(match => match.kind === 'declared' && match.source === 'allergens');
    const title = result.savedAllergyCount === 0 ? 'No saved allergies'
      : result.status === 'conflict' ? declaredMatch ? 'Declared allergen match' : 'Ingredient match'
      : result.status === 'caution' ? 'Precautionary / potential allergy concern'
      : result.status === 'unknown' ? 'Information incomplete or unverified' : 'No known matches in available data';
    const description = result.savedAllergyCount === 0 ? 'Add allergies to your profile for personalized ingredient checks.'
      : result.status === 'conflict' ? 'Your saved allergy appears in the available ingredients or manufacturer declaration.'
      : result.status === 'caution' ? 'Review possible cross-contact or related ingredient matches. Derivative mappings are incomplete and unverified.'
      : result.status === 'unknown' ? 'The available information cannot support a complete allergy check.'
      : 'This does not guarantee safety. Missing warnings do not establish absence of cross-contact.';
    return <View style={[styles.statusBox, result.status === 'conflict' && styles.dangerBox]}>
      <Text style={styles.statusTitle}>{title}</Text><Text style={styles.statusDescription}>{description}</Text>
      {result.matches.map((match, index) => <View key={`${match.allergen}-${match.source}-${index}`} style={styles.matchRow}>
        <Text style={styles.matchText}>{match.allergen}: {match.matchedIngredient}</Text>
        <Text style={styles.matchSource}>{match.source === 'traces' ? 'Precautionary warning' : match.kind === 'possible_derivative' ? 'Possible related ingredient — unverified mapping' : `Found in ${match.source}`}</Text>
      </View>)}
      {result.informationIncomplete && <Text style={[styles.statusDescription, { marginTop: 12 }]}>
        Information incomplete: {result.missingInformation.join(' ')}
      </Text>}
    </View>;
  }

  return <ScrollView ref={scroll} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    scrollEventThrottle={16} onScroll={event => { if (!selectedId && !restoreSearchPosition.current) lastSearchOffset.current = event.nativeEvent.contentOffset.y; }}>
    <TouchableOpacity style={styles.backButton} onPress={back} accessibilityRole="button" accessibilityLabel={selectedId ? 'Back to search results' : store ? 'Back to selected store map' : 'Back to home'}>
      <Text style={styles.backText}>{selectedId ? '← Search Results' : store ? '← Nearby Stores' : '← Home'}</Text>
    </TouchableOpacity>
    {store && <View style={styles.infoBanner}>
      <Text style={styles.infoTitle}>{store.name}</Text>
      <Text style={styles.infoText}>{store.streetAddress}, {store.city}, {store.state} {store.zipCode}</Text>
      <Text style={[styles.infoText, { fontWeight: 'bold', marginTop: 6 }]}>{DEMO_DISCLAIMER}</Text>
    </View>}
    {selectedId ? <>
      {!selected && checking && <ActivityIndicator size="large" color={GREEN} style={styles.loader} />}
      {!selected && !checking && <View style={styles.statusBox}><Text style={styles.statusTitle}>Product details unavailable</Text><Text style={styles.bodyText}>{detailError}</Text></View>}
      {selected && <View style={styles.detailCard}>
        {renderProductImage(selected, true)}
        <Text style={styles.detailBrand}>{selected.brand}</Text>
        <Text style={styles.detailTitle}>{selected.name}</Text>
        <Text style={styles.bodyText}>{selected.variant}{selected.provenance.packageSize ? ` • ${selected.provenance.packageSize}` : ''}</Text>
        {store && <StockBadge status={products.find(product => product.id === selected.id)?.simulatedAvailability ?? null} />}
        <Text style={styles.sectionTitle}>Ingredient verification</Text>
        <Text style={styles.bodyText}>{selected.ingredients.verificationStatus === 'verified' ? 'Ingredient text verified from recorded source' : selected.ingredients.verificationStatus === 'unverified' ? 'Ingredient information unverified' : 'Ingredient verification unknown'}{selected.ingredients.verifiedAt ? ` • Reviewed ${selected.ingredients.verifiedAt}` : ''}</Text>
        {renderAllergyStatus()}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <Text selectable style={styles.bodyText}>{selected.ingredients.labelText ?? 'Ingredient label unavailable. Product information is incomplete; check the physical package.'}</Text>
        <Text style={styles.sectionTitle}>Manufacturer-declared allergens</Text>
        <Text selectable style={styles.bodyText}>{selected.allergens.declared.statement ?? 'Allergen declaration unknown. Missing information does not mean allergens are absent.'}</Text>
        <Text style={styles.sectionTitle}>Precautionary warnings / May contain</Text>
        <Text selectable style={styles.bodyText}>{selected.allergens.precautionary.statement ?? 'Precautionary warning unknown. Cross-contact information is incomplete.'}</Text>
        <Text style={styles.sectionTitle}>Sources and review dates</Text>
        {selected.provenance.sources.map(source => <View key={source.id} style={styles.matchRow}>
          <Text selectable style={styles.bodyText}>{source.url}</Text>
          <Text style={styles.matchSource}>Source checked {source.checkedAt}{source.reviewStatus !== 'label_reviewed' ? ' • Label not verified' : ''}</Text>
        </View>)}
        {!store && <ProductDemoAvailability key={selected.id} productId={selected.id} />}
      </View>}
    </> : <>
      <Text style={[styles.title, store && { fontSize: 28 }]}>{store ? 'Store Inventory' : 'Shop Products'}</Text>
      <Text style={styles.subtitle}>{store ? 'Search this store’s demo products by name or brand.' : 'Find products by name or brand. Browse everything, no store needed.'}</Text>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput testID="product-search-input" accessibilityLabel="Search groceries or brands" style={styles.searchInput}
          placeholder="Search groceries or brands" placeholderTextColor="#929A95" value={query}
          onChangeText={value => { searchRequests.current.invalidate(); setQuery(value); if (!store) setActiveCategory(null); setProducts([]); setHasMore(false); setHasSearched(false); setSearchError(null); setLoading(false); }}
          maxLength={300} returnKeyType="search" onSubmitEditing={() => void handleSearch()} autoCorrect={false} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search local products" style={styles.searchButton} onPress={() => void handleSearch()} disabled={loading}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      {!hasSearched && <Text style={styles.categoryHeading}>Browse categories</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Browse all products" onPress={() => { setQuery(''); void handleSearch('', false, null, true); }}>
        <Text style={styles.backText}>{store ? 'All inventory / Clear filters' : 'Browse all products'}</Text>
      </TouchableOpacity>
      {store && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        {categories.map(category => <TouchableOpacity key={category.id} accessibilityRole="button"
          accessibilityLabel={`Filter inventory ${category.name}`} accessibilityState={{ selected: activeCategory === category.id }}
          style={[styles.categoryChip, activeCategory === category.id && styles.activeCategoryCard]}
          onPress={() => void handleSearch(query, false, category.id, !query.trim())}>
          <Text style={{ color: BLUE, fontWeight: 'bold' }}>{category.name} ({category.productCount})</Text>
        </TouchableOpacity>)}
      </ScrollView>}
      {!store && !hasSearched && <View style={styles.categoryGrid}>{categories.map(category => <TouchableOpacity key={category.id}
        style={[styles.categoryCard, singleColumn && styles.fullWidth, activeCategory === category.id && styles.activeCategoryCard]}
        onPress={() => { setQuery(''); void handleSearch('', false, category.id, true); }}
        accessibilityRole="button" accessibilityLabel={`Browse ${category.name}`}>
        <Text style={styles.categoryIcon}>{GROCERY_CATEGORIES.find(item => item.id === category.id)?.icon}</Text>
        <Text style={styles.categoryLabel}>{category.name}</Text>
        <Text style={styles.matchSource}>{category.productCount === 0 ? 'No products yet' : `${category.productCount} products`}</Text>
      </TouchableOpacity>)}</View>}
      {!store && hasSearched && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Return to categories" onPress={() => {
        searchRequests.current.invalidate(); setActiveCategory(null); setQuery(''); setProducts([]); setHasSearched(false); setHasMore(false); setLoading(false); setSearchError(null);
        scroll.current?.scrollTo({ y: 0, animated: true });
      }}><Text style={styles.backText}>↑ Return to categories</Text></TouchableOpacity>}
      {!store && <View style={styles.infoBanner}><Text style={styles.infoTitle}>Your personalized grocery guide</Text>
        <Text style={styles.infoText}>Open a product to compare its available label with your saved allergy profile. Stock labels are demo data only.</Text></View>}
      {loading && <View style={styles.loadingState} accessibilityLiveRegion="polite"><ActivityIndicator color={GREEN} /><Text style={styles.bodyText}>Finding your products…</Text></View>}
      {searchError && <View style={styles.statusBox}><Text style={styles.statusTitle}>Products couldn’t load</Text><Text style={styles.bodyText}>Please try again. You can also return to browsing categories.</Text><TouchableOpacity style={styles.checkButton} accessibilityRole="button" accessibilityLabel="Retry product search" onPress={() => void handleSearch(submittedQuery, false, activeCategory, !submittedQuery)}><Text style={styles.checkButtonText}>Try again</Text></TouchableOpacity></View>}
      {!loading && !hasSearched && !searchError && <View style={styles.welcomeCard}>
        <Text style={styles.welcomeIcon}>🛍️</Text><Text style={styles.welcomeTitle}>What are you shopping for?</Text>
        <Text style={styles.welcomeText}>Try Oreo, Goldfish, Cheerios, or a grocery brand.</Text></View>}
      {hasSearched && <>
        <View style={styles.resultsHeader}><Text style={styles.resultsTitle}>{activeCategory ? categories.find(item => item.id === activeCategory)?.name : submittedQuery ? 'Search Results' : store ? 'Demo Products' : 'All Products'}</Text><Text style={styles.resultsCount}>{products.length} products{hasMore ? ' shown' : ''}</Text></View>
        {products.length === 0 ? <View style={styles.welcomeCard}><Text style={styles.welcomeTitle}>No products found</Text><Text style={styles.welcomeText}>{store ? 'No demo products match this search and category at this store. Clear filters or try another name or brand.' : activeCategory ? 'This category has no products yet. Browse another category or search all products.' : 'Try another product name or brand. The offline catalog is still growing.'}</Text></View>
          : <View style={styles.grid}>{products.map(product => <TouchableOpacity key={product.id} testID={`product-${product.id}`}
            accessibilityRole="button" accessibilityLabel={`View ${product.name}`} accessibilityValue={{ text: `${product.ingredientVerificationStatus === 'verified' ? 'Ingredient text verified' : 'Ingredient information unverified'}. ${product.completenessStatus !== 'complete' ? 'Product information incomplete.' : ''} ${store ? demoStatusLabel(product.simulatedAvailability) : ''}` }}
            accessibilityHint="Opens the product label and your saved allergy check."
            style={[styles.productCard, singleColumn && styles.fullWidth]} onPress={() => openProduct(product)} activeOpacity={0.8}>
            {renderProductImage(product)}<View style={styles.cardContent}><Text style={styles.cardBrand} numberOfLines={1}>{product.brand}</Text>
              <Text style={styles.cardName}>{product.name}</Text>
              <View style={[styles.cardStatus, product.ingredientVerificationStatus === 'verified' ? styles.cardStatusReview : styles.cardStatusCaution]}><Text style={styles.cardStatusText}>{product.ingredientVerificationStatus === 'verified' ? 'Ingredient text verified' : product.ingredientVerificationStatus === 'unverified' ? '⚠️ Ingredient info unverified' : '⚠️ Ingredient verification unknown'}</Text></View>
              {store && <StockBadge status={product.simulatedAvailability} />}
              {product.completenessStatus !== 'complete' && <Text style={styles.incompleteLabel}>⚠️ Product information incomplete</Text>}
              <View style={styles.checkButton}><Text style={styles.checkButtonText}>View label →</Text></View>
            </View>
          </TouchableOpacity>)}</View>}
        {hasMore && <TouchableOpacity style={styles.checkButton} disabled={loading} accessibilityRole="button" onPress={() => void handleSearch(submittedQuery, true, activeCategory, !submittedQuery)}><Text style={styles.checkButtonText}>Load more products</Text></TouchableOpacity>}
      </>}
    </>}
    <Text style={styles.disclaimer}>Product label information is stored on this device. Allergy checks are preliminary and may miss allergens or cross-contact. Always check the physical product packaging and current allergen warnings before consuming.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  incompleteLabel: { color: '#704018', fontSize: 12, lineHeight: 18, backgroundColor: '#FFF1D6', padding: 8, borderRadius: 8, marginBottom: 8 },
  loadingState: { paddingVertical: 24, alignItems: 'center', gap: 10 },
  categoryChip: { padding: 12, marginRight: 8, borderRadius: 12, backgroundColor: 'white', minHeight: 46, borderWidth: 1, borderColor: BORDER },
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  content: {
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 32, maxWidth: 760, width: '100%', alignSelf: 'center',
  },
  backButton: {
    minHeight: 44, paddingVertical: 12, alignSelf: 'flex-start', marginBottom: 8,
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
    width: '48.5%', alignItems: 'flex-start', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 16, minHeight: 120, marginBottom: 12,
  },
  activeCategoryCard: {
    backgroundColor: '#E5EEE8',
    borderColor: GREEN,
  },
  categoryIcon: {
    fontSize: 27, marginBottom: 12,
  },
  categoryLabel: {
    color: BLUE, fontWeight: '700', fontSize: 14, lineHeight: 20,
  },
  infoBanner: {
    backgroundColor: '#EAF1E9', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#D7E4D8',
  },
  infoTitle: {
    color: GREEN,
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 5,
  },
  infoText: {
    color: '#354F40', fontSize: 13, lineHeight: 20,
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
    color: '#53645F', fontSize: 14, textAlign: 'center', lineHeight: 22,
  },
  resultsHeader: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14,
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
    width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: BORDER, marginBottom: 14, overflow: 'hidden',
  },
  imageFrame: {
    width: '100%', height: 82, backgroundColor: '#F0F4EF', padding: 12, alignItems: 'center', justifyContent: 'center',
  },
  largeImageFrame: {
    height: 115, borderRadius: 14,
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
    fontSize: 11, color: '#53645F', textAlign: 'center',
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
    color: BLUE, fontSize: 11, lineHeight: 17, fontWeight: '600', textAlign: 'left',
  },
  cardContent: {
    padding: 12, flex: 1, justifyContent: 'flex-start',
  },
  cardBrand: {
    color: '#53645F', fontSize: 12, fontWeight: '600', marginBottom: 5,
  },
  cardName: {
    color: BLUE, fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 12,
  },
  checkButton: {
    backgroundColor: GREEN, borderRadius: 11, minHeight: 44, paddingVertical: 12, paddingHorizontal: 10, marginTop: 6, alignItems: 'center', justifyContent: 'center',
  },
  checkButtonText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: BORDER,
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
    backgroundColor: '#FFF1D6', borderRadius: 14, borderWidth: 1, borderColor: '#E4C994', padding: 16, marginTop: 20, gap: 4,
  },
  dangerBox: {
    backgroundColor: '#FCE8E9', borderColor: '#D997A0', borderLeftWidth: 4,
  },
  statusTitle: {
    color: BLUE,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusDescription: {
    color: '#3E4D46', fontSize: 14, lineHeight: 22,
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
    color: '#53645F', fontSize: 12, lineHeight: 18, marginTop: 3,
  },
  sectionTitle: {
    color: GREEN,
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 25,
    marginBottom: 9,
  },
  bodyText: {
    color: '#3D4E46', fontSize: 15, lineHeight: 24,
  },
  disclaimer: {
    color: '#53645F', backgroundColor: '#FFF1D6', padding: 16, borderRadius: 12, fontSize: 12, textAlign: 'left', lineHeight: 19, marginTop: 24,
  },
});