import assert from 'node:assert/strict';
import test from 'node:test';

import { createTimestampedValue } from '@prayer-app/core';

import {
  createNotificationStoragePayload,
  parseNotificationInstallationIdPayload,
  parseNotificationPreferencesPayload,
} from './notification-storage-schema';

test('legacy notification preferences are migrated into versioned storage', () => {
  const parsed = parseNotificationPreferencesPayload({
    enabledPrayers: {
      Fajr: true,
      Dhuhr: false,
      Asr: true,
      Maghrib: true,
      Isha: false,
    },
    preReminderMinutes: 15,
  });

  assert.equal(parsed.shouldPersist, true);
  assert.equal(parsed.data.value.enabledPrayers.Dhuhr, false);
  assert.equal(parsed.data.value.preReminderMinutes, 15);
});

test('invalid notification preference payloads fall back safely', () => {
  const parsed = parseNotificationPreferencesPayload({
    enabledPrayers: {
      Fajr: 'yes',
    },
    preReminderMinutes: 7,
  });

  assert.equal(parsed.data.value.enabledPrayers.Fajr, true);
  assert.equal(parsed.data.value.preReminderMinutes, null);
});

test('installation ids migrate cleanly and versioned payloads stay stable', () => {
  const legacyParsed = parseNotificationInstallationIdPayload('installation-123');
  const currentParsed = parseNotificationInstallationIdPayload(
    createNotificationStoragePayload(createTimestampedValue('installation-456')),
  );

  assert.equal(legacyParsed.shouldPersist, true);
  assert.equal(legacyParsed.data.value, 'installation-123');
  assert.equal(currentParsed.shouldPersist, false);
  assert.equal(currentParsed.data.value, 'installation-456');
});
