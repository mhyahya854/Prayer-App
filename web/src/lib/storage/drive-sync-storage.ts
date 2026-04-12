import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleDriveAccount } from '@prayer-app/core';

const googleDriveSessionStorageKey = 'prayer-app.google-drive-session';

export interface StoredGoogleDriveSessionSnapshot {
  account: GoogleDriveAccount;
  sessionToken: string;
}

export async function loadGoogleDriveSessionSnapshot(): Promise<StoredGoogleDriveSessionSnapshot | null> {
  const rawValue = await AsyncStorage.getItem(googleDriveSessionStorageKey);

  if (!rawValue) {
    return null;
  }

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

export async function saveGoogleDriveSessionSnapshot(snapshot: StoredGoogleDriveSessionSnapshot) {
  await AsyncStorage.setItem(googleDriveSessionStorageKey, JSON.stringify(snapshot));
}

export async function clearGoogleDriveSessionSnapshot() {
  await AsyncStorage.removeItem(googleDriveSessionStorageKey);
}
