import {
  createTimestampedValue,
  getDefaultPrayerNotificationPreferences,
  notifiablePrayerNames,
  syncEpochTimestamp,
  type PrayerNotificationPreferences,
  type TimestampedValue,
} from '@prayer-app/core';

import { createVersionedPayload } from './prayer-storage-schema';

export const notificationStorageVersion = 2;

interface ParsedStorageValue<T> {
  data: TimestampedValue<T>;
  shouldPersist: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeNotificationPreferences(value: unknown): PrayerNotificationPreferences {
  const fallback = getDefaultPrayerNotificationPreferences();

  if (!isRecord(value)) {
    return fallback;
  }

  const enabledPrayers = isRecord(value.enabledPrayers) ? value.enabledPrayers : {};
  const rawPreReminderMinutes = value.preReminderMinutes;

  return {
    enabledPrayers: {
      Fajr: typeof enabledPrayers.Fajr === 'boolean' ? enabledPrayers.Fajr : fallback.enabledPrayers.Fajr,
      Sunrise:
        typeof enabledPrayers.Sunrise === 'boolean'
          ? enabledPrayers.Sunrise
          : fallback.enabledPrayers.Sunrise,
      Dhuhr: typeof enabledPrayers.Dhuhr === 'boolean' ? enabledPrayers.Dhuhr : fallback.enabledPrayers.Dhuhr,
      Asr: typeof enabledPrayers.Asr === 'boolean' ? enabledPrayers.Asr : fallback.enabledPrayers.Asr,
      Maghrib:
        typeof enabledPrayers.Maghrib === 'boolean'
          ? enabledPrayers.Maghrib
          : fallback.enabledPrayers.Maghrib,
      Isha: typeof enabledPrayers.Isha === 'boolean' ? enabledPrayers.Isha : fallback.enabledPrayers.Isha,
    },
    preReminderMinutes:
      rawPreReminderMinutes === 10 ||
      rawPreReminderMinutes === 15 ||
      rawPreReminderMinutes === 20 ||
      rawPreReminderMinutes === 30
        ? rawPreReminderMinutes
        : null,
  };
}

function sanitizeInstallationId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isTimestampedValue(value: unknown): value is TimestampedValue<unknown> {
  return isRecord(value) && typeof value.updatedAt === 'string' && 'value' in value;
}

function parseVersionedNotificationValue<T>(
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

  if (isRecord(value) && typeof value.version === 'number' && 'data' in value) {
    if (isTimestampedValue(value.data)) {
      return {
        data: createTimestampedValue(sanitize(value.data.value), value.data.updatedAt),
        shouldPersist: value.version !== notificationStorageVersion,
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

export function parseNotificationPreferencesPayload(
  value: unknown,
): ParsedStorageValue<PrayerNotificationPreferences> {
  return parseVersionedNotificationValue(value, sanitizeNotificationPreferences, getDefaultPrayerNotificationPreferences());
}

export function parseNotificationInstallationIdPayload(value: unknown): ParsedStorageValue<string | null> {
  return parseVersionedNotificationValue(value, sanitizeInstallationId, null);
}

export function createNotificationStoragePayload<T>(data: TimestampedValue<T>) {
  return createVersionedPayload(data);
}

export function createPrayerNotificationPreferenceRecord(enabled = true) {
  return Object.fromEntries(notifiablePrayerNames.map((prayerName) => [prayerName, enabled])) as PrayerNotificationPreferences['enabledPrayers'];
}
