import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the session token lives. On phones it goes in the secure keystore. The web build has no secure store (the
 * native module doesn't exist there and every call throws), so it uses localStorage instead.
 */
const web = Platform.OS === 'web';

export const tokenStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return web ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (web) { window.localStorage.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value);
  },
};
