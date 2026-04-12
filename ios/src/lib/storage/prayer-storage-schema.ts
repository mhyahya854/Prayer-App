import {
  createTimestampedValue,
  createPrayerLogDay,
  getDefaultPrayerPreferences,
  syncEpochTimestamp,
  trackablePrayerNames,
  type PrayerLogStore,
  type PrayerPreferences,
  type SavedLocation,
  type TimestampedValue,
} from '@prayer-app/core';

export const prayerStorageVersion = 2;

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

function sanitizePrayerPreferences(value: unknown): PrayerPreferences {
  const fallback = getDefaultPrayerPreferences();

  if (!isRecord(value)) {
    return fallback;
  }

  const calculationMethod =
    typeof value.calculationMethod === 'string' ? value.calculationMethod : fallback.calculationMethod;
  const madhab = typeof value.madhab === 'string' ? value.madhab : fallback.madhab;
  const adjustments = isRecord(value.adjustments) ? value.adjustments : {};

  return {
    adjustments: {
      fajr: typeof adjustments.fajr === 'number' ? adjustments.fajr : fallback.adjustments.fajr,
      sunrise:
        typeof adjustments.sunrise === 'number' ? adjustments.sunrise : fallback.adjustments.sunrise,
      dhuhr: typeof adjustments.dhuhr === 'number' ? adjustments.dhuhr : fallback.adjustments.dhuhr,
      asr: typeof adjustments.asr === 'number' ? adjustments.asr : fallback.adjustments.asr,
      maghrib:
        typeof adjustments.maghrib === 'number' ? adjustments.maghrib : fallback.adjustments.maghrib,
      isha: typeof adjustments.isha === 'number' ? adjustments.isha : fallback.adjustments.isha,
    },
    calculationMethod:
      calculationMethod === 'muslim-world-league' ||
      calculationMethod === 'egyptian' ||
      calculationMethod === 'karachi' ||
      calculationMethod === 'umm-al-qura' ||
      calculationMethod === 'north-america' ||
      calculationMethod === 'singapore' ||
      calculationMethod === 'qatar' ||
      calculationMethod === 'turkey'
        ? calculationMethod
        : fallback.calculationMethod,
    madhab: madhab === 'hanafi' || madhab === 'shafi' ? madhab : fallback.madhab,
  };
}

function sanitizePrayerLogs(value: unknown): PrayerLogStore {
  if (!isRecord(value)) {
    return {};
  }

  const nextStore: PrayerLogStore = {};
  for (const [dateKey, rawLog] of Object.entries(value)) {
    if (!isRecord(rawLog) || !isRecord(rawLog.prayers)) {
      continue;
    }

    const nextLog = createPrayerLogDay(dateKey);
    for (const prayerName of trackablePrayerNames) {
      const rawValue = rawLog.prayers[prayerName];
      nextLog.prayers[prayerName] = typeof rawValue === 'boolean' ? rawValue : false;
    }

    nextStore[dateKey] = nextLog;
  }

  return nextStore;
}

function sanitizeSavedLocation(value: unknown): SavedLocation | null {
  if (!isRecord(value) || !isRecord(value.coordinates)) {
    return null;
  }

  const latitude = value.coordinates.latitude;
  const longitude = value.coordinates.longitude;

  if (
    typeof latitude !== 'number' ||
    Number.isNaN(latitude) ||
    typeof longitude !== 'number' ||
    Number.isNaN(longitude)
  ) {
    return null;
  }

  const source = value.source === 'manual' || value.source === 'device' ? value.source : 'device';
  const timeZoneSource =
    value.timeZoneSource === 'geo' ||
    value.timeZoneSource === 'manual' ||
    value.timeZoneSource === 'device-fallback'
      ? value.timeZoneSource
      : source === 'manual'
        ? 'manual'
        : 'device-fallback';

  return {
    coordinates: {
      latitude,
      longitude,
    },
    label: typeof value.label === 'string' ? value.label : 'Saved location',
    source,
    timeZone: typeof value.timeZone === 'string' ? value.timeZone : null,
    timeZoneSource,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

function parseVersionedValue<T>(
  value: unknown,
  sanitize: (input: unknown) => T,
  fallback: T,
): ParsedStorageValue<T> {
  const fallbackSnapshot = createTimestampedValue(fallback, syncEpochTimestamp);

  if (value === null || value === undefined) {
    return {
      data: fallbackSnapshot,
      shouldPersist: false,
    };
  }

  if (isVersionedEnvelope(value)) {
    if (isTimestampedValue(value.data)) {
      return {
        data: createTimestampedValue(sanitize(value.data.value), value.data.updatedAt),
        shouldPersist: value.version !== prayerStorageVersion,
      };
    }

    return {
      data: createTimestampedValue(sanitize(value.data), syncEpochTimestamp),
      shouldPersist: true,
    };
  }

  if (isTimestampedValue(value)) {
    return {
      data: createTimestampedValue(sanitize(value.value), value.updatedAt),
      shouldPersist: true,
    };
  }

  return {
    data: createTimestampedValue(sanitize(value), syncEpochTimestamp),
    shouldPersist: true,
  };
}

export function createVersionedPayload<T>(data: TimestampedValue<T>): VersionedEnvelope<TimestampedValue<T>> {
  return {
    data,
    version: prayerStorageVersion,
  };
}

export function parsePrayerPreferencesPayload(value: unknown): ParsedStorageValue<PrayerPreferences> {
  return parseVersionedValue(value, sanitizePrayerPreferences, getDefaultPrayerPreferences());
}

export function parsePrayerLogsPayload(value: unknown): ParsedStorageValue<PrayerLogStore> {
  return parseVersionedValue(value, sanitizePrayerLogs, {});
}

export function parseSavedLocationPayload(value: unknown): ParsedStorageValue<SavedLocation | null> {
  return parseVersionedValue(value, sanitizeSavedLocation, null);
}
