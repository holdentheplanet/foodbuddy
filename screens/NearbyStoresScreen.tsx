import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStoreLocationPreferences, selectedZipLocation, storeLocationAfterGPS, CHARLESTON_DEFAULT, storeOriginRegion } from '../services/storeLocationPreference';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, FlatList, Linking, Platform, StyleSheet, Text, TextInput, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import ProductSearchScreen from './ProductSearchScreen';
import MapView, { Marker, type Region } from 'react-native-maps';
import { db } from '../database/db';
import { createLocalStoreService, type LocalStore } from '../services/localStoreService';
import { getForegroundLocation } from '../services/deviceLocation';
import { validCoordinates } from '../services/storeDistance';
import { createLatestRequest } from '../services/latestRequest';
import { lookupZip } from '../services/zipLocation';
import { browseStores, STORE_RADII } from '../services/storeBrowsing';
import { colors as c } from '../ui/theme';

const locationPreferences = createStoreLocationPreferences(AsyncStorage);
const localStores = createLocalStoreService(db);
function miles(store: LocalStore) { return store.distanceMiles === null ? 'Distance unavailable' : `${store.distanceMiles.toFixed(1)} mi away`; }
function address(store: LocalStore) { return `${store.streetAddress}, ${store.city}, ${store.state} ${store.zipCode}`.replace(/\s+/g, ' '); }

export default function NearbyStoresScreen({ onBack, userId, isActive = true }: { onBack: () => void; userId: number; isActive?: boolean }) {
  const { height } = useWindowDimensions();
  const [sheet, setSheet] = useState<'location' | 'filters' | null>(null);
  const [chainPicker, setChainPicker] = useState(false);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [sort, setSort] = useState<'distance' | 'name'>('distance');
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [stores, setStores] = useState<LocalStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState(() => selectedZipLocation(null));
  const [locationReady, setLocationReady] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const manualZip = useRef<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'zip' | 'default'>('default');
  const [zip, setZip] = useState('');
  const [zipError, setZipError] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const [query, setQuery] = useState('');
  const [chain, setChain] = useState<string | null>(null);
  const [radius, setRadius] = useState(25);
  const [page, setPage] = useState(1);
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showMap, setShowMap] = useState(Platform.OS !== 'web');
  const [mapReady, setMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const map = useRef<MapView>(null);
  const [viewport, setViewport] = useState<{ key: string; region: Region } | null>(null);
  const list = useRef<FlatList<LocalStore>>(null);
  const locationRequests = useRef(createLatestRequest());
  const results = useMemo(() => browseStores(stores, { origin: locationReady ? location.position : null, browseAll, query, chain, radiusMiles: radius, sort }, page),
    [stores, locationReady, location.position, browseAll, query, chain, radius, sort, page]);
  const selected = results.visible.find(store => store.id === selectedId);
  const coverage = `${stores.length} saved locations across ${new Set(stores.map(store => store.state)).size} states. Coverage is limited to saved locations.`;
  const chains = useMemo(() => [...new Map(stores.map(store => [store.chain.toLocaleLowerCase(), store.chain])).values()].sort(), [stores]);
  // The default is explicit and labeled; map and list use the same selected origin.
  const originRegion = useMemo(() => {
    if (!locationReady) return null;
    if (location.position) return storeOriginRegion(location.position, radius);
    const points = browseAll ? stores.filter((store): store is LocalStore & { latitude: number; longitude: number } => validCoordinates(store)) : [];
    if (!points.length) return null;
    const latitudes = points.map(point => point.latitude), longitudes = points.map(point => point.longitude);
    const south = Math.min(...latitudes), north = Math.max(...latitudes), west = Math.min(...longitudes), east = Math.max(...longitudes);
    return { latitude: (south + north) / 2, longitude: (west + east) / 2,
      latitudeDelta: Math.max(0.05, (north - south) * 1.3), longitudeDelta: Math.max(0.05, (east - west) * 1.3) };
  }, [locationReady, location.position, radius, browseAll, stores]);
  const originKey = `${userId}:${locationSource}:${originRegion?.latitude}:${originRegion?.longitude}:${radius}`;
  useEffect(() => { if (showMap && mapReady && originRegion) map.current?.animateToRegion(originRegion, 350); }, [originRegion, showMap, mapReady]);
  function resetResults() { setPage(1); setSelectedId(null); setShowSources(false); }
  function selectZip(input = zip) {
    const result = lookupZip(input);
    if (!result.ok) { setZipError(result.message); return; }
    locationRequests.current.invalidate(); setLocating(false); setZipError(null); resetResults();
    manualZip.current = result.zip; setLocationReady(true); setLocationNotice(null);
    void locationPreferences.save(userId, result.zip).catch(() => setLocationNotice('This ZIP is selected, but could not be saved for restart.'));
    setBrowseAll(false); setLocationSource('zip');
    setSheet(null);
    setZip(result.zip); setLocation(selectedZipLocation(result.zip));
  }

  async function locate() {
    const token = locationRequests.current.start();
    setLocating(true); setLocationNotice(null); setBrowseAll(false); setZipError(null); resetResults();
    const result = await getForegroundLocation();
    if (locationRequests.current.isCurrent(token)) {
      const resolved = storeLocationAfterGPS(result, manualZip.current);
      setLocation(resolved.location); setLocationSource(resolved.source); setLocationNotice(resolved.notice);
      setLocationReady(true); setLocating(false);
    }
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
    const requests = locationRequests.current;
    const token = requests.start();
    manualZip.current = null;
    void locationPreferences.loadPreference(userId).then(preference => {
      const saved = preference.manualZip;
      if (!requests.isCurrent(token)) return;
      manualZip.current = saved;
      setZip(saved ?? ''); setLocation(selectedZipLocation(saved));
      setLocationSource(saved ? 'zip' : 'default'); setLocationReady(true); setLocationNotice(preference.notice);
    }).catch(() => {
      if (!requests.isCurrent(token)) return;
      setLocation(selectedZipLocation(null)); setLocationSource('default'); setLocationReady(true);
      setLocationNotice('Saved location could not be read. Showing Charleston default without changing saved preferences.');
    });
    return () => requests.invalidate();
  }, [userId]);
  useEffect(() => {
    if (!showMap || !originRegion || mapReady) return;
    const timer = setTimeout(() => setMapNotice('Map taking a moment? Switch to List to browse saved stores.'), 10000);
    return () => clearTimeout(timer);
  }, [showMap, mapReady, originRegion]);
  function selectStore(store: LocalStore) {
    setSelectedId(store.id); setShowSources(false); setSelectionRequest(value => value + 1);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  }
  useEffect(() => {
    if (showMap && mapReady && selected && validCoordinates(selected)) {
      map.current?.animateToRegion({ latitude: selected.latitude, longitude: selected.longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 350);
    }
  }, [selectionRequest, selected, showMap, mapReady]);

  const storePreview = selected && <View style={styles.selected} accessibilityLabel={`Selected store ${selected.id}`}>

      <Text style={styles.selectedName}>{selected.name}</Text>
      <Text style={styles.distance}>{selected.chain} • {miles(selected)}</Text>
      <Text style={styles.body}>{address(selected)}</Text>
      {selected.verificationStatus !== 'verified' && <Text style={styles.notice}>{selected.dataset ? 'OSM dataset-sourced — not independently verified. Confirm the current location.' : 'Coordinates unverified — confirm location'}</Text>}
      {selected.hasInventory && <TouchableOpacity style={styles.primary} accessibilityRole="button" accessibilityLabel="View selected store demo inventory" onPress={() => setInventoryOpen(true)}><Text style={styles.primaryText}>View demo inventory →</Text></TouchableOpacity>}
      <Text style={styles.small}>{selected.hasInventory ? 'Demo inventory — simulated, not live availability.' : 'No inventory data available'}</Text>
      <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Toggle store location sources" accessibilityState={{ expanded: showSources }} onPress={() => setShowSources(value => !value)}><Text style={styles.link}>{showSources ? 'Hide location sources' : 'Location sources & review date'}</Text></TouchableOpacity>
      {showSources && <View style={{ gap: 8 }}>
        <Text style={styles.small}>{selected.dataset ? 'Dataset-sourced; independently unverified' : selected.verificationStatus === 'verified' ? 'Directory location reviewed' : 'Coordinates need review'} • {selected.checkedAt ?? 'Date unknown'}</Text>
        {selected.dataset && <Text style={styles.small}>Dataset timestamp: {selected.dataset.datasetTimestamp} • OSM {selected.dataset.osmType}/{selected.dataset.osmId} • {selected.dataset.coordinateMethod === 'osm_node' ? 'Mapped point' : 'Approximate mapped-feature bounding-box center'}</Text>}
        {selected.sources.map(source => <Text selectable key={source.url} style={styles.source}>{source.url}</Text>)}
        {selected.attribution && <Text selectable style={styles.small}>{selected.attribution}</Text>}
      </View>}
    </View>;
  const header = <>
    <View style={styles.header}>
      <Text style={styles.title}>Stores</Text>
      <TouchableOpacity style={styles.locationSelector} accessibilityRole="button" accessibilityLabel="Choose store location" onPress={() => setSheet('location')}>
        <Text style={styles.link}>{!locationReady ? 'Loading saved location…' : locating ? 'Finding your location…' : browseAll ? 'All saved locations' : locationSource === 'zip' ? `${location.message.split(' — ')[0]} · Approximate` : locationSource === 'default' ? location.message : location.position ? 'Near my location' : 'Choose your location'} ▾</Text>
      </TouchableOpacity>
      <TextInput testID="store-search-input" accessibilityLabel="Search stores by name or address" placeholderTextColor={c.muted} placeholder="Search stores or addresses" value={query}
        onChangeText={value => { setQuery(value); resetResults(); }} style={styles.input} autoCorrect={false} />
      <View style={styles.toolbar}>
        <View style={styles.modes}>{[true, false].map(value => <TouchableOpacity key={String(value)} style={[styles.mode, showMap === value && styles.modeActive]} accessibilityRole="button" accessibilityState={{ selected: showMap === value }} accessibilityLabel={value ? 'Map view' : 'List view'} onPress={() => setShowMap(value)}><Text style={styles.link}>{value ? 'Map' : 'List'}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Open store filters" onPress={() => setSheet('filters')}><Text style={styles.actionText}>Filters{chain || radius !== 25 || sort !== 'distance' ? ' •' : ''}</Text></TouchableOpacity>
      </View>
    </View>
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
      <View style={styles.scrim}><View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.toolbar}><Text style={styles.selectedName}>{sheet === 'location' ? 'Choose a location' : 'Store filters'}</Text><TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Close store controls" onPress={() => setSheet(null)}><Text style={styles.link}>Done</Text></TouchableOpacity></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
        {sheet === 'location' ? <>
        <Text style={styles.body}>Default: Charleston, SC 29401 (approximate). A saved ZIP takes priority. GPS is used only when you choose Use My Location.</Text>
      <Text style={styles.filterLabel}>Search by ZIP code</Text>
      <View style={styles.zipRow}>
        <TextInput testID="store-zip-input" accessibilityLabel="Five-digit ZIP code" placeholderTextColor={c.muted} placeholder="ZIP code" value={zip}
          onChangeText={value => { setZip(value); setZipError(null); }} keyboardType="number-pad" maxLength={5} style={styles.input}
          onSubmitEditing={() => selectZip()} returnKeyType="search" />
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Search ZIP code" onPress={() => selectZip()}><Text style={styles.actionText}>Use ZIP</Text></TouchableOpacity>
      </View>
      {zipError && <Text accessibilityRole="alert" style={styles.notice}>{zipError}</Text>}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Use Charleston default" onPress={() => selectZip(CHARLESTON_DEFAULT.zip)}><Text style={styles.actionText}>Use Charleston, SC 29401</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Refresh store location" accessibilityState={{ disabled: locating || !locationReady }} disabled={locating || !locationReady} onPress={() => { setSheet(null); void locate(); }}><Text style={styles.actionText}>{locating ? 'Locating…' : 'Use My Location'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Browse All Saved Stores" onPress={() => {
          locationRequests.current.invalidate(); setLocating(false); setBrowseAll(true); setSheet(null); resetResults();
        }}><Text style={styles.actionText}>Browse All Saved Stores</Text></TouchableOpacity>
        {browseAll && location.position && <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Show nearby stores" onPress={() => { setBrowseAll(false); resetResults(); }}><Text style={styles.actionText}>Nearby only</Text></TouchableOpacity>}
      </View>
      {!location.position && !locating && <Text style={styles.body}>{location.message}</Text>}
      <Text style={styles.small}>{coverage}</Text>
      </> : <>
      <Text style={styles.filterLabel}>Grocery chain</Text>
      <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Choose grocery chain" accessibilityState={{ expanded: chainPicker }} onPress={() => setChainPicker(value => !value)}><Text style={styles.actionText}>{chain ?? 'All chains'} ▾</Text></TouchableOpacity>
      {chainPicker && <View>{[null, ...chains].map(value => <TouchableOpacity key={value ?? 'all'} accessibilityRole="button" accessibilityLabel={`Filter chain ${value ?? 'All chains'}`} accessibilityState={{ selected: chain === value }} style={styles.chainOption} onPress={() => { setChain(value); setChainPicker(false); resetResults(); }}><Text style={styles.link}>{value ?? 'All chains'}{chain === value ? ' ✓' : ''}</Text></TouchableOpacity>)}</View>}
      <Text style={styles.filterLabel}>Search radius {browseAll ? '(paused in all-stores mode)' : ''}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
        {STORE_RADII.map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`Within ${value} miles`}
          disabled={browseAll} accessibilityState={{ selected: radius === value, disabled: browseAll }} style={[styles.action, radius === value && styles.activeFilter, browseAll && { opacity: 0.5 }]}
          onPress={() => { setRadius(value); resetResults(); }}><Text style={styles.actionText}>{value} mi</Text></TouchableOpacity>)}
      </ScrollView>
      <Text style={styles.filterLabel}>Sort stores</Text>
      <View style={styles.actions}>{(['distance', 'name'] as const).map(value => <TouchableOpacity key={value} style={[styles.action, sort === value && styles.activeFilter]} accessibilityRole="button" accessibilityState={{ selected: sort === value }} onPress={() => { setSort(value); resetResults(); }}><Text style={styles.actionText}>{value === 'distance' ? 'Nearest first' : 'Name A–Z'}</Text></TouchableOpacity>)}</View>
      </>}
      </ScrollView></View></View>
    </Modal>
    {showMap && originRegion && Platform.OS !== 'web' && <View style={[styles.mapFrame, { height: Math.max(280, height * 0.48) }]}>
      <MapView key={originKey} testID="store-map" ref={map} style={styles.map} initialRegion={originRegion} region={viewport?.key === originKey ? viewport.region : originRegion} onRegionChangeComplete={region => setViewport({ key: originKey, region })} showsUserLocation={isActive && !inventoryOpen && locationSource === 'gps' && location.position !== null}
        onMapReady={() => { setMapReady(true); setMapNotice(null); }}
        onMapLoaded={() => { setMapReady(true); setMapNotice(null); }}>
        {locationSource !== 'gps' && location.position && <Marker identifier="selected-zip-origin" coordinate={location.position} title={location.message} pinColor={c.blue} />}
        {results.visible.filter((store): store is LocalStore & { latitude: number; longitude: number } => validCoordinates(store)).map(store => <Marker key={store.id} identifier={store.id}
          coordinate={{ latitude: store.latitude, longitude: store.longitude }} title={store.name}
          description={`${store.chain} • ${address(store)} • ${miles(store)}`}
          pinColor={selectedId === store.id ? c.blue : c.green} onPress={() => selectStore(store)} />)}
      </MapView>
      <Text accessibilityRole="link" style={styles.mapAttribution} onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => setMapNotice('Store data © OpenStreetMap contributors. License: https://www.openstreetmap.org/copyright'))}>Store data © OpenStreetMap contributors · ODbL</Text>
      {selected && <ScrollView style={styles.mapPreview} contentContainerStyle={{ padding: 2 }} nestedScrollEnabled>{storePreview}</ScrollView>}
    </View>}
    {showMap && originRegion && <View style={styles.mapActions}>
      <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Recenter selected location" onPress={() => { setSelectedId(null); map.current?.animateToRegion(originRegion, 350); }}><Text style={styles.actionText}>Recenter map</Text></TouchableOpacity>
    </View>}
    {locationNotice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{locationNotice}</Text>}
    {mapNotice && <Text style={styles.notice}>{mapNotice}</Text>}
    {!showMap && storePreview}
    <View style={styles.listHeading}><Text style={styles.listTitle}>{showMap ? 'On this map' : 'Browse by chain'}</Text><Text style={styles.small}>{results.visible.length} of {results.total} • {sort === 'name' || !location.position ? 'A–Z' : 'Nearest first'}</Text></View>
    {loading && <View style={styles.state}><ActivityIndicator color={c.green} /><Text style={styles.body}>Loading saved stores…</Text></View>}
    {error && <View style={styles.state}><Text style={styles.notice}>{error}</Text><TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Retry loading stores" onPress={() => setReload(value => value + 1)}><Text style={styles.actionText}>Try again</Text></TouchableOpacity></View>}
  </>;
  return <View style={styles.screen}>
    <View style={styles.screen} pointerEvents={inventoryOpen ? 'none' : 'auto'} accessibilityElementsHidden={inventoryOpen}
      importantForAccessibility={inventoryOpen ? 'no-hide-descendants' : 'auto'}>
      <FlatList testID="store-results-list" ref={list} data={showMap ? [] : results.visible} keyboardShouldPersistTaps="handled" keyExtractor={store => store.id} contentContainerStyle={styles.list}
        removeClippedSubviews={false} ListHeaderComponent={header}
        ListEmptyComponent={!loading && locationReady && !error && results.total === 0 ? <View style={styles.state}><Text style={styles.selectedName}>{results.emptyReason === 'outside_coverage' ? `No saved stores within ${radius} miles` : results.emptyReason === 'location_required' ? 'Choose a location to find nearby stores' : 'No stores match your filters'}</Text>
          <Text style={styles.body}>{results.emptyReason === 'outside_coverage' ? `${coverage} No additional stores are discovered automatically. Browse all saved stores or choose another location.` : results.emptyReason === 'location_required' ? 'Use My Location, enter a five-digit ZIP, or choose Browse All Saved Stores. We never guess your location.' : 'Try another name or address, change the chain, or widen the radius.'}</Text>
          {results.emptyReason !== 'no_matches' && <TouchableOpacity style={styles.action} accessibilityRole="button" accessibilityLabel="Browse all saved stores from empty results" onPress={() => {
            locationRequests.current.invalidate(); setLocating(false); setBrowseAll(true); setSheet(null); resetResults();
          }}><Text style={styles.actionText}>Browse All Saved Stores</Text></TouchableOpacity>}
        </View> : null}
        ListFooterComponent={<View style={styles.footer}>{results.hasMore && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Load 10 more stores" style={styles.action} onPress={() => setPage(value => value + 1)}><Text style={styles.actionText}>Load more stores ({results.visible.length} of {results.total})</Text></TouchableOpacity>}<Text style={styles.small}>Apple Maps may use internet. Store addresses and distance calculations stay on your device.</Text><Text style={styles.small}>Store data © OpenStreetMap contributors • ODbL 1.0 • openstreetmap.org/copyright</Text></View>}
        renderItem={({ item, index }) => {
          const first = results.visible.findIndex(store => store.chain === item.chain) === index;
          return <View>
            {first && <TouchableOpacity style={styles.chainGroup} accessibilityRole="button" accessibilityState={{ expanded: expandedChain === item.chain }} accessibilityLabel={`Browse ${item.chain} stores`} onPress={() => setExpandedChain(value => value === item.chain ? null : item.chain)}><Text style={styles.storeName}>{item.chain}</Text><Text style={styles.link}>{results.visible.filter(store => store.chain === item.chain).length} loaded {expandedChain === item.chain ? '−' : '+'}</Text></TouchableOpacity>}
            {first && expandedChain === item.chain && results.visible.filter(store => store.chain === item.chain).map(store => <TouchableOpacity key={store.id} style={styles.store} accessibilityRole="button" accessibilityLabel={`Select store ${store.id}`} onPress={() => selectStore(store)}>
              <Text style={styles.storeName}>{store.name}</Text><Text style={styles.distance}>{miles(store)}</Text><Text style={styles.body}>{address(store)}</Text><Text style={styles.small}>{store.hasInventory ? 'Demo inventory · simulated' : 'No inventory data available'}</Text>
            </TouchableOpacity>)}
          </View>;
        }} />
    </View>
    {inventoryOpen && selected && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.cream }}>
      <ProductSearchScreen key={selected.id} isActive={isActive} userId={userId} store={selected} onBack={() => setInventoryOpen(false)} />
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  mapPreview: { position: 'absolute', bottom: 12, left: 10, right: 10, maxHeight: 230 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modes: { flexDirection: 'row', backgroundColor: c.softGreen, borderRadius: 12, padding: 3 },
  mode: { minHeight: 44, paddingHorizontal: 22, justifyContent: 'center', borderRadius: 10 }, modeActive: { backgroundColor: c.white },
  locationSelector: { minHeight: 44, justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,30,24,0.4)' },
  sheet: { maxHeight: '85%', backgroundColor: c.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 32, gap: 16 },
  chainOption: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderColor: c.border },
  chainGroup: { marginHorizontal: 20, paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.border, gap: 12 },
  input: { flexGrow: 1, minWidth: 100, minHeight: 48, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.white, color: c.blue, fontSize: 15 },
  zipRow: { flexDirection: 'row', gap: 8 }, filterLabel: { color: c.blue, fontSize: 13, fontWeight: '600', marginTop: 5 }, activeFilter: { borderColor: c.green, backgroundColor: c.softGreen, borderWidth: 2 },
  screen: { flex: 1, backgroundColor: c.cream }, header: { paddingHorizontal: 18, paddingTop: 6, gap: 8 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { color: c.green, fontWeight: '700', fontSize: 13 },
  eyebrow: { color: c.green, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }, title: { color: c.blue, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  body: { color: c.muted, fontSize: 14, lineHeight: 21 }, small: { color: c.muted, fontSize: 12, lineHeight: 18 },
  locationNote: { paddingVertical: 6, gap: 4 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  action: { borderWidth: 1, borderColor: c.border, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: c.white, justifyContent: 'center' },
  actionText: { color: c.green, fontSize: 12, fontWeight: '700' }, mapFrame: { marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  mapAttribution: { position: 'absolute', top: 5, left: 5, right: 5, backgroundColor: 'rgba(255,255,255,0.95)', color: c.blue, fontSize: 10, padding: 5, borderRadius: 5 },
  map: { flex: 1 }, mapActions: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginVertical: 10 },
  selected: { backgroundColor: c.white, borderColor: c.border, borderWidth: 0, borderRadius: 16, padding: 14, margin: 0, gap: 6 },
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
