import { ingredientHighlights } from '../ui/ingredientHighlights';
import Disclosure from '../components/Disclosure';
import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import StockBadge from '../components/StockBadge';
import ProductPhoto from '../components/ProductPhoto';
import { productEvidence } from '../ui/productEvidence';
import { colors as c } from '../ui/theme';
import ProductDemoAvailability from '../components/ProductDemoAvailability';
import AllergyMatchList from '../components/AllergyMatchList';
import ProductCard from '../components/ProductCard';
import ProductAllergyStatus from '../components/ProductAllergyStatus';
import { useProductAssessments } from '../hooks/useProductAssessments';
import { DEMO_DISCLAIMER } from '../inventory/types';
import type { LocalStore } from '../services/localStoreService';
import type { LocalProductCategory, LocalProductDetails, LocalProductSummary } from '../services/localProductService';
import { localProducts } from '../services/localProducts';
import { checkLocalProductAllergies } from '../services/allergyChecker';
import type { LocalAllergyResult } from '../services/localAllergyMatching';
import { createLatestRequest } from '../services/latestRequest';

const GREEN = c.green;
const BLUE = c.blue;
const CREAM = c.cream;
const BORDER = c.border;

type Props = { userId: number; onBack: () => void; store?: LocalStore; isActive?: boolean; initialProductId?: string; initialCategoryId?: string };
export default function ProductSearchScreen({ userId, onBack, store, isActive = true, initialProductId, initialCategoryId }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 370 || fontScale > 1.25;
  const lastSearchOffset = useRef(0);
  const restoreSearchPosition = useRef(false);
  const [categories, setCategories] = useState<LocalProductCategory[]>([]);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<LocalProductSummary[]>([]);
  const assessments = useProductAssessments(userId, products, isActive);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialProductId ?? null);
  const [selected, setSelected] = useState<LocalProductDetails | null>(null);
  const [checking, setChecking] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<LocalAllergyResult | null>(null);
  const searchRequests = useRef(createLatestRequest());
  const detailRequests = useRef(createLatestRequest());
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let current = true;
    void localProducts.listCategories(store?.id).then(value => { if (current) setCategories(value); })
      .catch(() => { if (current) setSearchError('Could not load local categories.'); });
    return () => { current = false; };
  }, [store?.id]);

  useEffect(() => {
    const searches = searchRequests.current, details = detailRequests.current;
    return () => { searches.invalidate(); details.invalidate(); };
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
      const page = browse || !search ? await localProducts.browseProducts(category, options) : await localProducts.searchProducts(search, { ...options, categoryId: store ? category : null });
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

  const storeId = store?.id;
  const loadStoreOnOpen = useEffectEvent(() => {
    if (store) void handleSearch('', false, null, true);
    else void handleSearch('', false, initialCategoryId ?? null, true);
  });
  useEffect(() => { loadStoreOnOpen(); }, [storeId, initialCategoryId]);

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
    const requests = detailRequests.current;
    const request = requests.start();
    setSelected(null); setCheckResult(null); setDetailError(null);
    setChecking(selectedId !== null);
    if (selectedId === null || !isActive) return;
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
    return () => requests.invalidate();
  }, [selectedId, userId, isActive]);

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
    if (selectedId && selectedId === initialProductId && !hasSearched) { onBack(); return; }
    if (selectedId) { restoreSearchPosition.current = true; setSelectedId(null); setSelected(null); setCheckResult(null); setChecking(false); }
    else { searchRequests.current.invalidate(); onBack(); }
  }
  function renderProductImage(product: LocalProductSummary, large = false) {
    return <ProductPhoto key={`${product.id}-${large}`} productId={product.id} name={product.name} categoryId={product.categoryId} large={large} compact={large} />;
  }
  function renderAllergyStatus() {
    if (checking) return <View style={styles.statusBox}><ActivityIndicator color={GREEN} />
      <Text style={styles.statusDescription}>Checking your saved allergies...</Text></View>;
    if (detailError || !checkResult) return <View style={styles.statusBox}>
      <Text style={styles.statusTitle}>Unable to complete allergy check</Text>
      <Text style={styles.statusDescription}>{detailError ?? 'Allergy information unavailable.'} Check the physical packaging.</Text></View>;
    return <View style={styles.statusBox}>
      <ProductAllergyStatus result={checkResult} evidenceComplete={!!selectedEvidence?.allergensDocumented} detail />
      <AllergyMatchList result={checkResult} />
      <Text style={styles.packagingReminder}>Check current packaging before consuming.</Text>
    </View>;
  }

  const selectedEvidence = selected ? productEvidence(selected) : null;

  return <ScrollView ref={scroll} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    scrollEventThrottle={16} onScroll={event => { if (!selectedId && !restoreSearchPosition.current) lastSearchOffset.current = event.nativeEvent.contentOffset.y; }}>
    <TouchableOpacity style={styles.backButton} onPress={back} accessibilityRole="button" accessibilityLabel={selectedId === initialProductId && !hasSearched ? 'Back to home' : selectedId ? 'Back to search results' : store ? 'Back to selected store map' : 'Back to home'}>
      <Text style={styles.backText}>{selectedId === initialProductId && !hasSearched ? '← Home' : selectedId ? '← Search Results' : store ? '← Nearby Stores' : '← Home'}</Text>
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
        <View style={[styles.productHeader, singleColumn && { flexDirection: 'column' }]}><View style={singleColumn ? { width: '100%' } : styles.detailPhoto}>{renderProductImage(selected, true)}</View>
        <View style={styles.detailIdentity}>
        <Text style={styles.categoryTag}>{selected.categoryName ?? 'Grocery product'}</Text>
        <Text style={styles.detailBrand}>{selected.brand}</Text>
        <Text style={styles.detailTitle}>{selected.name}</Text>
        <Text style={styles.bodyText}>{[selected.variant !== selected.name ? selected.variant : null, selected.provenance.packageSize].filter(Boolean).join(' • ')}</Text>
        {store && <StockBadge status={products.find(product => product.id === selected.id)?.simulatedAvailability ?? null} />}
        </View>
        </View>
        {renderAllergyStatus()}
        <View style={styles.visibleLabelSection}>
          <Text accessibilityRole="header" style={styles.visibleLabelTitle}>Ingredients</Text>
          <Text selectable testID="full-product-ingredients" style={styles.bodyText}>{selected.ingredients.labelText ? ingredientHighlights(selected.ingredients.labelText, checkResult?.matches ?? []).map((part, index) => <Text key={index} style={part.highlighted ? { fontWeight: '700', textDecorationLine: 'underline' } : undefined}>{part.text}</Text>) : 'Ingredient label unavailable.'}</Text>
        </View>
        <View style={styles.visibleLabelSection}>
          <Text accessibilityRole="header" style={styles.visibleLabelTitle}>Manufacturer-declared allergens</Text>
          <Text selectable testID="product-declared-allergens" style={styles.bodyText}>{selected.allergens.declared.statement ?? 'Unknown — no verified declaration recorded.'}</Text>
        </View>
        <View style={styles.visibleLabelSection}>
          <Text accessibilityRole="header" style={styles.visibleLabelTitle}>Precautionary statements</Text>
          <Text selectable testID="product-precautionary-statements" style={styles.bodyText}>{selected.allergens.precautionary.statement ?? 'Unknown — no verified precautionary statement recorded.'}</Text>
        </View>
        <Disclosure key={`${selected.id}-sources`} title="Sources and review dates">
        <Text style={styles.evidenceText}>{selectedEvidence?.ingredientLabel} · {selectedEvidence?.allergenLabel}</Text>
        <Text style={styles.evidenceText}>{selected.ingredients.verifiedAt ? `Ingredient label reviewed: ${selected.ingredients.verifiedAt}` : 'Ingredient review date unknown'}</Text>
        {selected.provenance.sources.map(source => <View key={source.id} style={styles.matchRow}>
          <Text selectable style={styles.bodyText}>{source.url}</Text>
          <Text style={styles.matchSource}>Source checked {source.checkedAt}{source.reviewStatus !== 'label_reviewed' ? ' • Label not verified' : ''}</Text>
        </View>)}
        </Disclosure>
        {!store && <ProductDemoAvailability key={selected.id} productId={selected.id} />}
      </View>}
    </> : <>
      <Text style={[styles.title, store && { fontSize: 28 }]}>{store ? 'Store Inventory' : 'Shop Products'}</Text>
      {categories.length > 0 && <Text style={styles.catalogMeta}>{categories.reduce((sum, category) => sum + category.productCount, 0)} products · {categories.length} categories · {store ? 'Demo inventory' : 'On your device'}</Text>}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput testID="product-search-input" accessibilityLabel="Search groceries or brands" style={styles.searchInput}
          placeholder="Search groceries or brands" placeholderTextColor={c.muted} value={query}
          onChangeText={value => { searchRequests.current.invalidate(); setQuery(value); if (!store) setActiveCategory(null); setProducts([]); setHasMore(false); setHasSearched(false); setSearchError(null); setLoading(false); }}
          maxLength={300} returnKeyType="search" onSubmitEditing={() => void handleSearch()} autoCorrect={false} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search local products" style={styles.searchButton} onPress={() => void handleSearch()} disabled={loading}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="All categories" style={styles.categoryChip} onPress={() => { setQuery(''); void handleSearch('', false, null, true); }}><Text>All</Text></TouchableOpacity>
        {categories.map(category => <TouchableOpacity key={category.id} accessibilityRole="button" accessibilityLabel={`Browse ${category.name}`} accessibilityState={{ selected: activeCategory === category.id }} style={[styles.categoryChip, activeCategory === category.id && styles.activeCategoryCard]} onPress={() => { setQuery(''); void handleSearch('', false, category.id, true); }}><Text style={{ color: BLUE }}>{category.name}</Text></TouchableOpacity>)}
      </ScrollView>
      {loading && <View style={styles.loadingState} accessibilityLiveRegion="polite"><ActivityIndicator color={GREEN} /><Text style={styles.bodyText}>Finding your products…</Text></View>}
      {searchError && <View style={styles.statusBox}><Text style={styles.statusTitle}>Products couldn’t load</Text><Text style={styles.bodyText}>Please try again. You can also return to browsing categories.</Text><TouchableOpacity style={styles.checkButton} accessibilityRole="button" accessibilityLabel="Retry product search" onPress={() => void handleSearch(submittedQuery, false, activeCategory, !submittedQuery)}><Text style={styles.checkButtonText}>Try again</Text></TouchableOpacity></View>}
      {hasSearched && <>
        <View style={styles.resultsHeader}><Text style={styles.resultsTitle}>{activeCategory ? categories.find(item => item.id === activeCategory)?.name : submittedQuery ? 'Search Results' : store ? 'Demo Products' : 'All Products'}</Text><Text style={styles.resultsCount}>{products.length} {products.length === 1 ? 'product' : 'products'}{hasMore ? ' shown' : ''}</Text></View>
        {products.length === 0 ? <View style={styles.welcomeCard}><Text style={styles.welcomeTitle}>No products found</Text><Text style={styles.welcomeText}>{store ? 'No demo products match this search and category at this store. Clear filters or try another name or brand.' : activeCategory ? 'This category has no products yet. Browse another category or search all products.' : 'Try another product name or brand. The offline catalog is still growing.'}</Text></View>
          : <View style={styles.grid}>{products.map(product => <View key={product.id} style={[{ width: '48%' }, singleColumn && styles.fullWidth]}>
            <ProductCard product={product} result={assessments[product.id]} inventory={!!store} onPress={() => openProduct(product)} />
          </View>)}</View>}

        {hasMore && <TouchableOpacity style={styles.checkButton} disabled={loading} accessibilityRole="button" onPress={() => void handleSearch(submittedQuery, true, activeCategory, !submittedQuery)}><Text style={styles.checkButtonText}>Load more products</Text></TouchableOpacity>}
      </>}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  packagingReminder: { color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  visibleLabelSection: { paddingVertical: 18, borderBottomWidth: 1, borderColor: BORDER, gap: 8 },
  visibleLabelTitle: { color: BLUE, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  fullWidth: { width: '100%' },
  catalogMeta: { color: GREEN, fontSize: 12, fontWeight: '600', lineHeight: 18, marginBottom: 10 },
  categoryIconTile: { width: 48, height: 48, backgroundColor: '#EAF1E9', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoryCount: { color: '#53645F', fontSize: 12, lineHeight: 18, marginTop: 5 },
  cardCategory: { color: GREEN, fontSize: 10, fontWeight: '700', lineHeight: 15, marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardVariant: { color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  recordedLabel: { color: c.muted },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }, detailPhoto: { width: '42%' },
  detailIdentity: { flex: 1, minWidth: 0 },
  categoryTag: { color: c.muted, fontSize: 12, fontWeight: '600', paddingVertical: 6 },
  evidenceGrid: { marginTop: 20, gap: 10 },
  evidencePanel: { backgroundColor: 'transparent', borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 14, gap: 5 },
  evidenceWarning: { backgroundColor: c.softAmber, borderColor: '#E4C994' },
  evidenceEyebrow: { color: c.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1, lineHeight: 16 },
  evidenceTitle: { color: BLUE, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  evidenceText: { color: '#3D4E46', fontSize: 13, lineHeight: 20 },
  labelPanel: { marginTop: 18, backgroundColor: '#F7F8F4', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: BORDER },
  panelTitle: { color: GREEN, fontSize: 17, lineHeight: 24, fontWeight: '700', marginBottom: 9 },
  photoCreditHint: { color: c.muted, fontSize: 11, lineHeight: 17, marginTop: 18 },
  incompleteLabel: { color: '#704018', fontSize: 12, lineHeight: 18, paddingVertical: 4, marginBottom: 8 },
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
    width: '48.5%', alignItems: 'flex-start', justifyContent: 'center', backgroundColor: 'transparent', borderBottomWidth: 1, borderColor: BORDER, borderRadius: 0, padding: 12, minHeight: 112, marginBottom: 12,
  },
  activeCategoryCard: {
    backgroundColor: '#E5EEE8',
    borderColor: GREEN,
  },
  categoryIcon: {
    fontSize: 26,
  },
  categoryLabel: {
    color: BLUE, fontWeight: '700', fontSize: 14, lineHeight: 20,
  },
  infoBanner: {
    paddingVertical: 16, marginBottom: 20, borderBottomWidth: 1, borderColor: BORDER,
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
    width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 18, overflow: 'hidden',
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
  cardStatusCaution: { backgroundColor: 'transparent' },
  cardStatusReview: { backgroundColor: 'transparent' },
  cardStatusText: {
    color: BLUE, fontSize: 11, lineHeight: 17, fontWeight: '600', textAlign: 'left',
  },
  cardContent: {
    padding: 12, flex: 1, justifyContent: 'flex-start',
  },
  cardBrand: {
    color: '#53645F', fontSize: 12, fontWeight: '700', marginBottom: 6,
  },
  cardName: {
    color: BLUE, fontSize: 16, fontWeight: '700', lineHeight: 23, marginBottom: 10,
  },
  checkButton: {
    backgroundColor: GREEN, borderRadius: 11, minHeight: 44, paddingVertical: 12, paddingHorizontal: 10, marginTop: 6, alignItems: 'center', justifyContent: 'center',
  },
  checkButtonText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center',
  },
  detailCard: {
    backgroundColor: 'transparent', paddingVertical: 12,
  },
  detailBrand: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 6,
  },
  detailTitle: {
    color: BLUE,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 27,
  },
  statusBox: {
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 18, marginTop: 18, gap: 8,
  },
  dangerBox: {
    borderTopColor: c.red, borderTopWidth: 2,
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
