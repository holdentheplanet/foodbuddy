import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import ProductSearchScreen from './ProductSearchScreen';
import MapView, { Marker } from 'react-native-maps';
import { db } from '../database/db';
import { createLocalStoreService, type LocalStore } from '../services/localStoreService';
import { getForegroundLocation } from '../services/deviceLocation';
import type { ForegroundLocationResult } from '../services/foregroundLocation';
import { sortStoresByDistance, validCoordinates } from '../services/storeDistance';
import { createLatestRequest } from '../services/latestRequest';
import { colors as c } from '../ui/theme';

const localStores = createLocalStoreService(db);
const unavailable: ForegroundLocationResult = { status: 'unavailable', position: null, accuracy: null, timestamp: null, mocked: false,
  message: 'Browse saved Charleston-area stores manually. Location is optional.' };
// Viewport only; store coordinates and the user's GPS fix are unchanged.
const CHARLESTON_REGION = { latitude: 32.85, longitude: -79.98, latitudeDelta: 0.5, longitudeDelta: 0.55 };
function miles(store: LocalStore) { return store.distanceMiles === null ? 'Distance unavailable' : `${store.distanceMiles.toFixed(1)} mi away`; }
function address(store: LocalStore) { return `${store.streetAddress}, ${store.city}, ${store.state} ${store.zipCode}`.replace(/\s+/g, ' '); }

export default function NearbyStoresScreen({ onBack, userId, isActive = true }: { onBack: () => void; userId: number; isActive?: boolean }) {
  const { height } = useWindowDimensions();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [stores, setStores] = useState<LocalStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState(unavailable);
  const [locating, setLocating] = useState(true);
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showMap, setShowMap] = useState(Platform.OS !== 'web');
  const [mapReady, setMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const map = useRef<MapView>(null);
  const list = useRef<FlatList<LocalStore>>(null);
  const locationRequests = useRef(createLatestRequest());
  const ordered = useMemo(() => sortStoresByDistance(stores, location.position), [stores, location.position]);
  const selected = ordered.find(store => store.id === selectedId);

  async function locate() {
    const token = locationRequests.current.start();
    setLocating(true); setLocation(unavailable);
    const result = await getForegroundLocation();
    if (locationRequests.current.isCurrent(token)) { setLocation(result); setLocating(false); }
  }
  useEffect(() => {
    let current = true;
    setLoading(true); setError(null);
    void localStores.listStores().then(value => { if (current) setStores(value); })
      .catch(() => { if (current) setError('We couldn’t load your saved stores. Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reload]);
  useEffect(() => {
    void locate();
    return () => locationRequests.current.invalidate();
  }, []);
  useEffect(() => {
    if (!showMap || mapReady) return;
    const timer = setTimeout(() => setMapNotice('Map taking a moment? You can still browse the stores below.'), 10000);
    return () => clearTimeout(timer);
  }, [showMap, mapReady]);
  function selectStore(store: LocalStore) {
    setSelectedId(store.id); setShowSources(false); setSelectionRequest(value => value + 1);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  }
  useEffect(() => {
    if (showMap && mapReady && selected && validCoordinates(selected)) {
      map.current?.animateToRegion({ latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 350);
    }
  }, [selectionRequest, selected?.latitude, selected?.longitude, showMap, mapReady]);

  const header = <>
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Back from nearby stores" onPress={onBack}><Text style={styles.link}>← Home</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>PLAN YOUR NEXT STOP</Text>
      <Text style={styles.title}>Nearby Stores</Text>
      <Text style={styles.body}>Charleston, SC & surrounding areas</Text>
      <View style={styles.locationNote} accessibilityLiveRegion="polite">
        <Text style={styles.body}>{locating ? 'Finding your location… Browse while you wait.' : location.position ? 'Stores are sorted from your latest location fix.' : location.message}</Text>
        {location.position && <Text style={styles.small}>Straight-line miles, not driving distance • {location.timestamp ? new Date(location.timestamp).toLocaleTimeString() : 'Fix time unknown'}
          {location.accuracy !== null ? ` • ±${Math.round(location.accuracy)} m` : ''}{location.mocked ? ' • Simulated location' : ''}</Text>}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Refresh store location" accessibilityState={{ disabled: locating }} disabled={locating} onPress={() => void locate()}><Text style={styles.actionText}>{locating ? 'Locating…' : 'Use my location'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Browse stores without location" onPress={() => {
          locationRequests.current.invalidate(); setLocation(unavailable); setLocating(false);
        }}><Text style={styles.actionText}>Browse manually</Text></TouchableOpacity>
        {Platform.OS !== 'web' && <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Toggle store map" onPress={() => {
          setShowMap(value => !value); setMapReady(false); setMapNotice(null);
        }}><Text style={styles.actionText}>{showMap ? 'List only' : 'Show map'}</Text></TouchableOpacity>}
      </View>
    </View>
    {showMap && Platform.OS !== 'web' && <View style={[styles.mapFrame, { height: Math.min(260, Math.max(185, height * 0.28)) }]}>
      <MapView ref={map} style={styles.map} initialRegion={CHARLESTON_REGION} showsUserLocation={isActive && !inventoryOpen && location.position !== null}
        onMapReady={() => { setMapReady(true); setMapNotice(null); }}
        onMapLoaded={() => { setMapReady(true); setMapNotice(null); }}>
        {ordered.filter((store): store is LocalStore & { latitude: number; longitude: number } => validCoordinates(store)).map(store => <Marker key={store.id} identifier={store.id}
          coordinate={{ latitude: store.latitude, longitude: store.longitude }} title={store.name}
          description={`${store.chain} • ${address(store)} • ${miles(store)}`}
          pinColor={selectedId === store.id ? c.blue : c.green} onPress={() => selectStore(store)} />)}
      </MapView>
    </View>}
    {showMap && <View style={styles.mapActions}>
      <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Show all saved stores on map" onPress={() => { setSelectedId(null); map.current?.animateToRegion(CHARLESTON_REGION, 350); }}><Text style={styles.actionText}>All stores</Text></TouchableOpacity>
      {location.position && <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Center map on my location" onPress={() => {
        if (location.position) map.current?.animateToRegion({ ...location.position, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 350);
      }}><Text style={styles.actionText}>Center on me</Text></TouchableOpacity>}
    </View>}
    {mapNotice && <Text style={styles.notice}>{mapNotice}</Text>}
    {selected && <View style={styles.selected} accessibilityLabel={`Selected store ${selected.id}`}>
      <Text style={styles.eyebrow}>YOUR SELECTED STORE</Text>
      <Text style={styles.selectedName}>{selected.name}</Text>
      <Text style={styles.distance}>{selected.chain} • {miles(selected)}</Text>
      <Text style={styles.body}>{address(selected)}</Text>
      {selected.verificationStatus !== 'verified' && <Text style={styles.notice}>Coordinates unverified — confirm location</Text>}
      <TouchableOpacity style={styles.primary} accessibilityRole="button" accessibilityLabel="View selected store demo inventory" onPress={() => setInventoryOpen(true)}><Text style={styles.primaryText}>View demo inventory →</Text></TouchableOpacity>
      <Text style={styles.small}>Demo inventory — simulated, not live availability.</Text>
      <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Toggle store location sources" accessibilityState={{ expanded: showSources }} onPress={() => setShowSources(value => !value)}><Text style={styles.link}>{showSources ? 'Hide location sources' : 'Location sources & review date'}</Text></TouchableOpacity>
      {showSources && <View style={{ gap: 8 }}>
        <Text style={styles.small}>{selected.verificationStatus === 'verified' ? 'Directory location reviewed' : 'Coordinates need review'} • {selected.checkedAt ?? 'Date unknown'}</Text>
        {selected.sources.map(source => <Text selectable key={source.url} style={styles.source}>{source.url}</Text>)}
        {selected.attribution && <Text selectable style={styles.small}>{selected.attribution}</Text>}
      </View>}
    </View>}
    <View style={styles.listHeading}><Text style={styles.listTitle}>Choose your store</Text><Text style={styles.small}>{ordered.length} saved • {location.position ? 'Nearest first' : 'A–Z'}</Text></View>
    {loading && <View style={styles.state}><ActivityIndicator color={c.green} /><Text style={styles.body}>Loading saved stores…</Text></View>}
    {error && <View style={styles.state}><Text style={styles.notice}>{error}</Text><TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Retry loading stores" onPress={() => setReload(value => value + 1)}><Text style={styles.actionText}>Try again</Text></TouchableOpacity></View>}
  </>;
  return <View style={styles.screen}>
    <View style={styles.screen} pointerEvents={inventoryOpen ? 'none' : 'auto'} accessibilityElementsHidden={inventoryOpen}
      importantForAccessibility={inventoryOpen ? 'no-hide-descendants' : 'auto'}>
      <FlatList ref={list} data={ordered} keyExtractor={store => store.id} contentContainerStyle={styles.list}
        removeClippedSubviews={false} ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? <View style={styles.state}><Text style={styles.selectedName}>No saved stores yet</Text><Text style={styles.body}>Store locations will appear here when available.</Text></View> : null}
        ListFooterComponent={<View style={styles.footer}><Text style={styles.small}>Apple Maps may use internet. Store addresses and distance calculations stay on your device.</Text><Text style={styles.small}>Walmart coordinates © OpenStreetMap contributors • ODbL</Text></View>}
        renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Select store ${item.id}`}
          accessibilityValue={{ text: `${item.name}. ${address(item)}. ${miles(item)}. ${item.verificationStatus !== 'verified' ? 'Coordinates need verification.' : ''}` }}
          accessibilityState={{ selected: selectedId === item.id }} style={[styles.store, selectedId === item.id && styles.activeStore]} onPress={() => selectStore(item)}>
          <Text style={styles.storeName}>{item.name}</Text><Text style={styles.distance}>{item.chain} • {miles(item)}</Text>
          <Text style={styles.body}>{address(item)}</Text><Text style={styles.link}>Select store →</Text>
          {item.verificationStatus !== 'verified' && <Text style={styles.unverified}>⚠ Coordinates need verification</Text>}
        </TouchableOpacity>} />
    </View>
    {inventoryOpen && selected && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.cream }}>
      <ProductSearchScreen key={selected.id} userId={userId} store={selected} onBack={() => setInventoryOpen(false)} />
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream }, header: { paddingHorizontal: 18, paddingTop: 6, gap: 8 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: c.green, fontWeight: '700', fontSize: 13 },
  eyebrow: { color: c.green, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }, title: { color: c.blue, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  body: { color: c.muted, fontSize: 14, lineHeight: 21 }, small: { color: c.muted, fontSize: 12, lineHeight: 18 },
  locationNote: { paddingVertical: 6, gap: 4 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  action: { borderWidth: 1, borderColor: c.border, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: c.white, justifyContent: 'center' },
  actionText: { color: c.green, fontSize: 12, fontWeight: '700' }, mapFrame: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  map: { flex: 1 }, mapActions: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginVertical: 10 },
  selected: { backgroundColor: c.softGreen, borderColor: '#ABC4B3', borderWidth: 1, borderRadius: 20, padding: 17, margin: 16, gap: 8 },
  selectedName: { color: c.blue, fontSize: 20, lineHeight: 26, fontWeight: '700' }, distance: { color: c.green, fontSize: 13, fontWeight: '600', lineHeight: 20 },
  primary: { minHeight: 48, padding: 14, backgroundColor: c.green, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: c.white, fontWeight: '700', fontSize: 14 }, source: { color: c.green, fontSize: 12, lineHeight: 18 },
  notice: { color: c.amber, padding: 12, backgroundColor: c.softAmber, fontSize: 13, lineHeight: 20, borderRadius: 10, marginHorizontal: 16 },
  listHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginHorizontal: 18, marginVertical: 14 },
  listTitle: { color: c.blue, fontWeight: '700', fontSize: 19 }, list: { paddingBottom: 24 },
  store: { marginHorizontal: 16, marginBottom: 10, backgroundColor: c.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border, gap: 6 },
  activeStore: { borderColor: c.green, backgroundColor: c.softGreen, borderLeftWidth: 4 }, storeName: { color: c.blue, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  unverified: { color: c.amber, fontSize: 12, lineHeight: 18 }, state: { alignItems: 'center', padding: 24, gap: 12 }, footer: { margin: 18, gap: 8 },
});
