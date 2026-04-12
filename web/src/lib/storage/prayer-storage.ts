import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTimestampedValue,
  type PrayerLogStore,
  type PrayerPreferences,
  type SavedLocation,
  type TimestampedValue,
} from '@prayer-app/core';

import {
  createVersionedPayload,
  parsePrayerLogsPayload,
  parsePrayerPreferencesPayload,
  parseSavedLocationPayload,
} from './prayer-storage-schema';

const prayerPreferencesStorageKey = 'prayer-app.prayer-preferences';
const prayerLogsStorageKey = 'prayer-app.prayer-logs';
const savedLocationStorageKey = 'prayer-app.saved-location';

export interface PrayerStorageSnapshot {
  prayerLogs: TimestampedValue<PrayerLogStore>;
  prayerPreferences: TimestampedValue<PrayerPreferences>;
  savedLocation: TimestampedValue<SavedLocation | null>;
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

export async function loadPrayerPreferences(): Promise<PrayerPreferences> {
  const snapshot = await loadPrayerPreferencesSnapshot();

  return snapshot.value;
}

export async function loadPrayerPreferencesSnapshot(): Promise<TimestampedValue<PrayerPreferences>> {
  const { data, shouldPersist } = parsePrayerPreferencesPayload(await readJson(prayerPreferencesStorageKey));

  if (shouldPersist) {
    await savePrayerPreferences(data.value, data.updatedAt);
  }

  return data;
}

export async function savePrayerPreferences(preferences: PrayerPreferences, updatedAt = new Date().toISOString()) {
  await AsyncStorage.setItem(
    prayerPreferencesStorageKey,
    JSON.stringify(createVersionedPayload(createTimestampedValue(preferences, updatedAt))),
  );
}

export async function loadPrayerLogs(): Promise<PrayerLogStore> {
  const snapshot = await loadPrayerLogsSnapshot();

  return snapshot.value;
}

export async function loadPrayerLogsSnapshot(): Promise<TimestampedValue<PrayerLogStore>> {
  const { data, shouldPersist } = parsePrayerLogsPayload(await readJson(prayerLogsStorageKey));

  if (shouldPersist) {
    await savePrayerLogs(data.value, data.updatedAt);
  }

  return data;
}

export async function savePrayerLogs(store: PrayerLogStore, updatedAt = new Date().toISOString()) {
  await AsyncStorage.setItem(
    prayerLogsStorageKey,
    JSON.stringify(createVersionedPayload(createTimestampedValue(store, updatedAt))),
  );
}

export async function loadSavedLocation(): Promise<SavedLocation | null> {
  const snapshot = await loadSavedLocationSnapshot();

  return snapshot.value;
}

export async function loadSavedLocationSnapshot(): Promise<TimestampedValue<SavedLocation | null>> {
  const { data, shouldPersist } = parseSavedLocationPayload(await readJson(savedLocationStorageKey));

  if (shouldPersist) {
    await saveSavedLocation(data.value, data.updatedAt);
  }

  return data;
}

export async function saveSavedLocation(
  location: SavedLocation | null,
  updatedAt = location?.updatedAt ?? new Date().toISOString(),
) {
  const snapshotLocation =
    location && location.updatedAt === updatedAt ? location : location ? { ...location, updatedAt } : null;

  await AsyncStorage.setItem(
    savedLocationStorageKey,
    JSON.stringify(createVersionedPayload(createTimestampedValue(snapshotLocation, updatedAt))),
  );
}

export async function loadPrayerStorageSnapshot(): Promise<PrayerStorageSnapshot> {
  const [prayerPreferences, prayerLogs, savedLocation] = await Promise.all([
    loadPrayerPreferencesSnapshot(),
    loadPrayerLogsSnapshot(),
    loadSavedLocationSnapshot(),
  ]);

  return {
    prayerLogs,
    prayerPreferences,
    savedLocation,
  };
}
