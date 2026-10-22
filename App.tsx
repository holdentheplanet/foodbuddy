
import React, { useEffect, useState } from 'react';
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

import SettingsScreen from './screens/SettingsScreen';
import AllergyProfileScreen from './screens/AllergyProfileScreen';
import ProductSearchScreen from './screens/ProductSearchScreen';

import { seedAllergyCatalog } from './database/allergyCatalog';
import { initializeDatabase } from './database/db';

import {
  User,
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
} from './database/auth';

const GREEN = '#183D32';
const BLUE = '#172B4D';
const CREAM = '#F7F5EF';

type Tab = 'home' | 'products' | 'allergies' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function start() {
      try {
        await initializeDatabase();
        await seedAllergyCatalog();

        const savedUser = await getCurrentUser();
        setUser(savedUser);
      } catch (error) {
        console.error(error);
        Alert.alert('Startup Error', 'Could not load FoodBuddy.');
      } finally {
        setReady(true);
      }
    }

    start();
  }, []);

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

      setUser(signedInUser);
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

  if (user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screen}>
          {activeTab === 'settings' ? (
            <SettingsScreen
              user={user}
              onUserUpdated={setUser}
              onLogout={handleLogout}
            />
          ) : activeTab === 'allergies' ? (
            <AllergyProfileScreen userId={user.id} />
          ) : activeTab === 'products' ? (
            <ProductSearchScreen
  userId={user.id}
  onBack={() => setActiveTab('home')}
/>
          ) : (
            <ScrollView
              contentContainerStyle={styles.home}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Text style={styles.logo}>FoodBuddy 🌿</Text>
                <Text style={styles.tagline}>
                  Your allergy-friendly shopping companion
                </Text>
              </View>

              <Text style={styles.heading}>
                Hi, {user.username}! 👋
              </Text>

              <Text style={styles.subtitle}>
                Let's find food that works for you.
              </Text>

              <TouchableOpacity
                style={styles.searchBar}
                onPress={() => setActiveTab('products')}
                activeOpacity={0.8}
              >
                <Text style={styles.searchText}>
                  🔍 Search products, brands, ingredients...
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => setActiveTab('products')}
                activeOpacity={0.85}
              >
                <Text style={styles.featureIcon}>🛒</Text>

                <Text style={styles.featureTitle}>
                  Ingredient Checker
                </Text>

                <Text style={styles.featureDescription}>
                  Explore real grocery products, review ingredients,
                  and find potential allergy concerns.
                </Text>

                <Text style={styles.featureLink}>
                  Explore Products →
                </Text>
              </TouchableOpacity>

              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={styles.quickCard}
                  onPress={() => setActiveTab('allergies')}
                >
                  <Text style={styles.quickIcon}>🛡️</Text>
                  <Text style={styles.quickTitle}>My Allergies</Text>
                  <Text style={styles.quickDescription}>
                    Manage saved allergies
                  </Text>
                </TouchableOpacity>

                <View style={styles.quickCard}>
                  <Text style={styles.quickIcon}>📍</Text>
                  <Text style={styles.quickTitle}>Nearby Stores</Text>
                  <Text style={styles.quickDescription}>
                    Coming soon
                  </Text>
                </View>
              </View>

              <Text style={styles.footerNote}>
                Always check the product packaging before consuming
                food with allergies.
              </Text>
            </ScrollView>
          )}
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('home')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'home' && styles.activeTabText,
              ]}
            >
              🏠 Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('allergies')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'allergies' &&
                  styles.activeTabText,
              ]}
            >
              🛡️ Allergies
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('settings')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'settings' &&
                  styles.activeTabText,
              ]}
            >
              ⚙️ Settings
            </Text>
          </TouchableOpacity>
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
            placeholder="Username"
            placeholderTextColor="#777"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#777"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#777"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#777"
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

        <TouchableOpacity
          style={styles.switchButton}
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
    paddingVertical: 15,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    color: '#777',
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
    alignItems: 'center',
    marginTop: 24,
  },
  switchText: {
    color: GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
});
