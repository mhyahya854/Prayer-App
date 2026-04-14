import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTimestampedValue,
  getDefaultThemePreference,
  syncEpochTimestamp,
  type AppThemePreference,
  type TimestampedValue,
} from '@prayer-app/core';

const themePreferenceStorageKey = 'prayer-app.theme-preference';
const themeAccentStorageKey = 'prayer-app.theme-accent';
const themeStorageVersion = 1;
export type ThemeAccent = 'default' | 'gold' | 'emerald' | 'rose' | 'sky' | 'violet';

interface VersionedEnvelope<T> {
  data: T;
  version: number;
}

interface ParsedStorageValue<T> {
  data: TimestampedValue<T>;
  shouldPersist: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVersionedEnvelope(value: unknown): value is VersionedEnvelope<unknown> {
  return isRecord(value) && typeof value.version === 'number' && 'data' in value;
}

function isTimestampedValue(value: unknown): value is TimestampedValue<unknown> {
  return isRecord(value) && typeof value.updatedAt === 'string' && 'value' in value;
}

function isThemePreference(value: unknown): value is AppThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isThemeAccent(value: unknown): value is ThemeAccent {
  return (
    value === 'default' ||
    value === 'gold' ||
    value === 'emerald' ||
    value === 'rose' ||
    value === 'sky' ||
    value === 'violet'
  );
}

function parseThemePreference(value: unknown): ParsedStorageValue<AppThemePreference> {
  const fallback = createTimestampedValue(getDefaultThemePreference(), syncEpochTimestamp);

  if (value === null || value === undefined) {
    return {
      data: fallback,
      shouldPersist: false,
    };
  }

  if (isVersionedEnvelope(value)) {
    if (isTimestampedValue(value.data) && isThemePreference(value.data.value)) {
      return {
        data: createTimestampedValue(value.data.value, value.data.updatedAt),
        shouldPersist: value.version !== themeStorageVersion,
      };
    }

    if (isThemePreference(value.data)) {
      return {
        data: createTimestampedValue(value.data, syncEpochTimestamp),
        shouldPersist: true,
      };
    }
  }

  if (isTimestampedValue(value) && isThemePreference(value.value)) {
    return {
      data: createTimestampedValue(value.value, value.updatedAt),
      shouldPersist: true,
    };
  }

  if (isThemePreference(value)) {
    return {
      data: createTimestampedValue(value, syncEpochTimestamp),
      shouldPersist: true,
    };
  }

  return {
    data: fallback,
    shouldPersist: true,
  };
}

async function readJson() {
  const rawValue = await AsyncStorage.getItem(themePreferenceStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

async function readAccentJson() {
  const rawValue = await AsyncStorage.getItem(themeAccentStorageKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
}

function parseThemeAccent(value: unknown): ParsedStorageValue<ThemeAccent> {
  const fallback = createTimestampedValue<ThemeAccent>('default', syncEpochTimestamp);

  if (value === null || value === undefined) {
    return {
      data: fallback,
      shouldPersist: false,
    };
  }

  if (isVersionedEnvelope(value)) {
    if (isTimestampedValue(value.data) && isThemeAccent(value.data.value)) {
      return {
        data: createTimestampedValue(value.data.value, value.data.updatedAt),
        shouldPersist: value.version !== themeStorageVersion,
      };
    }

    if (isThemeAccent(value.data)) {
      return {
        data: createTimestampedValue(value.data, syncEpochTimestamp),
        shouldPersist: true,
      };
    }
  }

  if (isTimestampedValue(value) && isThemeAccent(value.value)) {
    return {
      data: createTimestampedValue(value.value, value.updatedAt),
      shouldPersist: true,
    };
  }

  if (isThemeAccent(value)) {
    return {
      data: createTimestampedValue(value, syncEpochTimestamp),
      shouldPersist: true,
    };
  }

  return {
    data: fallback,
    shouldPersist: true,
  };
}

function createThemeAccentStoragePayload(value: TimestampedValue<ThemeAccent>): VersionedEnvelope<TimestampedValue<ThemeAccent>> {
  return {
    data: value,
    version: themeStorageVersion,
  };
}

export async function loadThemeAccentSnapshot(): Promise<TimestampedValue<ThemeAccent>> {
  const { data, shouldPersist } = parseThemeAccent(await readAccentJson());

  if (shouldPersist) {
    await saveThemeAccent(data.value, data.updatedAt);
  }

  return data;
}

export async function saveThemeAccent(
  accent: ThemeAccent,
  updatedAt = new Date().toISOString(),
) {
  await AsyncStorage.setItem(
    themeAccentStorageKey,
    JSON.stringify(createThemeAccentStoragePayload(createTimestampedValue(accent, updatedAt))),
  );
}

function createThemeStoragePayload(value: TimestampedValue<AppThemePreference>): VersionedEnvelope<TimestampedValue<AppThemePreference>> {
  return {
    data: value,
    version: themeStorageVersion,
  };
}

export async function loadThemePreferenceSnapshot(): Promise<TimestampedValue<AppThemePreference>> {
  const { data, shouldPersist } = parseThemePreference(await readJson());

  if (shouldPersist) {
    await saveThemePreference(data.value, data.updatedAt);
  }

  return data;
}

export async function saveThemePreference(
  preference: AppThemePreference,
  updatedAt = new Date().toISOString(),
) {
  await AsyncStorage.setItem(
    themePreferenceStorageKey,
    JSON.stringify(createThemeStoragePayload(createTimestampedValue(preference, updatedAt))),
  );
}
