import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleDriveAccount } from '@prayer-app/core';

const googleDriveSessionStorageKey = 'prayer-app.google-drive-session';

export interface StoredGoogleDriveSessionSnapshot {
  account: GoogleDriveAccount;
  sessionToken: string;
}

type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let cachedSecureStore: SecureStoreLike | null | undefined = undefined;

async function resolveSecureStore(): Promise<SecureStoreLike | null> {
  if (cachedSecureStore !== undefined) return cachedSecureStore;

  try {
    // dynamic import so package is optional at runtime
    const mod = await import('expo-secure-store');
    const api: any = (mod && (mod.default ?? mod)) as SecureStoreLike;
    if (api && typeof api.getItemAsync === 'function') {
      cachedSecureStore = api as SecureStoreLike;
      return cachedSecureStore;
    }
  } catch {
    // expo-secure-store not available, fall back to AsyncStorage
  }

  cachedSecureStore = null;
  return null;
}

async function readFromAsyncStorage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(googleDriveSessionStorageKey);
  } catch {
    return null;
  }
}

async function writeToAsyncStorage(value: string) {
  await AsyncStorage.setItem(googleDriveSessionStorageKey, value);
}

async function removeFromAsyncStorage() {
  await AsyncStorage.removeItem(googleDriveSessionStorageKey);
}

export async function loadGoogleDriveSessionSnapshot(): Promise<StoredGoogleDriveSessionSnapshot | null> {
  // Prefer secure store when available. If content exists in AsyncStorage but not in SecureStore,
  // migrate it into SecureStore and remove from AsyncStorage.
  const secure = await resolveSecureStore();

  if (secure) {
    try {
      const secureValue = await secure.getItemAsync(googleDriveSessionStorageKey);
      if (secureValue) {
        return parseSnapshot(secureValue);
      }
    } catch {
      // ignore and fallback to AsyncStorage
    }
  }

  const rawValue = await readFromAsyncStorage();
  if (!rawValue) return null;

  const parsed = parseSnapshot(rawValue);
  if (!parsed) return null;

  // Attempt migration to secure store if available
  if (secure) {
    try {
      await secure.setItemAsync(googleDriveSessionStorageKey, JSON.stringify(parsed));
      await removeFromAsyncStorage();
    } catch {
      // ignore migration failures — still return parsed value
    }
  }

  return parsed;
}

export async function saveGoogleDriveSessionSnapshot(snapshot: StoredGoogleDriveSessionSnapshot) {
  const payload = JSON.stringify(snapshot);
  const secure = await resolveSecureStore();
  if (secure) {
    try {
      await secure.setItemAsync(googleDriveSessionStorageKey, payload);
      // best-effort: remove from AsyncStorage
      await removeFromAsyncStorage();
      return;
    } catch {
      // fall through to AsyncStorage
    }
  }

  await writeToAsyncStorage(payload);
}

export async function clearGoogleDriveSessionSnapshot() {
  const secure = await resolveSecureStore();
  if (secure) {
    try {
      await secure.deleteItemAsync(googleDriveSessionStorageKey);
    } catch {
      // ignore
    }
  }

  await removeFromAsyncStorage();
}

function parseSnapshot(rawValue: string): StoredGoogleDriveSessionSnapshot | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredGoogleDriveSessionSnapshot>;
    if (
      typeof parsed?.sessionToken !== 'string' ||
      typeof parsed?.account?.subject !== 'string' ||
      typeof parsed?.account?.email !== 'string'
    ) {
      return null;
    }

    return {
      account: {
        email: parsed.account.email,
        name: typeof parsed.account.name === 'string' ? parsed.account.name : null,
        pictureUrl: typeof parsed.account.pictureUrl === 'string' ? parsed.account.pictureUrl : null,
        subject: parsed.account.subject,
      },
      sessionToken: parsed.sessionToken,
    };
  } catch {
    return null;
  }
}
