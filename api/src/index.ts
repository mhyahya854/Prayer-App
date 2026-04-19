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
  type RuntimeResponse,
} from '@prayer-app/core';
import Fastify, { type FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';

import { apiConfig, apiConfigValidationErrors, createRuntimeStatus } from './config';
import { requireGoogleSession } from './auth';
import { ApiError, RateLimitError, isApiError, throwIfInvalid } from './errors';
import { googleDriveAuthCompleteBodySchema, googleDriveAuthStartBodySchema, googleDriveBackupUpsertBodySchema, googleDriveExportDocumentBodySchema } from './google-drive/schema';
import { buildRedirectUrl, GoogleDriveService } from './google-drive/service';
import { createGoogleDriveAuthStore } from './google-drive/store';
import { GoogleCalendarService } from './google-calendar/service';
import { googleCalendarSyncBodySchema } from './google-calendar/schema';
import { ContentService } from './content/service';
import { ApiMosqueSearchService, MosqueSearchUnavailableError, type MosqueSearchService } from './mosques/service';
import { createNotificationService, type NotificationService } from './notifications/service';
import { createNotificationStore } from './notifications/store';

import {
  calculationMethodSchema,
  notificationPreferencesSchema,
  prayerPreferencesSchema,
  savedLocationSchema,
} from './validation';
import {
  notificationDisableBodySchema,
  notificationRefreshBodySchema,
  notificationSyncBodySchema,
} from './notifications/validation';

const prayerQuerySchema = z.object({
  asrAdjustment: z.coerce.number().int().min(-30).max(30).optional(),
  calculationMethod: calculationMethodSchema.optional(),
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

const supportedMosqueRadiusOptions = [3, 7, 12, 20] as const;

const mosqueNearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce
    .number()
    .int()
    .refine(
      (value) => supportedMosqueRadiusOptions.includes(value as (typeof supportedMosqueRadiusOptions)[number]),
      'Radius must be one of 3, 7, 12, or 20 km.',
    ),
});

const googleDriveCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  error_description: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1),
});

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'must be a numeric id'),
});

const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

const bookChapterParamsSchema = z.object({
  bookSlug: z.string().trim().min(1).max(200),
  chapterId: z.string().regex(/^\d+$/, 'must be a numeric chapter id'),
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

function createDefaultMosqueSearchService() {
  return new ApiMosqueSearchService({
    googlePlacesApiKey: apiConfig.googlePlacesApiKey,
  });
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
  mosqueSearchService?: MosqueSearchService;
  googleCalendarService?: GoogleCalendarService;
  contentService?: ContentService;
  notificationService?: NotificationService | null;
  rateLimit?: Partial<ApiRateLimitConfig>;
  stage?: RuntimeResponse['stage'];
}) {
  const app = Fastify({
    logger: true,
    // Guardrail: limit request body size to prevent large blind uploads (1 MiB)
    bodyLimit: 1_048_576,
  });
  const effectiveStage = options?.stage ?? apiConfig.stage;
  const notificationService = options?.notificationService ?? createDefaultNotificationService();
  const googleDriveService = options?.googleDriveService ?? createDefaultGoogleDriveService();
  const googleCalendarService = options?.googleCalendarService ?? new GoogleCalendarService(
    { clientId: apiConfig.googleClientId, clientSecret: apiConfig.googleClientSecret },
    createGoogleDriveAuthStore(apiConfig.databaseUrl),
  );
  const contentService = options?.contentService ?? new ContentService();
  const mosqueSearchService = options?.mosqueSearchService ?? createDefaultMosqueSearchService();
  const runtimeStatus = {
    ...createRuntimeStatus(apiConfig),
    stage: effectiveStage,
  };
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
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'x-prayer-app-installation',
      'x-prayer-app-session',
      'x-prayer-app-platform',
    ],
    credentials: true,
    origin:
      effectiveStage === 'production' || effectiveStage === 'staging'
        ? apiConfig.allowedOrigins.length > 0
          ? apiConfig.allowedOrigins
          : false
        : true,
  });
  app.setErrorHandler((error, request, reply) => {
    // Prefer structured ApiError instances
    if (isApiError(error)) {
      const { statusCode, code, message, details } = error;

      if (statusCode >= 500) {
        request.log.error({ err: error, method: request.method, url: request.url }, `Unhandled server error: ${message}`);
      } else {
        request.log.info({ code, method: request.method, statusCode, url: request.url }, `API ${statusCode} response: ${message}`);
      }

      reply.code(statusCode).send(createApiErrorResponse(code, message, details));
      return;
    }

    // Zod validation errors should map to a stable validation envelope
    if (error instanceof z.ZodError) {
      const flattened = error.flatten();
      request.log.info({ method: request.method, url: request.url, validation: flattened.fieldErrors }, 'Validation error');
      reply.code(400).send(createApiErrorResponse('validation_error', 'Invalid request payload.', flattened.fieldErrors));
      return;
    }

    // Legacy / third-party errors (rate-limiting middleware) may expose statusCode, max, ttl
    const rawStatusCode = getErrorProperty(error, 'statusCode');
    const statusCode = typeof rawStatusCode === 'number' && rawStatusCode >= 400 ? rawStatusCode : 500;

    if (statusCode === 429) {
      const rawMax = getErrorProperty(error, 'max');
      const rawTtl = getErrorProperty(error, 'ttl');
      const details = {
        ...(typeof rawMax === 'number' ? { max: rawMax } : {}),
        ...(typeof rawTtl === 'number' ? { retryAfterMs: rawTtl } : {}),
      };

      request.log.info({ code: 'rate_limited', method: request.method, statusCode, url: request.url }, 'API 429 response: Too many API requests.');
      reply.code(429).send(createApiErrorResponse('rate_limited', 'Too many API requests. Please try again shortly.', Object.keys(details).length ? details : undefined));
      return;
    }

    // Fallback: best-effort extraction for message/code
    const rawCode = getErrorProperty(error, 'code');
    const rawMessage = getErrorProperty(error, 'message');
    const isClientError = statusCode >= 400 && statusCode < 500;

    const errorCode = typeof rawCode === 'string' ? rawCode : isClientError ? 'bad_request' : 'internal_error';
    const message = statusCode >= 500 ? 'Unexpected server error.' : typeof rawMessage === 'string' ? rawMessage : 'Request failed.';

    if (statusCode >= 500) {
      request.log.error({ err: error, method: request.method, url: request.url }, `Unhandled server error: ${message}`);
    } else {
      request.log.info({ code: errorCode, method: request.method, statusCode, url: request.url }, `API ${statusCode} response: ${message}`);
    }

    reply.code(statusCode).send(createApiErrorResponse(errorCode, message));
  });

  app.get('/health', async (): Promise<ApiHealthResponse> => ({
    service: 'prayer-app-api',
    status: 'ok',
  }));

  app.get('/ready', async (_request, reply): Promise<ApiReadinessResponse | void> => {
    const errors = [...apiConfigValidationErrors];
    let databaseStatus: ReadinessCheckStatus = 'skipped';
    let webPushStatus: ReadinessCheckStatus = 'skipped';

    const requiresStrictReadiness = effectiveStage !== 'development';

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

      api.get('/runtime', async (_request, reply) => {
        if (effectiveStage !== 'development') {
          return reply.code(404).send();
        }

        return runtimeStatus;
      });

      api.get('/prayers/today', async (request, reply): Promise<PrayerTimesResponse | void> => {
        const query = throwIfInvalid(prayerQuerySchema.safeParse(request.query), { code: 'invalid_prayer_query', message: 'Invalid prayer calculation input.' });

        const defaults = getDefaultPrayerPreferences();

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

      api.get('/mosques/nearby', async (request, reply) => {
        const query = throwIfInvalid(mosqueNearbyQuerySchema.safeParse(request.query), { code: 'invalid_mosque_query', message: 'Invalid mosque search input.' });

        try {
          return await mosqueSearchService.searchNearby(query);
        } catch (error) {
          if (error instanceof MosqueSearchUnavailableError) {
            sendApiError(
              reply,
              502,
              'mosque_search_unavailable',
              error.message,
              error.details,
            );
            return;
          }

          sendApiError(
            reply,
            502,
            'mosque_search_unavailable',
            'Mosque search is temporarily unavailable. Please try again shortly.',
          );
        }
      });

      api.post('/notifications/web/sync', async (request, reply) => {
        const body = throwIfInvalid<NotificationSyncRequest>(notificationSyncBodySchema.safeParse(request.body), { code: 'invalid_notification_sync_request', message: 'Invalid web notification sync payload.' });

        return notificationService.syncWebPush(body);
      });

      api.post('/notifications/web/refresh', async (request, reply) => {
        const body = throwIfInvalid<NotificationRefreshRequest>(notificationRefreshBodySchema.safeParse(request.body), { code: 'invalid_notification_refresh_request', message: 'Invalid web notification refresh payload.' });

        return notificationService.refreshWebPush(body);
      });

      api.post('/notifications/web/disable', async (request, reply) => {
        const body = throwIfInvalid<NotificationDisableRequest>(notificationDisableBodySchema.safeParse(request.body), { code: 'invalid_notification_disable_request', message: 'Invalid web notification disable payload.' });

        return notificationService.disableWebPush(body);
      });

      api.post('/google/auth/start', async (request, reply) => {
        const body = throwIfInvalid<GoogleDriveAuthStartRequest>(googleDriveAuthStartBodySchema.safeParse(request.body), { code: 'invalid_google_auth_start_request', message: 'Invalid Google auth start payload.' });

        try {
          return await googleDriveService.startAuth(body);
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
        const query = throwIfInvalid(googleDriveCallbackQuerySchema.safeParse(request.query), { code: 'invalid_google_callback_request', message: 'Invalid Google callback query.' });

        const redirectUriForState = await googleDriveService.getRedirectUriForState(query.state);

        try {
          const redirectUrl = await googleDriveService.finishAuthorization({
            code: query.code,
            error: query.error,
            errorDescription: query.error_description,
            state: query.state,
          });

          return reply.redirect(
            buildRedirectUrl(redirectUrl, {
              state: query.state,
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
              state: query.state,
              status: 'error',
            }),
          );
        }
      });

      api.post('/google/auth/complete', async (request, reply) => {
        const body = throwIfInvalid<GoogleDriveAuthCompleteRequest>(googleDriveAuthCompleteBodySchema.safeParse(request.body), { code: 'invalid_google_auth_complete_request', message: 'Invalid Google auth completion payload.' });

        const response = await googleDriveService.completeAuth(body);

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

      api.get('/google/session', { preHandler: [requireGoogleSession(googleDriveService)] }, async (request, _reply) => {
        const attached = (request as any).prayerAppGoogleSession;

        return {
          account: {
            email: attached.account.email,
            name: attached.account.name,
            pictureUrl: attached.account.pictureUrl,
            subject: attached.account.subject,
          },
          connected: true,
        };
      });

      api.delete('/google/session', { preHandler: [requireGoogleSession(googleDriveService)] }, async (request) => {
        const sessionToken = (request as any).prayerAppGoogleSession.sessionToken;
        await googleDriveService.disconnect(sessionToken);
        return {
          connected: false,
        };
      });

      api.get('/google/drive/backup', { preHandler: [requireGoogleSession(googleDriveService)] }, async (request, reply) => {
        const sessionToken = (request as any).prayerAppGoogleSession.sessionToken;

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

      api.put('/google/drive/backup', { preHandler: [requireGoogleSession(googleDriveService)] }, async (request, reply) => {
        const sessionToken = (request as any).prayerAppGoogleSession.sessionToken;
        const body = throwIfInvalid<GoogleDriveBackupUpsertRequest>(googleDriveBackupUpsertBodySchema.safeParse(request.body), { code: 'invalid_google_drive_backup_payload', message: 'Invalid Drive backup payload.' });

        try {
          return await googleDriveService.upsertBackup(
            sessionToken,
            body.backup,
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

      api.post('/google/drive/export-document', { preHandler: [requireGoogleSession(googleDriveService)] }, async (request, reply) => {
        const sessionToken = (request as any).prayerAppGoogleSession.sessionToken;
        const body = throwIfInvalid(googleDriveExportDocumentBodySchema.safeParse(request.body), { code: 'invalid_google_drive_export_payload', message: 'Invalid document export payload.' });

        try {
          return await googleDriveService.exportDocument(sessionToken, body);
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

      api.post('/google/calendar/sync', { preHandler: [requireGoogleSession(googleDriveService)] }, async (request, reply) => {
        const sessionToken = (request as any).prayerAppGoogleSession.sessionToken;
        const body = throwIfInvalid(googleCalendarSyncBodySchema.safeParse(request.body), { code: 'invalid_google_calendar_sync_payload', message: 'Invalid Calendar sync payload.' });

        try {
          return await googleCalendarService.syncEvents(sessionToken, body);
        } catch (error) {
          sendApiError(
            reply,
            error instanceof Error && error.message.includes('no longer available') ? 401 : 502,
            'google_calendar_sync_failed',
            error instanceof Error ? error.message : 'Unable to sync events to Google Calendar.',
          );
          return;
        }
      });

      api.get('/overview', async () => {
        return contentService.getOverview();
      });

      api.get('/quran/featured', async () => {
        return contentService.getFeaturedQuran();
      });

      api.get('/duas/collections', async () => {
        return contentService.getDuaCollections();
      });

      api.get('/quran/chapter/:id', async (request, reply) => {
        const params = throwIfInvalid<{ id: string }>(idParamSchema.safeParse(request.params), { code: 'invalid_quran_chapter_id', message: 'Invalid Quran chapter id.' });

        const id = Number(params.id);
        const chapter = await contentService.getQuranChapter(id);
        if (!chapter) {
          return reply.code(404).send(createApiErrorResponse('chapter_not_found', 'Quran chapter not found.'));
        }
        return chapter;
      });

      api.get('/duas/category/:slug', async (request, reply) => {
        const params = throwIfInvalid<{ slug: string }>(slugParamSchema.safeParse(request.params), { code: 'invalid_dua_category_slug', message: 'Invalid dua category slug.' });

        const category = await contentService.getDuaCategory(params.slug);
        if (!category) {
          return reply.code(404).send(createApiErrorResponse('category_not_found', 'Dua category not found.'));
        }
        return category;
      });

      api.get('/hadith/books', async () => {
        return contentService.getHadithBooks();
      });

      api.get('/hadith/book/:slug', async (request, reply) => {
        const params = throwIfInvalid<{ slug: string }>(slugParamSchema.safeParse(request.params), { code: 'invalid_hadith_book_slug', message: 'Invalid hadith book slug.' });

        const book = await contentService.getHadithBookDetail(params.slug);
        if (!book) {
          return reply.code(404).send(createApiErrorResponse('book_not_found', 'Hadith book not found.'));
        }
        return book;
      });

      api.get('/hadith/chapter/:bookSlug/:chapterId', async (request, reply) => {
        const params = throwIfInvalid<{ bookSlug: string; chapterId: string }>(bookChapterParamsSchema.safeParse(request.params), { code: 'invalid_hadith_chapter_params', message: 'Invalid hadith chapter parameters.' });

        return contentService.getHadithChapter(params.bookSlug, Number(params.chapterId));
      });

      api.get('/prayer-topics', async () => {
        return contentService.getPrayerTopics();
      });

      api.get('/dashboard', async () => {
        return contentService.getDashboard();
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

export default async function handler(req: any, res: any) {
  const app = buildServer();
  await app.ready();
  app.server.emit('request', req, res);
}
