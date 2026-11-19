import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getProductPhoto } from '../ui/productPhotos';
import { getProductIllustration } from '../ui/productIllustrations';
import { selectProductImage } from '../ui/productImageSelection';
import { colors as c } from '../ui/theme';

type Props = { productId: string; name: string; categoryId: string | null; large?: boolean; compact?: boolean; thumbnail?: boolean };
export default function ProductPhoto({ productId, name, large = false, compact = false, thumbnail = false }: Props) {
  const photo = getProductPhoto(productId);
  const illustration = getProductIllustration(productId);
  const [failure, setFailure] = useState({ productId, photo: false, illustration: false });
  const failed = failure.productId === productId && failure.photo;
  const illustrationFailed = failure.productId === productId && failure.illustration;
  const mode = selectProductImage(!!photo, !!illustration, failed, illustrationFailed);
  const [creditsOpen, setCreditsOpen] = useState(false);
  return <View>
    <View testID={`photo-frame-${productId}`} style={[styles.frame, { backgroundColor: photo && !failed ? '#FFFFFF' : '#F5F6F3' }, large && styles.large, compact && styles.compact, thumbnail && styles.thumbnail, mode !== 'photo' && styles.artFrame]}>
      {mode === 'photo' && photo ? <Image testID={`photo-${productId}`} source={photo.source} resizeMode="contain"
        accessibilityLabel={`${name}, package photo`} style={styles.image} onError={() => setFailure({ productId, photo: true, illustration: illustrationFailed })} />
        : mode === 'illustration' && illustration ? <View style={styles.illustration}>
          <Image testID={`illustration-${productId}`} source={illustration.source} resizeMode="contain" style={styles.image}
            accessibilityLabel={`${name}, generated illustrative image, not an official product photograph`}
            onError={() => setFailure({ productId, photo: failed, illustration: true })} />
          <Text style={styles.illustrationLabel}>Illustrative image</Text>
        </View> : <View style={styles.neutral} accessibilityLabel={`${name}. No product image available.`}><Text style={styles.neutralLabel}>No product image</Text></View>}

    </View>
    {large && photo && !failed && <View style={styles.creditArea}>
      {!compact && <Text style={styles.caption}>Package photo for identification. Packaging may change.</Text>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show product photo credits"
        accessibilityState={{ expanded: creditsOpen }} onPress={() => setCreditsOpen(value => !value)} style={styles.creditButton}>
        <Text style={styles.creditLink}>Photo credits · {photo.license} {creditsOpen ? '−' : '+'}</Text>
      </TouchableOpacity>
      {creditsOpen && <View style={styles.creditPanel}>
        <Text selectable style={styles.creditText}>{photo.attribution}</Text>
        <Text selectable style={styles.creditText}>{photo.sourceUrl}</Text>
        <Text selectable style={styles.creditText}>{photo.licenseUrl}</Text>
        <Text style={styles.creditText}>{photo.changes} Packaging artwork and trademarks belong to their respective owners. No endorsement implied.</Text>
      </View>}
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  illustration: { width: '100%', height: '100%' },
  illustrationLabel: { position: 'absolute', bottom: 3, left: 4, backgroundColor: '#F8F6F1', color: '#46534A', paddingHorizontal: 3, fontSize: 9, lineHeight: 13 },
  neutral: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  neutralLabel: { color: c.muted, fontSize: 11 },
  artFrame: { padding: 0, overflow: 'hidden' },
  frame: { height: 108, backgroundColor: '#F0F4EF', padding: 14, alignItems: 'center', justifyContent: 'center' },
  thumbnail: { height: 100 },
  compact: { height: 138, padding: 10 },
  large: { height: 180, borderRadius: 18, padding: 20 },
  image: { width: '100%', height: '100%' },
  caption: { color: c.muted, fontSize: 11, lineHeight: 17 },
  creditArea: { marginTop: 8 },
  creditButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  creditLink: { color: c.green, fontSize: 12, fontWeight: '600' },
  creditPanel: { padding: 12, borderRadius: 10, backgroundColor: c.softGreen, gap: 6 },
  creditText: { color: c.muted, fontSize: 12, lineHeight: 18 },
});
