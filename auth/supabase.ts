import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createSecureSessionStorage } from './secureSessionStorage';
import { validateSupabaseConfig } from './config';

let client: SupabaseClient | undefined;
let serial = 0;
/** Lazy initialization keeps missing configuration from breaking offline catalog startup. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const config = validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const storage = createSecureSessionStorage({
    getItem: key => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    removeItem: key => SecureStore.deleteItemAsync(key),
  }, () => `${Date.now().toString(36)}-${++serial}-${Math.random().toString(36).slice(2)}`);
  client = createClient(config.url, config.key, {
    auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      storageKey: `foodbuddy.auth.${new URL(config.url).hostname}`, lock: processLock },
  });
  return client;
}
