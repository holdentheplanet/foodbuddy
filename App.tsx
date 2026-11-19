
import React, { useEffect, useEffectEvent, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import PasswordRecovery from './components/PasswordRecovery';
import { waitForProfileSync } from './auth/navigationSync';
import { syncCloudProfile } from './auth/cloudProfile';
import HomeScreen from './screens/HomeScreen';
import NearbyStoresScreen from './screens/NearbyStoresScreen';
import SettingsScreen from './screens/SettingsScreen';
import AllergyProfileScreen from './screens/AllergyProfileScreen';
import ProductSearchScreen from './screens/ProductSearchScreen';

import { seedAllergyCatalog } from './database/allergyCatalog';
import { initializeDatabase } from './database/db';

import {
  User,
  registerUser,
  loginUser,
  watchCurrentUser,
  logoutUser,
} from './database/auth';

const GREEN = '#183D32';
const BLUE = '#172B4D';
const CREAM = '#F7F5EF';

type Tab = 'stores' | 'home' | 'products' | 'allergies' | 'settings';

export default function App() {
  const [homeShopEntry, setHomeShopEntry] = useState<{ productId?: string; categoryId?: string }>({});
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [storeSessionOwner, setStoreSessionOwner] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [profileSyncMessage, setProfileSyncMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const localUserId = user?.id;
  useEffect(() => {
    if (localUserId === undefined) setStoreSessionOwner(null);
    else if (activeTab === 'stores') setStoreSessionOwner(localUserId);
  }, [activeTab, localUserId]);

  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;
    async function start() {
      try {
        await initializeDatabase();
        await seedAllergyCatalog();
        if (!alive) return;
        stop = watchCurrentUser(next => {
          if (!alive) return;
          setUser(next);
          setReady(true);
        }, () => {
          if (alive) { setReady(true); Alert.alert('Session unavailable', 'Connect to the internet and sign in again. Local data is preserved.'); }
        });
      } catch {
        if (alive) { setReady(true); Alert.alert('Startup error', 'Check the Supabase configuration and database setup. Local data is preserved.'); }
      }
    }
    void start();
    return () => { alive = false; stop?.(); };
  }, []);

  const accountId = user?.supabaseId;
  const syncActiveProfile = useEffectEvent(() => user ? syncCloudProfile(user) : Promise.resolve());

  // Pull/push account selections at navigation boundaries; errors keep the local copy.
  useEffect(() => {
    let alive = true;
    if (accountId && !recovering) {
      const sync = syncActiveProfile();
      if (activeTab === 'allergies') {
        setProfileSyncing(true);
        void waitForProfileSync(sync).then(status => {
          if (!alive) return;
          setProfileSyncMessage(status === 'synced' ? null : status === 'offline'
            ? 'Cloud sync unavailable. Showing your saved local profile.'
            : 'Showing your local profile while sync continues. Reopen this tab after syncing to see remote updates.');
          setProfileSyncing(false);
        });
      } else void sync.catch(() => undefined);
    }
    return () => { alive = false; };
  }, [accountId, activeTab, recovering]);

  function navigate(tab: Tab) {
    if (tab === activeTab) return;
    if (tab === 'products') setHomeShopEntry({});
    setProfileSyncing(tab === 'allergies');
    setActiveTab(tab);
  }

  async function handleSubmit() {
    if (loading) return;

    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!username.trim()) {
        Alert.alert('Missing Information', 'Enter a username.');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      const signedInUser =
        mode === 'signup'
          ? await registerUser(username, email, password)
          : await loginUser(email, password);

      if (!signedInUser && mode === 'signup') Alert.alert('Signup pending', 'Supabase did not return a signed-in session. Check the project signup settings before trying again. Your old local account remains unchanged.');
      setActiveTab('home');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert(
        mode === 'signup' ? 'Signup Failed' : 'Login Failed',
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
      setUser(null);
      setActiveTab('home');
      setPassword('');
      setConfirmPassword('');
      setMode('login');
      setEmail('');
      setUsername('');
    } catch {
      Alert.alert('Error', 'Could not log out.');
    }
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.subtitle}>Loading FoodBuddy...</Text>
      </View>
    );
  }

  if (user && !recovering) {
    return (
      <SafeAreaView key={user.supabaseId} style={styles.container}>
        <View style={styles.screen}>
          {(activeTab === 'stores' || storeSessionOwner === user.id) && <View style={styles.storeLayer}
            pointerEvents={activeTab === 'stores' ? 'auto' : 'none'} accessibilityElementsHidden={activeTab !== 'stores'}
            importantForAccessibility={activeTab === 'stores' ? 'auto' : 'no-hide-descendants'}>
            <NearbyStoresScreen userId={user.id} isActive={activeTab === 'stores'} onBack={() => setActiveTab('home')} />
          </View>}
          {activeTab !== 'stores' && <View style={styles.foregroundLayer}>
            {activeTab === 'settings' ? <SettingsScreen user={user} onUserUpdated={next => setUser(current => current?.supabaseId === next.supabaseId ? next : current)} onLogout={handleLogout} />
              : activeTab === 'allergies' ? profileSyncing ? <View style={styles.center} accessibilityLiveRegion="polite"><ActivityIndicator color={GREEN} /><Text style={styles.subtitle}>Opening your allergy profile…</Text></View>
                : <View style={styles.screen}>{profileSyncMessage && <Text accessibilityLiveRegion="polite" style={styles.syncNotice}>{profileSyncMessage}</Text>}<AllergyProfileScreen key={user.supabaseId} userId={user.id} /></View>
              : activeTab === 'products' ? <ProductSearchScreen initialProductId={homeShopEntry.productId} initialCategoryId={homeShopEntry.categoryId} userId={user.id} onBack={() => setActiveTab('home')} />
              : <HomeScreen userId={user.id} username={user.username} onProducts={destination => { setHomeShopEntry(destination ?? {}); setActiveTab('products'); }}
                  onStores={() => setActiveTab('stores')} onAllergies={() => navigate('allergies')} />}
          </View>}
        </View>
        <View style={styles.tabBar}>
          {([{ id: 'home', label: 'Home', icon: '⌂' }, { id: 'products', label: 'Shop', icon: '⌕' },
            { id: 'stores', label: 'Stores', icon: '⌖' }, { id: 'allergies', label: 'Allergies', icon: '♡' },
            { id: 'settings', label: 'Settings', icon: '⚙︎' }] as const).map(tab => <TouchableOpacity key={tab.id}
              accessibilityRole="tab" accessibilityLabel={`Navigate to ${tab.label}`} accessibilityState={{ selected: activeTab === tab.id }}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]} onPress={() => navigate(tab.id)}>
              <Text accessible={false} maxFontSizeMultiplier={1.3} style={[styles.tabIcon, activeTab === tab.id && styles.activeTabText]}>{tab.icon}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.3} style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>)}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.authContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>FoodBuddy 🌿</Text>

        <Text style={styles.heading}>
          {mode === 'signup'
            ? 'Create Account'
            : 'Welcome Back!'}
        </Text>

        <Text style={styles.subtitle}>
          {mode === 'signup'
            ? 'Find food that works for you.'
            : 'Log in to your FoodBuddy account.'}
        </Text>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            accessibilityLabel="Username"
            placeholder="Username"
            placeholderTextColor="#53645F"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
        )}

        <TextInput
          style={styles.input}
          accessibilityLabel="Email address"
          placeholder="Email"
          placeholderTextColor="#53645F"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          accessibilityLabel="Password"
          placeholder="Password"
          placeholderTextColor="#53645F"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            accessibilityLabel="Confirm password"
            placeholder="Confirm Password"
            placeholderTextColor="#53645F"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}

        <TouchableOpacity
          style={[
            styles.authButton,
            loading && styles.disabledButton,
          ]}
          accessibilityRole="button" accessibilityLabel={mode === 'signup' ? 'Sign up' : 'Log in'} accessibilityState={{ disabled: loading, busy: loading }}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.authButtonText}>
              {mode === 'signup' ? 'Sign Up' : 'Log In'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.subtitle}>Use your Supabase email and password on any device. Existing local accounts are preserved; after signing in, Settings can verify and copy supported legacy allergy selections.</Text>
        {recoveryOpen ? <PasswordRecovery onDone={() => setRecoveryOpen(false)} onRecoveryMode={setRecovering} /> :
          <TouchableOpacity accessibilityRole="button" style={styles.switchButton} onPress={() => setRecoveryOpen(true)}><Text style={styles.switchText}>Forgot password?</Text></TouchableOpacity>}
        <TouchableOpacity
          style={styles.switchButton}
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setPassword('');
            setConfirmPassword('');
          }}
        >
          <Text style={styles.switchText}>
            {mode === 'login'
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Log In'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  syncNotice: { color: '#704018', backgroundColor: '#FFF1D6', padding: 12, fontSize: 13, lineHeight: 20 },
  storeLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  foregroundLayer: { flex: 1, backgroundColor: CREAM },
  activeTab: { backgroundColor: '#EAF1E9' },
  tabIcon: { color: '#53645F', fontSize: 23 },
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CREAM,
  },
  home: {
    padding: 22,
    paddingBottom: 45,
  },
  header: {
    marginBottom: 30,
  },
  logo: {
    fontSize: 29,
    fontWeight: 'bold',
    color: GREEN,
  },
  tagline: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  heading: {
    fontSize: 26,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E5E0',
    borderRadius: 15,
    padding: 17,
    marginTop: 6,
    marginBottom: 20,
  },
  searchText: {
    color: '#777',
    fontSize: 14,
  },
  featureCard: {
    backgroundColor: GREEN,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 30,
    marginBottom: 15,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  featureDescription: {
    color: '#E3EEE8',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 20,
  },
  featureLink: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    minHeight: 145,
  },
  quickIcon: {
    fontSize: 25,
    marginBottom: 12,
  },
  quickTitle: {
    color: BLUE,
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 6,
  },
  quickDescription: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    borderRadius: 14,
    gap: 3,
    paddingVertical: 5,
  },
  tabText: {
    maxWidth: '100%',
    fontSize: 11,
    color: '#53645F',
    fontWeight: '500',
  },
  activeTabText: {
    color: GREEN,
    fontWeight: 'bold',
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: BLUE,
    marginBottom: 14,
  },
  authButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    padding: 17,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchButton: {
    minHeight: 44, justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  switchText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
});
