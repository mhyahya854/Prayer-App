import assert from 'node:assert/strict';
import test from 'node:test';

import { createTimestampedValue } from '@prayer-app/core';

import {
  createVersionedPayload,
  parsePrayerLogsPayload,
  parsePrayerPreferencesPayload,
  parseSavedLocationPayload,
  prayerStorageVersion,
} from './prayer-storage-schema';

test('legacy prayer preferences are migrated into the versioned schema', () => {
  const parsed = parsePrayerPreferencesPayload({
    adjustments: {
      fajr: 3,
    },
    calculationMethod: 'singapore',
    madhab: 'hanafi',
  });

  assert.equal(parsed.shouldPersist, true);
  assert.equal(parsed.data.value.calculationMethod, 'singapore');
  assert.equal(parsed.data.value.madhab, 'hanafi');
  assert.equal(parsed.data.value.adjustments.fajr, 3);
});

test('legacy prayer logs preserve stored completions during migration', () => {
  const parsed = parsePrayerLogsPayload({
    '2026-03-25': {
      prayers: {
        Fajr: true,
        Dhuhr: true,
        Asr: false,
        Maghrib: true,
        Isha: false,
      },
    },
  });

  assert.equal(parsed.shouldPersist, true);
  assert.deepEqual(parsed.data.value['2026-03-25']?.prayers, {
    Asr: false,
    Dhuhr: true,
    Fajr: true,
    Isha: false,
    Maghrib: true,
  });
});

test('legacy saved locations get an honest timezone source during migration', () => {
  const parsed = parseSavedLocationPayload({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    label: 'Kuala Lumpur',
    source: 'device',
    timeZone: 'Asia/Kuala_Lumpur',
    updatedAt: '2026-03-25T00:00:00.000Z',
  });

  assert.equal(parsed.shouldPersist, true);
  assert.equal(parsed.data.value?.timeZoneSource, 'device-fallback');
});

test('current versioned payloads do not require migration', () => {
  const parsed = parseSavedLocationPayload(
    createVersionedPayload(createTimestampedValue({
      coordinates: {
        latitude: 3.139,
        longitude: 101.6869,
      },
      label: 'Manual location',
      source: 'manual',
      timeZone: 'Asia/Kuala_Lumpur',
      timeZoneSource: 'manual',
      updatedAt: '2026-03-25T00:00:00.000Z',
    })),
  );

  assert.equal(parsed.shouldPersist, false);
  assert.equal(parsed.data.value?.timeZoneSource, 'manual');
  assert.equal(createVersionedPayload(createTimestampedValue({ ok: true })).version, prayerStorageVersion);
});
