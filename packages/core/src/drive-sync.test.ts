import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPrayerAppBackupPayload,
  createTimestampedValue,
  mergePrayerAppBackupPayload,
  mergePrayerLogStores,
  mergeTimestampedValue,
} from './drive-sync';
import { getDefaultPrayerNotificationPreferences } from './notifications';
import { getDefaultPrayerPreferences } from './prayer';
import { createPrayerLogDay } from './tracking';
import type { PrayerAppBackupPayload } from './types';

test('createTimestampedValue helper encapsulates data with a time anchor', () => {
  const updatedAt = '2026-03-25T12:00:00.000Z';
  const result = createTimestampedValue('test-value', updatedAt);

  assert.equal(result.value, 'test-value');
  assert.equal(result.updatedAt, updatedAt);
});

test('mergeTimestampedValue picks the latest value based on ISO timestamps', () => {
  const older = createTimestampedValue('old', '2026-03-24T12:00:00.000Z');
  const newer = createTimestampedValue('new', '2026-03-25T12:00:00.000Z');

  assert.deepEqual(mergeTimestampedValue(older, newer), newer);
  assert.deepEqual(mergeTimestampedValue(newer, older), newer);
});

test('mergeTimestampedValue prefers non-null values if timestamps are identical and option is set', () => {
  const t1 = '2026-03-25T12:00:00.000Z';
  const v1 = createTimestampedValue(null, t1);
  const v2 = createTimestampedValue({ coords: '1,2' }, t1);

  assert.deepEqual(mergeTimestampedValue(v1, v2, { preferNonNullOnEqual: true }), v2);
});

test('mergePrayerLogStores performs a union of prayer completions across days', () => {
  const d1 = '2026-03-24';
  const d2 = '2026-03-25';

  const local = {
    [d1]: { ...createPrayerLogDay(d1), prayers: { Fajr: true, Sunrise: false, Dhuhr: true, Asr: false, Maghrib: false, Isha: false } },
  };
  const remote = {
    [d1]: { ...createPrayerLogDay(d1), prayers: { Fajr: false, Sunrise: true, Dhuhr: true, Asr: false, Maghrib: false, Isha: false } },
    [d2]: { ...createPrayerLogDay(d2), prayers: { Fajr: true, Sunrise: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true } },
  };

  const merged = mergePrayerLogStores(local, remote);

  assert.equal(merged[d1]?.prayers.Fajr, true);
  assert.equal(merged[d1]?.prayers.Sunrise, true);
  assert.equal(merged[d1]?.prayers.Dhuhr, true);
  assert.equal(merged[d2]?.prayers.Isha, true);
});

test('mergePrayerAppBackupPayload orchestrates a deep merge of app state', () => {
  const t1 = '2026-01-01T00:00:00.000Z';
  const t2 = '2026-03-25T12:00:00.000Z';

  const baseBackup: PrayerAppBackupPayload = {
    exportedAt: t1,
    notificationPreferences: createTimestampedValue(getDefaultPrayerNotificationPreferences(), t1),
    prayerLogs: createTimestampedValue({}, t1),
    prayerPreferences: createTimestampedValue(getDefaultPrayerPreferences(), t1),
    savedLocation: createTimestampedValue(null, t1),
    themePreference: createTimestampedValue('system', t1),
    version: 1,
  };

  const local = {
    ...baseBackup,
    themePreference: createTimestampedValue('dark' as const, t2),
  };

  const remote = {
    ...baseBackup,
    prayerPreferences: createTimestampedValue({ ...getDefaultPrayerPreferences(), timeFormat: '24h' as const }, t2),
  };

  const merged = mergePrayerAppBackupPayload(local, remote);

  assert.equal(merged.themePreference.value, 'dark');
  assert.equal(merged.prayerPreferences.value.timeFormat, '24h');
  assert.equal(merged.exportedAt, t2);
});
