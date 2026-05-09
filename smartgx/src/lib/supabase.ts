import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Expo SecureStore warns above ~2048 bytes; large auth JSON goes to AsyncStorage. */
const SECURE_VALUE_MAX = 1900;
const largeKeyFlag = (k: string) => `${k}.smartgx_large`;

/** Native: small values in SecureStore; session blobs in AsyncStorage to avoid size limit. */
const NativeHybridAuthStorage = {
  getItem: async (key: string) => {
    const useLarge = await AsyncStorage.getItem(largeKeyFlag(key));
    if (useLarge === "1") return AsyncStorage.getItem(key);
    const secure = await SecureStore.getItemAsync(key);
    if (secure != null) return secure;
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (value.length > SECURE_VALUE_MAX) {
      await SecureStore.deleteItemAsync(key).catch(() => {});
      await AsyncStorage.setItem(largeKeyFlag(key), "1");
      await AsyncStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.removeItem(largeKeyFlag(key));
    await AsyncStorage.removeItem(key);
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    await AsyncStorage.removeItem(largeKeyFlag(key));
    await AsyncStorage.removeItem(key);
  },
};

const WebStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

const SupabaseStorage = Platform.OS === "web" ? WebStorageAdapter : NativeHybridAuthStorage;

let client: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) {
    console.warn(
      "[SmartGX] Supabase env missing: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in smartgx/.env"
    );
  }
} else {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: SupabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabase(): SupabaseClient | null {
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(client);
}
