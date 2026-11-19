import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import ProductCard from '../components/ProductCard';
import { useProductAssessments } from '../hooks/useProductAssessments';
import { localProducts } from '../services/localProducts';
import type { LocalProductCategory, LocalProductSummary } from '../services/localProductService';
import CategoryArtwork from '../components/CategoryArtwork';
import { colors as c } from '../ui/theme';

export type HomeShopDestination = { productId?: string; categoryId?: string };
type Props = { userId: number; username: string; onProducts: (destination?: HomeShopDestination) => void; onStores: () => void; onAllergies: () => void };
// A small, stable discovery selection; every displayed field comes from SQLite.
const discoveryIds = ['batch05-dave-100-whole-wheat', 'batch07-dave-21wgs-burger-buns', 'batch07-dave-21wgs-sandwich-rolls', 'batch04-dole-5050-blend', 'batch01-hershey-almond-joy-coconut-and-almond-chocolate-candy-bar-1-61-oz', 'barilla-spaghetti', 'batch07-stubbs-sticky-sweet-barbecue-sauce-18-oz', 'batch07-cheerios-chocolate-cheerios', 'batch07-cheerios-frosted-cheerios', 'batch01-hershey-kit-kat-milk-chocolate-candy-bar-1-5-oz'];
export default function HomeScreen({ userId, username, onProducts, onStores, onAllergies }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const narrow = width < 360 || fontScale > 1.25;
  const [products, setProducts] = useState<LocalProductSummary[]>([]);
  const assessments = useProductAssessments(userId, products);
  const [categories, setCategories] = useState<LocalProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void Promise.all([localProducts.listCategories(), Promise.all(discoveryIds.map(id => localProducts.getProductById(id)))])
      .then(([groups, items]) => { if (alive) { setCategories(groups.filter(group => group.productCount > 0).slice(0, 4)); setProducts(items.filter(item => item !== null)); } })
      .catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [retry]);
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View><Text style={styles.brand}>FoodBuddy 🌿</Text><Text style={styles.greeting}>Hi, {username}.</Text></View></View>
    <TouchableOpacity style={styles.search} accessibilityRole="button" accessibilityLabel="Search all products" onPress={() => onProducts()}>
      <Text style={styles.searchIcon}>⌕</Text><Text style={styles.searchText}>Search products or brands</Text><Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
    <View style={styles.sectionHeading}><Text style={styles.section}>Browse categories</Text><TouchableOpacity style={styles.linkButton} accessibilityRole="button" accessibilityLabel="View all categories" onPress={() => onProducts()}><Text style={styles.link}>See all →</Text></TouchableOpacity></View>
    <View style={styles.categories}>{categories.map(category => <TouchableOpacity key={category.id} style={[styles.category, narrow && { width: '47%' }]} accessibilityRole="button" accessibilityLabel={`Explore ${category.name}`} onPress={() => onProducts({ categoryId: category.id })}>
      <View style={[styles.categoryIcon, { overflow: 'hidden' }]}><CategoryArtwork categoryId={category.id} caption={false} /></View><Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>)}</View>
    <View style={styles.sectionHeading}><Text style={styles.section}>Explore products</Text><TouchableOpacity style={styles.linkButton} accessibilityRole="button" onPress={() => onProducts()}><Text style={styles.link}>See all →</Text></TouchableOpacity></View>
    {loading && <ActivityIndicator accessibilityLabel="Loading product discovery" color={c.green} />}
    {error && <TouchableOpacity accessibilityRole="button" style={styles.linkButton} onPress={() => { setError(false); setLoading(true); setRetry(value => value + 1); }}><Text style={styles.link}>Couldn’t load discovery. Tap to retry.</Text></TouchableOpacity>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      {products.map(product => <View key={product.id} style={{ width: 166 }}><ProductCard product={product} result={assessments[product.id]} onPress={() => onProducts({ productId: product.id })} /></View>)}
    </ScrollView>
    <View style={[styles.shortcuts, narrow && { flexDirection: 'column' }]}>
      <TouchableOpacity style={styles.shortcut} accessibilityRole="button" accessibilityLabel="Open Nearby Stores" onPress={onStores}><Text style={styles.shortcutIcon}>⌖</Text><View style={{ flex: 1 }}><Text style={styles.shortcutTitle}>Stores</Text><Text style={styles.small}>Find your next stop</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>
      <TouchableOpacity style={styles.shortcut} accessibilityRole="button" accessibilityLabel="Open saved allergy profile" onPress={onAllergies}><Text style={styles.shortcutIcon}>♡</Text><View style={{ flex: 1 }}><Text style={styles.shortcutTitle}>Your allergies</Text><Text style={styles.small}>View your profile</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 28, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  brand: { color: c.green, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 }, greeting: { color: c.muted, fontSize: 15, marginTop: 5 }, headerNote: { color: c.muted, fontSize: 11, maxWidth: 95, textAlign: 'right', lineHeight: 17 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, minHeight: 56 }, searchIcon: { color: c.green, fontSize: 25 }, searchText: { flex: 1, color: c.muted, fontSize: 15 }, arrow: { color: c.green, fontSize: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, section: { color: c.blue, fontSize: 18, fontWeight: '700' }, linkButton: { minHeight: 44, justifyContent: 'center' }, link: { color: c.green, fontWeight: '600', fontSize: 13 }, small: { color: c.muted, fontSize: 12, lineHeight: 18 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, category: { width: '22%', alignItems: 'center', gap: 8, paddingVertical: 4 }, categoryIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: c.softGreen, alignItems: 'center', justifyContent: 'center' }, categoryName: { color: c.blue, fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
  productRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, product: { width: '48%', borderRadius: 16, backgroundColor: c.white, overflow: 'hidden' }, productText: { padding: 12, gap: 4 }, productName: { color: c.blue, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 2 }, shortcut: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.softGreen, borderRadius: 14, padding: 12, minHeight: 72 }, shortcutIcon: { color: c.green, fontSize: 26 }, shortcutTitle: { color: c.green, fontSize: 14, fontWeight: '700' },
});
