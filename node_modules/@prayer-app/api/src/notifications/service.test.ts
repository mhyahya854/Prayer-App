import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSavedLocation,
  getDefaultPrayerNotificationPreferences,
  getDefaultPrayerPreferences,
} from '@prayer-app/core';

import { createNotificationService } from './service';
import { createNotificationStore } from './store';

const savedLocation = createSavedLocation(
  {
    latitude: 3.139,
    longitude: 101.6869,
  },
  'Kuala Lumpur',
  'Asia/Kuala_Lumpur',
  'manual',
  'manual',
);

test('notification service stores and dispatches due jobs', async () => {
  const deliveredEndpoints: string[] = [];
  const service = createNotificationService({
    notificationWorkerIntervalMs: 60_000,
    sender: {
      configured: true,
      async send(job) {
        deliveredEndpoints.push(job.endpoint);
      },
    },
    store: createNotificationStore(),
    webPush: {
      subject: 'mailto:test@example.com',
      vapidPrivateKey: 'private',
      vapidPublicKey: 'public',
    },
  });

  const response = await service.syncWebPush({
    installationId: 'web-installation-1',
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    platform: 'web',
    prayerPreferences: getDefaultPrayerPreferences(),
    pushSubscription: {
      endpoint: 'https://example.com/push',
      expirationTime: null,
      keys: {
        auth: 'auth-key',
        p256dh: 'p256-key',
      },
    },
    savedLocation,
  });

  assert.equal(response.scheduledJobCount > 0, true);

  const sentCount = await service.processDueJobs(new Date('2099-12-31T23:59:59.000Z'));

  assert.equal(sentCount > 0, true);
  assert.equal(deliveredEndpoints.includes('https://example.com/push'), true);
});

test('refreshWebPush preserves the stored subscription and re-enqueues jobs', async () => {
  const deliveredEndpoints: string[] = [];
  const service = createNotificationService({
    notificationWorkerIntervalMs: 60_000,
    sender: {
      configured: true,
      async send(job) {
        deliveredEndpoints.push(job.endpoint);
      },
    },
    store: createNotificationStore(),
    webPush: {
      subject: 'mailto:test@example.com',
      vapidPrivateKey: 'private',
      vapidPublicKey: 'public',
    },
  });

  await service.syncWebPush({
    installationId: 'web-installation-refresh',
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    platform: 'web',
    prayerPreferences: getDefaultPrayerPreferences(),
    pushSubscription: {
      endpoint: 'https://example.com/refresh',
      expirationTime: null,
      keys: {
        auth: 'auth-key',
        p256dh: 'p256-key',
      },
    },
    savedLocation,
  });

  const refreshResponse = await service.refreshWebPush({
    installationId: 'web-installation-refresh',
    notificationPreferences: {
      ...getDefaultPrayerNotificationPreferences(),
      preReminderMinutes: 15,
    },
    platform: 'web',
    prayerPreferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    savedLocation,
  });

  const sentCount = await service.processDueJobs(new Date('2099-12-31T23:59:59.000Z'));

  assert.equal(refreshResponse.scheduledJobCount > 0, true);
  assert.equal(sentCount > 0, true);
  assert.equal(deliveredEndpoints.includes('https://example.com/refresh'), true);
});

test('disableWebPush clears pending jobs so future dispatches send nothing', async () => {
  const deliveredEndpoints: string[] = [];
  const service = createNotificationService({
    notificationWorkerIntervalMs: 60_000,
    sender: {
      configured: true,
      async send(job) {
        deliveredEndpoints.push(job.endpoint);
      },
    },
    store: createNotificationStore(),
    webPush: {
      subject: 'mailto:test@example.com',
      vapidPrivateKey: 'private',
      vapidPublicKey: 'public',
    },
  });

  await service.syncWebPush({
    installationId: 'web-installation-disable',
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    platform: 'web',
    prayerPreferences: getDefaultPrayerPreferences(),
    pushSubscription: {
      endpoint: 'https://example.com/disable',
      expirationTime: null,
      keys: {
        auth: 'auth-key',
        p256dh: 'p256-key',
      },
    },
    savedLocation,
  });

  const disableResponse = await service.disableWebPush({
    installationId: 'web-installation-disable',
    platform: 'web',
  });
  const sentCount = await service.processDueJobs(new Date('2099-12-31T23:59:59.000Z'));

  assert.equal(disableResponse.webPushEnabled, false);
  assert.equal(sentCount, 0);
  assert.deepEqual(deliveredEndpoints, []);
});

test('syncWebPush reports zero scheduled jobs when delivery infrastructure is not configured', async () => {
  const deliveredEndpoints: string[] = [];
  const service = createNotificationService({
    notificationWorkerIntervalMs: 60_000,
    sender: {
      configured: false,
      async send(job) {
        deliveredEndpoints.push(job.endpoint);
      },
    },
    store: createNotificationStore(),
    webPush: {
      subject: '',
      vapidPrivateKey: '',
      vapidPublicKey: '',
    },
  });

  const response = await service.syncWebPush({
    installationId: 'web-installation-unconfigured',
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    platform: 'web',
    prayerPreferences: getDefaultPrayerPreferences(),
    pushSubscription: {
      endpoint: 'https://example.com/unconfigured',
      expirationTime: null,
      keys: {
        auth: 'auth-key',
        p256dh: 'p256-key',
      },
    },
    savedLocation,
  });
  const sentCount = await service.processDueJobs(new Date('2099-12-31T23:59:59.000Z'));

  assert.equal(response.scheduledJobCount, 0);
  assert.equal(response.webPushEnabled, false);
  assert.equal(sentCount, 0);
  assert.deepEqual(deliveredEndpoints, []);
});
