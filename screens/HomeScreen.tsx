import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { colors as c } from '../ui/theme';

type Props = { username: string; onProducts: () => void; onStores: () => void; onAllergies: () => void };
export default function HomeScreen({ username, onProducts, onStores, onAllergies }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.25;
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.brandRow}><View style={styles.leaf}><Text style={{ fontSize: 24 }}>🌿</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.brand}>FoodBuddy</Text><Text style={styles.eyebrow}>A little clarity in every aisle</Text></View></View>
    <Text style={styles.greeting}>Hi, {username}.</Text>
    <Text style={styles.heading}>Let’s plan your next grocery trip.</Text>
    <TouchableOpacity style={styles.search} accessibilityRole="button" accessibilityLabel="Search all products" onPress={onProducts}>
      <Text style={{ color: c.green, fontSize: 25 }}>⌕</Text><Text style={styles.searchText}>Search products or brands</Text><Text style={{ color: c.green }}>→</Text>
    </TouchableOpacity>
    <View style={styles.hero}>
      <Text style={styles.heroTag}>YOUR LABEL COMPANION</Text>
      <Text style={styles.heroTitle}>Get to know what’s in your basket.</Text>
      <Text style={styles.heroBody}>Explore products and compare available ingredient labels with your saved allergy profile.</Text>
      <TouchableOpacity style={styles.heroButton} accessibilityRole="button" accessibilityLabel="Browse product categories" onPress={onProducts}>
        <Text style={styles.heroButtonText}>Browse products</Text><Text style={styles.heroButtonText}>→</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.section}>Make it your shopping trip</Text>
    <View style={[styles.quickRow, singleColumn && { flexDirection: 'column' }]}>
      <TouchableOpacity style={[styles.quickCard, singleColumn && { flex: 0 }]} accessibilityRole="button" accessibilityLabel="Open Nearby Stores" onPress={onStores}>
        <Text style={styles.quickIcon}>⌖</Text><Text style={styles.quickTitle}>Nearby stores</Text>
        <Text style={styles.quickBody}>Find a store and browse its demo inventory.</Text><Text style={styles.quickLink}>Explore stores →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.quickCard, singleColumn && { flex: 0 }]} accessibilityRole="button" accessibilityLabel="Open saved allergy profile" onPress={onAllergies}>
        <Text style={styles.quickIcon}>♡</Text><Text style={styles.quickTitle}>Your allergies</Text>
        <Text style={styles.quickBody}>Keep your saved profile close at hand.</Text><Text style={styles.quickLink}>View profile →</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.reminder}><Text style={styles.reminderTitle}>A label check, every time</Text>
      <Text style={styles.reminderText}>Always check the physical packaging and current allergen warnings before consuming. App information may be incomplete.</Text></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 32, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  leaf: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.softGreen, alignItems: 'center', justifyContent: 'center' },
  brand: { color: c.green, fontSize: 25, fontWeight: '800', letterSpacing: -0.7 },
  eyebrow: { color: c.muted, fontSize: 12, lineHeight: 19 }, greeting: { color: c.muted, fontSize: 15, marginBottom: -10 },
  heading: { color: c.blue, fontSize: 31, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, minHeight: 56 },
  searchText: { flex: 1, color: c.muted, fontSize: 15 },
  hero: { backgroundColor: c.green, borderRadius: 24, padding: 23, gap: 14 },
  heroTag: { color: '#BCD9CA', fontWeight: '700', fontSize: 10, letterSpacing: 1.7 },
  heroTitle: { color: c.white, fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.5 },
  heroBody: { color: '#E0EBE4', fontSize: 14, lineHeight: 22 },
  heroButton: { backgroundColor: c.cream, borderRadius: 12, minHeight: 48, padding: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  heroButtonText: { color: c.green, fontSize: 14, fontWeight: '800' }, section: { color: c.blue, fontSize: 18, fontWeight: '700', marginTop: 4 },
  quickRow: { flexDirection: 'row', gap: 12 }, quickCard: { flex: 1, padding: 17, backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, gap: 8 },
  quickIcon: { color: c.green, fontSize: 28 }, quickTitle: { color: c.blue, fontWeight: '700', fontSize: 17 },
  quickBody: { color: c.muted, fontSize: 13, lineHeight: 20 }, quickLink: { color: c.green, fontWeight: '700', fontSize: 12, paddingVertical: 6 },
  reminder: { padding: 16, borderRadius: 16, backgroundColor: c.softAmber, gap: 6 },
  reminderTitle: { color: c.amber, fontSize: 13, fontWeight: '700' }, reminderText: { color: c.amber, fontSize: 12, lineHeight: 19 },
});
