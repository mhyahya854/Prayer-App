import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTimestampedValue,
  type PrayerNotificationPreferences,
  type TimestampedValue,
} from '@prayer-app/core';

import {
  createNotificationStoragePayload,
  parseNotificationInstallationIdPayload,
  parseNotificationPreferencesPayload,
} from './notification-storage-schema';

const notificationPreferencesStorageKey = 'prayer-app.notification-preferences';
const notificationInstallationIdStorageKey = 'prayer-app.notification-installation';

export interface NotificationStorageSnapshot {
  installationId: string | null;
  notificationPreferences: TimestampedValue<PrayerNotificationPreferences>;
}

async function readJson(key: string) {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

export async function loadNotificationPreferences(): Promise<PrayerNotificationPreferences> {
  const snapshot = await loadNotificationPreferencesSnapshot();

  return snapshot.value;
}

export async function loadNotificationPreferencesSnapshot(): Promise<TimestampedValue<PrayerNotificationPreferences>> {
  const { data, shouldPersist } = parseNotificationPreferencesPayload(
    await readJson(notificationPreferencesStorageKey),
  );

  if (shouldPersist) {
    await saveNotificationPreferences(data.value, data.updatedAt);
  }

  return data;
}

export async function saveNotificationPreferences(
  preferences: PrayerNotificationPreferences,
  updatedAt = new Date().toISOString(),
) {
  await AsyncStorage.setItem(
    notificationPreferencesStorageKey,
    JSON.stringify(createNotificationStoragePayload(createTimestampedValue(preferences, updatedAt))),
  );
}

export async function loadNotificationInstallationId() {
  const { data, shouldPersist } = parseNotificationInstallationIdPayload(
    await readJson(notificationInstallationIdStorageKey),
  );

  if (shouldPersist && data.value) {
    await saveNotificationInstallationId(data.value);
  }

  return data.value;
}

export async function saveNotificationInstallationId(installationId: string) {
  await AsyncStorage.setItem(
    notificationInstallationIdStorageKey,
    JSON.stringify(createNotificationStoragePayload(createTimestampedValue(installationId))),
  );
}

export async function loadNotificationStorageSnapshot(): Promise<NotificationStorageSnapshot> {
  const [notificationPreferences, installationId] = await Promise.all([
    loadNotificationPreferencesSnapshot(),
    loadNotificationInstallationId(),
  ]);

  return {
    installationId,
    notificationPreferences,
  };
}
