import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProductPhoto from './ProductPhoto';
import ProductAllergyStatus from './ProductAllergyStatus';
import StockBadge from './StockBadge';
import type { LocalProductSummary } from '../services/localProductService';
import type { LocalAllergyResult } from '../services/localAllergyMatching';
import { productEvidence } from '../ui/productEvidence';
import { colors as c } from '../ui/theme';
export default function ProductCard({ product, result, onPress, inventory = false }: { product: LocalProductSummary; result?: LocalAllergyResult; onPress: () => void; inventory?: boolean }) {
  return <TouchableOpacity testID={`product-${product.id}`} accessibilityRole="button" accessibilityLabel={`View ${product.name}`} onPress={onPress} style={styles.card}>
    <ProductPhoto productId={product.id} name={product.name} categoryId={product.categoryId} thumbnail />
    <View style={styles.copy}><Text style={styles.brand}>{product.brand}</Text><Text style={styles.name}>{product.name}</Text>
      <ProductAllergyStatus result={result} evidenceComplete={productEvidence(product).allergensDocumented} />
      {inventory && <StockBadge status={product.simulatedAvailability} />}
    </View>
  </TouchableOpacity>;
}
const styles = StyleSheet.create({ card: { backgroundColor: c.white, borderRadius: 14, overflow: 'hidden', flex: 1 }, copy: { padding: 11 }, brand: { color: c.muted, fontSize: 12, lineHeight: 18 }, name: { color: c.blue, fontSize: 14, lineHeight: 20, fontWeight: '600' } });
