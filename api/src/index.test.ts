import assert from 'node:assert/strict';
import test from 'node:test';

import { createSavedLocation, getDefaultPrayerNotificationPreferences, getDefaultPrayerPreferences } from '@prayer-app/core';

import { buildServer } from './index';
import type { MosqueSearchService } from './mosques/service';
import type { NotificationService } from './notifications/service';

const baseLocation = createSavedLocation(
  {
    latitude: 3.139,
    longitude: 101.6869,
  },
  'Kuala Lumpur',
  'Asia/Kuala_Lumpur',
  'manual',
  'manual',
);

function createNotificationServiceStub(): NotificationService {
  return {
    async disableWebPush(request) {
      return {
        installationId: request.installationId,
        scheduledJobCount: 0,
        success: true,
        webPushEnabled: false,
      };
    },
    async processDueJobs() {
      return 0;
    },
    async refreshWebPush(request) {
      return {
        installationId: request.installationId,
        scheduledJobCount: 4,
        success: true,
        webPushEnabled: true,
      };
    },
    async syncWebPush(request) {
      return {
        installationId: request.installationId,
        scheduledJobCount: 8,
        success: true,
        webPushEnabled: true,
      };
    },
    startWorker() {
      return () => undefined;
    },
  };
}

function createMosqueSearchServiceStub(): MosqueSearchService {
  return {
    async searchNearby() {
      return {
        providerErrors: {},
        providerStatus: {
          google: 'disabled',
          openstreetmap: 'ok',
        },
        results: [],
      };
    },
  };
}

test('invalid prayer query returns a stable 400 error envelope', async (t) => {
  const app = buildServer({
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/prayers/today?latitude=200&longitude=101.6869',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'invalid_prayer_query');
  assert.equal(payload.error.message, 'Invalid prayer calculation input.');
  assert.ok(payload.error.details.latitude);
});

test('unimplemented routes return the shared 501 error envelope', async (t) => {
  const app = buildServer({
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/quran/featured',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 501);
  assert.equal(payload.error.code, 'not_implemented');
  assert.equal(payload.error.message, 'Quran API is not implemented yet.');
});

test('api routes are rate limited with the shared error envelope', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
    rateLimit: {
      max: 1,
      timeWindow: '1 minute',
    },
  });
  t.after(async () => {
    await app.close();
  });

  const firstResponse = await app.inject({
    method: 'GET',
    url: '/api/runtime',
  });
  const secondResponse = await app.inject({
    method: 'GET',
    url: '/api/runtime',
  });
  const payload = secondResponse.json();

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 429);
  assert.equal(payload.error.code, 'rate_limited');
  assert.equal(payload.error.message, 'Too many API requests. Please try again shortly.');
});

test('readiness endpoint returns ready in development with baseline checks', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/ready',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.status, 'ready');
  assert.equal(payload.checks.config, 'pass');
  assert.equal(payload.checks.database, 'skipped');
  assert.equal(payload.checks.webPush, 'skipped');
});

test('web notification sync returns scheduled job counts', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    payload: {
      installationId: 'web-installation-1',
      notificationPreferences: getDefaultPrayerNotificationPreferences(),
      platform: 'web',
      prayerPreferences: getDefaultPrayerPreferences(),
      pushSubscription: {
        endpoint: 'https://example.com/push',
        expirationTime: null,
        keys: {
          auth: 'auth-token',
          p256dh: 'p256-token',
        },
      },
      savedLocation: baseLocation,
    },
    url: '/api/notifications/web/sync',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.scheduledJobCount, 8);
  assert.equal(payload.webPushEnabled, true);
});

test('invalid web notification payloads return the shared 400 envelope', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    payload: {
      installationId: '',
      platform: 'web',
    },
    url: '/api/notifications/web/disable',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'invalid_notification_disable_request');
});

test('invalid web notification sync payloads return the shared 400 envelope', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    payload: {
      installationId: 'web-installation-1',
      notificationPreferences: {
        enabledPrayers: {
          Fajr: true,
        },
        preReminderMinutes: 5,
      },
      platform: 'web',
      prayerPreferences: getDefaultPrayerPreferences(),
      pushSubscription: {
        endpoint: '',
        expirationTime: null,
        keys: {
          auth: '',
          p256dh: '',
        },
      },
      savedLocation: baseLocation,
    },
    url: '/api/notifications/web/sync',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'invalid_notification_sync_request');
});

test('invalid web notification refresh payloads return the shared 400 envelope', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'POST',
    payload: {
      installationId: 'web-installation-1',
      notificationPreferences: getDefaultPrayerNotificationPreferences(),
      platform: 'web',
      prayerPreferences: {
        ...getDefaultPrayerPreferences(),
        calculationMethod: 'invalid-method',
      },
      savedLocation: baseLocation,
    },
    url: '/api/notifications/web/refresh',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'invalid_notification_refresh_request');
});

test('runtime status is hidden outside development', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
    stage: 'production',
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/runtime',
  });

  assert.equal(response.statusCode, 404);
});

test('invalid mosque queries return the shared 400 envelope', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/mosques/nearby?latitude=3.139&longitude=101.6869&radiusKm=5',
  });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'invalid_mosque_query');
});
