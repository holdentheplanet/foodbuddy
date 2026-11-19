import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { categoryArtworkInfo } from '../ui/categoryArtworkInfo';
import type { ImageSourcePropType } from 'react-native';
const artwork: Record<string, ImageSourcePropType> = {
  'snacks-candy': require('../assets/categories/snacks-candy.jpg'),
  'dairy-eggs': require('../assets/categories/dairy-eggs.jpg'),
  breakfast: require('../assets/categories/breakfast.jpg'),
  'bread-bakery': require('../assets/categories/bread-bakery.jpg'),
  'frozen-foods': require('../assets/categories/frozen-foods.jpg'),
  beverages: require('../assets/categories/beverages.jpg'),
  pantry: require('../assets/categories/pantry.jpg'),
  produce: require('../assets/categories/produce.jpg'),
  'meat-seafood': require('../assets/categories/meat-seafood.jpg'),
  'condiments-dressings': require('../assets/categories/condiments-dressings.jpg'),
};
export default function CategoryArtwork({ categoryId, caption = true }: { categoryId: string | null; caption?: boolean }) {
  const info = categoryArtworkInfo(categoryId);
  return <View style={styles.frame} testID={`category-art-${info.id}`}>
    <Image source={artwork[info.id]} resizeMode="cover" style={styles.image} accessibilityLabel={info.label} />
    {caption && <Text style={styles.caption}>Category illustration</Text>}
  </View>;
}
const styles = StyleSheet.create({ frame: { width: '100%', height: '100%', overflow: 'hidden' }, image: { width: '100%', height: '100%' }, caption: { position: 'absolute', bottom: 4, left: 5, color: '#344C3C', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, fontSize: 9, lineHeight: 13 } });
