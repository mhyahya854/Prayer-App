import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createTimestampedValue,
  getDefaultThemePreference,
  syncEpochTimestamp,
  type AppThemePreference,
  type TimestampedValue,
} from '@prayer-app/core';

const themePreferenceStorageKey = 'prayer-app.theme-preference';
const themeStorageVersion = 1;

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
