import assert from 'node:assert/strict';
import test from 'node:test';

import { buildServer } from '../index';
import type { MosqueSearchService } from '../mosques/service';
import type { NotificationService } from '../notifications/service';
import { BadRequestError } from '../errors';

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
        scheduledJobCount: 1,
        success: true,
        webPushEnabled: true,
      };
    },
    async syncWebPush(request) {
      return {
        installationId: request.installationId,
        scheduledJobCount: 1,
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

test('ApiError instances are serialized by global handler', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });

  app.get('/__test/bad-request', async () => {
    throw new BadRequestError('test bad request', 'test_bad_request', { some: 'detail' });
  });

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: 'GET', url: '/__test/bad-request' });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, 'test_bad_request');
  assert.equal(payload.error.message, 'test bad request');
  assert.deepEqual(payload.error.details, { some: 'detail' });
});

test('Unhandled errors map to 500 and generic message', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });

  app.get('/__test/unexpected', async () => {
    throw new Error('boom');
  });

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: 'GET', url: '/__test/unexpected' });
  const payload = response.json();

  assert.equal(response.statusCode, 500);
  assert.equal(payload.error.code, 'internal_error');
  assert.equal(payload.error.message, 'Unexpected server error.');
});

test('Legacy rate-limit style errors map to 429 envelope', async (t) => {
  const app = buildServer({
    mosqueSearchService: createMosqueSearchServiceStub(),
    notificationService: createNotificationServiceStub(),
  });

  app.get('/__test/rate', async () => {
    // throw a legacy error-like object that the global handler recognizes
    throw { statusCode: 429, max: 3, ttl: 1500 } as unknown;
  });

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: 'GET', url: '/__test/rate' });
  const payload = response.json();

  assert.equal(response.statusCode, 429);
  assert.equal(payload.error.code, 'rate_limited');
  assert.equal(payload.error.message, 'Too many API requests. Please try again shortly.');
  assert.equal(payload.error.details.max, 3);
  assert.equal(payload.error.details.retryAfterMs, 1500);
});
