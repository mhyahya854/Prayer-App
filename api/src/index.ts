import { pathToFileURL } from 'node:url';

import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  type ApiErrorResponse,
  type GoogleDriveAuthCompleteRequest,
  type GoogleDriveAuthStartRequest,
  type GoogleDriveBackupUpsertRequest,
  type NotificationDisableRequest,
  type NotificationRefreshRequest,
  type NotificationSyncRequest,
  computePrayerDay,
  getDefaultPrayerPreferences,
  type ApiHealthResponse,
  type PrayerTimesResponse,
} from '@prayer-app/core';
import Fastify, { type FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';

import { apiConfig, apiConfigValidationErrors, runtimeStatus } from './config';
import { googleDriveAuthCompleteBodySchema, googleDriveAuthStartBodySchema, googleDriveBackupUpsertBodySchema, googleDriveExportDocumentBodySchema } from './google-drive/schema';
import { buildRedirectUrl, GoogleDriveService } from './google-drive/service';
import { createGoogleDriveAuthStore } from './google-drive/store';
import { createNotificationService, type NotificationService } from './notifications/service';
import { createNotificationStore } from './notifications/store';

const prayerQuerySchema = z.object({
  asrAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  calculationMethod: z
    .enum([
      'muslim-world-league',
      'egyptian',
      'karachi',
      'umm-al-qura',
      'north-america',
      'singapore',
      'qatar',
      'turkey',
    ])
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dhuhrAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  fajrAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  ishaAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  latitude: z.coerce.number().min(-90).max(90),
  locationLabel: z.string().trim().min(1).max(120).optional(),
  longitude: z.coerce.number().min(-180).max(180),
  madhab: z.enum(['shafi', 'hanafi']).optional(),
  maghribAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  sunriseAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  timeZone: z.string().trim().min(1).max(120).optional(),
});

const calculationMethodSchema = z.enum([
  'muslim-world-league',
  'egyptian',
  'karachi',
  'umm-al-qura',
  'north-america',
  'singapore',
  'qatar',
  'turkey',
]);

const prayerPreferencesSchema = z.object({
  adjustments: z.object({
    fajr: z.number().int().min(-30).max(30),
    sunrise: z.number().int().min(-30).max(30),
    dhuhr: z.number().int().min(-30).max(30),
    asr: z.number().int().min(-30).max(30),
    maghrib: z.number().int().min(-30).max(30),
    isha: z.number().int().min(-30).max(30),
  }),
  calculationMethod: calculationMethodSchema,
  madhab: z.enum(['shafi', 'hanafi']),
});

const notificationPreferencesSchema = z.object({
  enabledPrayers: z.object({
    Fajr: z.boolean(),
    Sunrise: z.boolean(),
    Dhuhr: z.boolean(),
    Asr: z.boolean(),
    Maghrib: z.boolean(),
    Isha: z.boolean(),
  }),
  preReminderMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.null()]),
});

const savedLocationSchema = z.object({
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  label: z.string().trim().min(1).max(120),
  source: z.enum(['device', 'manual']),
  timeZone: z.string().trim().min(1).max(120).nullable(),
  timeZoneSource: z.enum(['geo', 'manual', 'device-fallback']),
  updatedAt: z.string().trim().min(1),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(1),
  expirationTime: z.number().nullable(),
  keys: z.object({
    auth: z.string().trim().min(1),
    p256dh: z.string().trim().min(1),
  }),
});

const notificationSyncBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  notificationPreferences: notificationPreferencesSchema,
  platform: z.literal('web'),
  prayerPreferences: prayerPreferencesSchema,
  pushSubscription: pushSubscriptionSchema,
  savedLocation: savedLocationSchema,
});

const notificationRefreshBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  notificationPreferences: notificationPreferencesSchema,
  platform: z.literal('web'),
  prayerPreferences: prayerPreferencesSchema,
  savedLocation: savedLocationSchema,
});

const notificationDisableBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  platform: z.literal('web'),
});

const googleDriveCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  error_description: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1),
});

interface ApiRateLimitConfig {
  max: number;
  timeWindow: string;
}

type ReadinessCheckStatus = 'fail' | 'pass' | 'skipped';

interface ApiReadinessResponse {
  checks: {
    config: ReadinessCheckStatus;
    database: ReadinessCheckStatus;
    webPush: ReadinessCheckStatus;
  };
  errors: string[];
  service: 'prayer-app-api';
  status: 'not_ready' | 'ready';
}

const apiRateLimitConfig: ApiRateLimitConfig = {
  max: 60,
  timeWindow: '1 minute',
};

function createApiErrorResponse(code: string, message: string, details?: unknown): ApiErrorResponse {
  return {
    error: {
      code,
      ...(details === undefined ? {} : { details }),
      message,
    },
  };
}

function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return reply.code(statusCode).send(createApiErrorResponse(code, message, details));
}

function getErrorProperty(error: unknown, key: string) {
  if (typeof error !== 'object' || error === null || !(key in error)) {
    return undefined;
  }

  return (error as Record<string, unknown>)[key];
}

function createDefaultNotificationService() {
  return createNotificationService({
    notificationWorkerIntervalMs: apiConfig.notificationWorkerIntervalMs,
    store: createNotificationStore(apiConfig.databaseUrl, {
      stage: apiConfig.stage,
    }),
    webPush: {
      subject: apiConfig.webPushSubject,
      vapidPrivateKey: apiConfig.webPushPrivateKey,
      vapidPublicKey: apiConfig.webPushPublicKey,
    },
  });
}

async function checkDatabaseConnectivity(connectionString: string) {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 3_000,
    max: 1,
  });

  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function createDefaultGoogleDriveService() {
  return new GoogleDriveService(
    {
      clientId: apiConfig.googleClientId,
      clientSecret: apiConfig.googleClientSecret,
      redirectUri: apiConfig.googleRedirectUri,
    },
    createGoogleDriveAuthStore(apiConfig.databaseUrl),
  );
}

function getSessionTokenFromHeaders(headers: Record<string, unknown>) {
  const rawHeader = headers['x-prayer-app-session'];

  if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
    return rawHeader.trim();
  }

  if (Array.isArray(rawHeader)) {
    const token = rawHeader.find((value) => typeof value === 'string' && value.trim().length > 0);
    return typeof token === 'string' ? token.trim() : null;
  }

  return null;
}

export function buildServer(options?: {
  enableNotificationWorker?: boolean;
  googleDriveService?: GoogleDriveService | null;
  notificationService?: NotificationService | null;
  rateLimit?: Partial<ApiRateLimitConfig>;
}) {
  const app = Fastify({
    logger: true,
  });
  const notificationService = options?.notificationService ?? createDefaultNotificationService();
  const googleDriveService = options?.googleDriveService ?? createDefaultGoogleDriveService();
  const effectiveRateLimit = {
    ...apiRateLimitConfig,
    ...options?.rateLimit,
  };

  if (options?.enableNotificationWorker) {
    const stopWorker = notificationService.startWorker();
    app.addHook('onClose', async () => {
      stopWorker();
    });
  }

  void app.register(cors, {
    origin:
      apiConfig.stage === 'production'
        ? apiConfig.allowedOrigins.length > 0
          ? apiConfig.allowedOrigins
          : false
        : true,
  });
  app.setErrorHandler((error, _request, reply) => {
    const rawStatusCode = getErrorProperty(error, 'statusCode');
    const rawCode = getErrorProperty(error, 'code');
    const rawMessage = getErrorProperty(error, 'message');
    const rawMax = getErrorProperty(error, 'max');
    const rawTtl = getErrorProperty(error, 'ttl');
    const statusCode = typeof rawStatusCode === 'number' && rawStatusCode >= 400 ? rawStatusCode : 500;
    const isRateLimited = statusCode === 429;
    const errorCode = isRateLimited
      ? 'rate_limited'
      : typeof rawCode === 'string'
        ? rawCode
        : 'internal_error';
    const message = isRateLimited
      ? 'Too many API requests. Please try again shortly.'
      : statusCode >= 500
        ? 'Unexpected server error.'
        : typeof rawMessage === 'string'
          ? rawMessage
          : 'Request failed.';
    const details = isRateLimited
      ? {
          ...(typeof rawMax === 'number' ? { max: rawMax } : {}),
          ...(typeof rawTtl === 'number' ? { retryAfterMs: rawTtl } : {}),
        }
      : undefined;

    reply.code(statusCode).send(createApiErrorResponse(errorCode, message, details));
  });

  app.get('/health', async (): Promise<ApiHealthResponse> => ({
    service: 'prayer-app-api',
    status: 'ok',
  }));

  app.get('/ready', async (_request, reply): Promise<ApiReadinessResponse | void> => {
    const errors = [...apiConfigValidationErrors];
    let databaseStatus: ReadinessCheckStatus = 'skipped';
    let webPushStatus: ReadinessCheckStatus = 'skipped';

    const requiresStrictReadiness = apiConfig.stage !== 'development';

    if (requiresStrictReadiness) {
      if (!apiConfig.databaseUrl) {
        databaseStatus = 'fail';
      } else {
        const databaseReady = await checkDatabaseConnectivity(apiConfig.databaseUrl);
        databaseStatus = databaseReady ? 'pass' : 'fail';

        if (!databaseReady) {
          errors.push('DATABASE_URL is configured but the database is not reachable.');
        }
      }

      const hasWebPushConfig = Boolean(
        apiConfig.webPushPublicKey && apiConfig.webPushPrivateKey && apiConfig.webPushSubject,
      );
      webPushStatus = hasWebPushConfig ? 'pass' : 'fail';
    }

    const response: ApiReadinessResponse = {
      checks: {
        config: errors.length === 0 ? 'pass' : 'fail',
        database: databaseStatus,
        webPush: webPushStatus,
      },
      errors,
      service: 'prayer-app-api',
      status: errors.length === 0 && databaseStatus !== 'fail' && webPushStatus !== 'fail' ? 'ready' : 'not_ready',
    };

    if (response.status !== 'ready') {
      return reply.code(503).send(response);
    }

    return response;
  });

  void app.register(
    async (api) => {
      await api.register(rateLimit, {
        ...effectiveRateLimit,
        global: true,
      });

      api.get('/runtime', async () => runtimeStatus);

      api.get('/prayers/today', async (request, reply): Promise<PrayerTimesResponse | void> => {
        const queryResult = prayerQuerySchema.safeParse(request.query);

        if (!queryResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_prayer_query',
            'Invalid prayer calculation input.',
            queryResult.error.flatten().fieldErrors,
          );
          return;
        }

        const defaults = getDefaultPrayerPreferences();
        const query = queryResult.data;

        return computePrayerDay({
          coordinates: {
            latitude: query.latitude,
            longitude: query.longitude,
          },
          date: query.date ? undefined : new Date(),
          dateKey: query.date,
          locationLabel: query.locationLabel ?? `${query.latitude.toFixed(3)}, ${query.longitude.toFixed(3)}`,
          preferences: {
            ...defaults,
            adjustments: {
              ...defaults.adjustments,
              fajr: query.fajrAdjustment ?? defaults.adjustments.fajr,
              sunrise: query.sunriseAdjustment ?? defaults.adjustments.sunrise,
              dhuhr: query.dhuhrAdjustment ?? defaults.adjustments.dhuhr,
              asr: query.asrAdjustment ?? defaults.adjustments.asr,
              maghrib: query.maghribAdjustment ?? defaults.adjustments.maghrib,
              isha: query.ishaAdjustment ?? defaults.adjustments.isha,
            },
            calculationMethod: query.calculationMethod ?? defaults.calculationMethod,
            madhab: query.madhab ?? defaults.madhab,
          },
          timeZone: query.timeZone,
        });
      });

      api.post('/notifications/web/sync', async (request, reply) => {
        const bodyResult = notificationSyncBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_notification_sync_request',
            'Invalid web notification sync payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        return notificationService.syncWebPush(bodyResult.data as NotificationSyncRequest);
      });

      api.post('/notifications/web/refresh', async (request, reply) => {
        const bodyResult = notificationRefreshBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_notification_refresh_request',
            'Invalid web notification refresh payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        return notificationService.refreshWebPush(bodyResult.data as NotificationRefreshRequest);
      });

      api.post('/notifications/web/disable', async (request, reply) => {
        const bodyResult = notificationDisableBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_notification_disable_request',
            'Invalid web notification disable payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        return notificationService.disableWebPush(bodyResult.data as NotificationDisableRequest);
      });

      api.post('/google/auth/start', async (request, reply) => {
        const bodyResult = googleDriveAuthStartBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_google_auth_start_request',
            'Invalid Google auth start payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        try {
          return await googleDriveService.startAuth(bodyResult.data as GoogleDriveAuthStartRequest);
        } catch (error) {
          sendApiError(
            reply,
            error instanceof Error && error.message.includes('not configured') ? 503 : 502,
            'google_auth_start_failed',
            error instanceof Error ? error.message : 'Unable to start Google authentication.',
          );
          return;
        }
      });

      api.get('/google/callback', async (request, reply) => {
        const queryResult = googleDriveCallbackQuerySchema.safeParse(request.query);

        if (!queryResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_google_callback_request',
            'Invalid Google callback query.',
            queryResult.error.flatten().fieldErrors,
          );
          return;
        }

        const redirectUriForState = await googleDriveService.getRedirectUriForState(queryResult.data.state);

        try {
          const redirectUrl = await googleDriveService.finishAuthorization({
            code: queryResult.data.code,
            error: queryResult.data.error,
            errorDescription: queryResult.data.error_description,
            state: queryResult.data.state,
          });

          return reply.redirect(
            buildRedirectUrl(redirectUrl, {
              state: queryResult.data.state,
              status: 'success',
            }),
          );
        } catch (error) {
          if (!redirectUriForState) {
            sendApiError(
              reply,
              400,
              'google_auth_callback_failed',
              error instanceof Error ? error.message : 'Google authentication failed.',
            );
            return;
          }

          return reply.redirect(
            buildRedirectUrl(redirectUriForState, {
              error: error instanceof Error ? error.message : 'Google authentication failed.',
              state: queryResult.data.state,
              status: 'error',
            }),
          );
        }
      });

      api.post('/google/auth/complete', async (request, reply) => {
        const bodyResult = googleDriveAuthCompleteBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_google_auth_complete_request',
            'Invalid Google auth completion payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        const response = await googleDriveService.completeAuth(
          bodyResult.data as GoogleDriveAuthCompleteRequest,
        );

        if (!response) {
          sendApiError(
            reply,
            400,
            'google_auth_not_ready',
            'Google authentication has not finished yet or the state has expired.',
          );
          return;
        }

        return response;
      });

      api.get('/google/session', async (request, reply) => {
        const sessionToken = getSessionTokenFromHeaders(request.headers as Record<string, unknown>);

        if (!sessionToken) {
          sendApiError(reply, 401, 'missing_google_session', 'Google session token is required.');
          return;
        }

        const session = await googleDriveService.getSession(sessionToken);
        if (!session) {
          sendApiError(reply, 401, 'invalid_google_session', 'Google session is no longer valid.');
          return;
        }

        return session;
      });

      api.delete('/google/session', async (request, reply) => {
        const sessionToken = getSessionTokenFromHeaders(request.headers as Record<string, unknown>);

        if (!sessionToken) {
          sendApiError(reply, 401, 'missing_google_session', 'Google session token is required.');
          return;
        }

        await googleDriveService.disconnect(sessionToken);
        return {
          connected: false,
        };
      });

      api.get('/google/drive/backup', async (request, reply) => {
        const sessionToken = getSessionTokenFromHeaders(request.headers as Record<string, unknown>);

        if (!sessionToken) {
          sendApiError(reply, 401, 'missing_google_session', 'Google session token is required.');
          return;
        }

        try {
          return await googleDriveService.fetchBackup(sessionToken);
        } catch (error) {
          sendApiError(
            reply,
            error instanceof Error && error.message.includes('no longer available') ? 401 : 502,
            'google_drive_backup_fetch_failed',
            error instanceof Error ? error.message : 'Unable to fetch the Drive backup.',
          );
          return;
        }
      });

      api.put('/google/drive/backup', async (request, reply) => {
        const sessionToken = getSessionTokenFromHeaders(request.headers as Record<string, unknown>);

        if (!sessionToken) {
          sendApiError(reply, 401, 'missing_google_session', 'Google session token is required.');
          return;
        }

        const bodyResult = googleDriveBackupUpsertBodySchema.safeParse(request.body);
        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_google_drive_backup_payload',
            'Invalid Drive backup payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        try {
          return await googleDriveService.upsertBackup(
            sessionToken,
            (bodyResult.data as GoogleDriveBackupUpsertRequest).backup,
          );
        } catch (error) {
          sendApiError(
            reply,
            error instanceof Error && error.message.includes('no longer available') ? 401 : 502,
            'google_drive_backup_upsert_failed',
            error instanceof Error ? error.message : 'Unable to update the Drive backup.',
          );
          return;
        }
      });

      api.post('/google/drive/export-document', async (request, reply) => {
        const sessionToken = getSessionTokenFromHeaders(request.headers as Record<string, unknown>);

        if (!sessionToken) {
          sendApiError(reply, 401, 'missing_google_session', 'Google session token is required.');
          return;
        }

        const bodyResult = googleDriveExportDocumentBodySchema.safeParse(request.body);
        if (!bodyResult.success) {
          sendApiError(
            reply,
            400,
            'invalid_google_drive_export_payload',
            'Invalid document export payload.',
            bodyResult.error.flatten().fieldErrors,
          );
          return;
        }

        try {
          return await googleDriveService.exportDocument(sessionToken, bodyResult.data);
        } catch (error) {
          sendApiError(
            reply,
            error instanceof Error && error.message.includes('no longer available') ? 401 : 502,
            'google_drive_export_failed',
            error instanceof Error ? error.message : 'Unable to export document to Drive.',
          );
          return;
        }
      });

      api.get('/overview', async (_, reply) => {
        sendApiError(
          reply,
          501,
          'not_implemented',
          'Overview API is not implemented yet. Prayer times are real; Quran and dua APIs are still backlog work.',
        );
      });

      api.get('/quran/featured', async (_, reply) => {
        sendApiError(reply, 501, 'not_implemented', 'Quran API is not implemented yet.');
      });

      api.get('/duas/collections', async (_, reply) => {
        sendApiError(reply, 501, 'not_implemented', 'Dua API is not implemented yet.');
      });

      api.get('/dashboard', async (_, reply) => {
        sendApiError(reply, 501, 'not_implemented', 'Dashboard aggregation API is not implemented yet.');
      });
    },
    { prefix: '/api' },
  );

  return app;
}

async function start() {
  if (apiConfigValidationErrors.length > 0) {
    for (const error of apiConfigValidationErrors) {
      console.error(`[config] ${error}`);
    }

    process.exit(1);
  }

  const app = buildServer({
    enableNotificationWorker: true,
  });

  try {
    await app.listen({ host: apiConfig.host, port: apiConfig.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const entryFile = process.argv[1];
const isMain = entryFile ? import.meta.url === pathToFileURL(entryFile).href : false;

if (isMain) {
  void start();
}
