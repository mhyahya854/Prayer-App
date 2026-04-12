import { getDefaultPrayerNotificationPreferences } from './notifications';
import { getDefaultPrayerPreferences } from './prayer';
import { createPrayerLogDay, trackablePrayerNames } from './tracking';
import type {
  AppThemePreference,
  PrayerAppBackupPayload,
  PrayerLogDay,
  PrayerLogStore,
  TimestampedValue,
} from './types';

export const prayerAppBackupVersion = 1;
export const syncEpochTimestamp = '1970-01-01T00:00:00.000Z';

export function getDefaultThemePreference(): AppThemePreference {
  return 'system';
}

export function createTimestampedValue<T>(value: T, updatedAt = new Date().toISOString()): TimestampedValue<T> {
  return {
    updatedAt,
    value,
  };
}

function getLatestUpdatedAt(values: Array<TimestampedValue<unknown>>) {
  return values.reduce(
    (latest, value) => (getTimestamp(value.updatedAt) > getTimestamp(latest) ? value.updatedAt : latest),
    syncEpochTimestamp,
  );
}

export function createPrayerAppBackupPayload(input: {
  exportedAt?: string;
  notificationPreferences: TimestampedValue<PrayerAppBackupPayload['notificationPreferences']['value']>;
  prayerLogs: TimestampedValue<PrayerLogStore>;
  prayerPreferences: TimestampedValue<PrayerAppBackupPayload['prayerPreferences']['value']>;
  savedLocation: TimestampedValue<PrayerAppBackupPayload['savedLocation']['value']>;
  themePreference: TimestampedValue<AppThemePreference>;
}): PrayerAppBackupPayload {
  const exportedAt =
    input.exportedAt ??
    getLatestUpdatedAt([
      input.notificationPreferences,
      input.prayerLogs,
      input.prayerPreferences,
      input.savedLocation,
      input.themePreference,
    ]);

  return {
    exportedAt,
    notificationPreferences: input.notificationPreferences,
    prayerLogs: input.prayerLogs,
    prayerPreferences: input.prayerPreferences,
    savedLocation: input.savedLocation,
    themePreference: input.themePreference,
    version: prayerAppBackupVersion,
  };
}

function getTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isPrayerLogDayEmpty(log: PrayerLogDay | undefined) {
  if (!log) {
    return true;
  }

  return trackablePrayerNames.every((prayerName) => !log.prayers[prayerName]);
}

export function mergePrayerLogStores(local: PrayerLogStore, remote: PrayerLogStore): PrayerLogStore {
  const merged: PrayerLogStore = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const dateKey of keys) {
    const localDay = local[dateKey];
    const remoteDay = remote[dateKey];

    if (!localDay && !remoteDay) {
      continue;
    }

    const nextDay = createPrayerLogDay(dateKey);
    for (const prayerName of trackablePrayerNames) {
      nextDay.prayers[prayerName] = Boolean(
        localDay?.prayers[prayerName] || remoteDay?.prayers[prayerName],
      );
    }

    if (!isPrayerLogDayEmpty(nextDay) || localDay || remoteDay) {
      merged[dateKey] = nextDay;
    }
  }

  return merged;
}

export function mergeTimestampedValue<T>(
  local: TimestampedValue<T>,
  remote: TimestampedValue<T>,
  options?: {
    preferNonNullOnEqual?: boolean;
  },
): TimestampedValue<T> {
  const localTimestamp = getTimestamp(local.updatedAt);
  const remoteTimestamp = getTimestamp(remote.updatedAt);

  if (localTimestamp > remoteTimestamp) {
    return local;
  }

  if (remoteTimestamp > localTimestamp) {
    return remote;
  }

  if (options?.preferNonNullOnEqual) {
    if (local.value === null && remote.value !== null) {
      return remote;
    }

    if (remote.value === null && local.value !== null) {
      return local;
    }
  }

  return remote;
}

export function mergePrayerAppBackupPayload(
  local: PrayerAppBackupPayload,
  remote: PrayerAppBackupPayload,
): PrayerAppBackupPayload {
  const mergedPrayerLogs = createTimestampedValue(
    mergePrayerLogStores(local.prayerLogs.value, remote.prayerLogs.value),
    local.prayerLogs.updatedAt > remote.prayerLogs.updatedAt
      ? local.prayerLogs.updatedAt
      : remote.prayerLogs.updatedAt,
  );

  return createPrayerAppBackupPayload({
    notificationPreferences: mergeTimestampedValue(
      local.notificationPreferences,
      remote.notificationPreferences,
    ),
    prayerLogs: mergedPrayerLogs,
    prayerPreferences: mergeTimestampedValue(local.prayerPreferences, remote.prayerPreferences),
    savedLocation: mergeTimestampedValue(local.savedLocation, remote.savedLocation, {
      preferNonNullOnEqual: true,
    }),
    themePreference: mergeTimestampedValue(local.themePreference, remote.themePreference),
  });
}

export function hasMeaningfulPrayerAppBackupData(backup: PrayerAppBackupPayload) {
  if (backup.savedLocation.value) {
    return true;
  }

  if (backup.themePreference.value !== getDefaultThemePreference()) {
    return true;
  }

  if (JSON.stringify(backup.prayerPreferences.value) !== JSON.stringify(getDefaultPrayerPreferences())) {
    return true;
  }

  if (
    JSON.stringify(backup.notificationPreferences.value) !==
    JSON.stringify(getDefaultPrayerNotificationPreferences())
  ) {
    return true;
  }

  return Object.values(backup.prayerLogs.value).some((log) => !isPrayerLogDayEmpty(log));
}
