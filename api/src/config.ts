import type { RuntimeResponse } from '@prayer-app/core';

const defaultApiPort = 4000;
const defaultNotificationWorkerIntervalMs = 30_000;
const defaultWebPushSubject = 'mailto:notifications@prayer-app.local';

export interface ApiConfig {
  allowedOrigins: string[];
  databaseUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  host: string;
  notificationWorkerIntervalMs: number;
  port: number;
  stage: RuntimeResponse['stage'];
  webPushPrivateKey: string;
  webPushPublicKey: string;
  webPushSubject: string;
}

function parseRawStage(stage?: string) {
  const value = stage?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeStage(stage?: string): RuntimeResponse['stage'] {
  if (stage === 'development' || stage === 'production' || stage === 'staging') {
    return stage;
  }

  return 'development';
}

function parsePort(rawPort?: string) {
  const value = Number(rawPort);
  return Number.isInteger(value) && value > 0 && value <= 65_535 ? value : defaultApiPort;
}

function parseWorkerInterval(rawInterval?: string) {
  const value = Number(rawInterval);
  return Number.isInteger(value) && value >= 1_000 ? value : defaultNotificationWorkerIntervalMs;
}

export function createApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const rawStage = parseRawStage(env.APP_STAGE);

  return {
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    host: env.HOST ?? '0.0.0.0',
    port: parsePort(env.PORT),
    stage: normalizeStage(rawStage ?? undefined),
    googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri: env.GOOGLE_REDIRECT_URI ?? '',
    databaseUrl: env.DATABASE_URL ?? '',
    notificationWorkerIntervalMs: parseWorkerInterval(env.NOTIFICATION_WORKER_INTERVAL_MS),
    webPushPrivateKey: env.WEB_PUSH_PRIVATE_KEY ?? '',
    webPushPublicKey: env.WEB_PUSH_PUBLIC_KEY ?? '',
    webPushSubject: env.WEB_PUSH_SUBJECT ?? defaultWebPushSubject,
  };
}

export function getApiEnvironmentValidationErrors(env: NodeJS.ProcessEnv = process.env) {
  const errors: string[] = [];
  const rawStage = parseRawStage(env.APP_STAGE);

  if (!rawStage) {
    if (env.NODE_ENV === 'production') {
      errors.push('APP_STAGE is required when NODE_ENV=production and must be set to "staging" or "production".');
    }

    return errors;
  }

  if (rawStage !== 'development' && rawStage !== 'staging' && rawStage !== 'production') {
    errors.push('APP_STAGE must be one of "development", "staging", or "production".');
    return errors;
  }

  if (env.NODE_ENV === 'production' && rawStage === 'development') {
    errors.push('APP_STAGE cannot be "development" when NODE_ENV=production.');
  }

  return errors;
}

export function getApiConfigValidationErrors(config: ApiConfig) {
  if (config.stage === 'development') {
    return [];
  }

  const errors: string[] = [];

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required in production so web push subscriptions and queued jobs survive restarts.');
  }

  if (config.allowedOrigins.length === 0) {
    errors.push('ALLOWED_ORIGINS is required in production so the deployed web client can call the API.');
  }

  if (!config.webPushPublicKey) {
    errors.push('WEB_PUSH_PUBLIC_KEY is required in production for browser subscription setup.');
  }

  if (!config.webPushPrivateKey) {
    errors.push('WEB_PUSH_PRIVATE_KEY is required in production for VAPID-signed delivery.');
  }

  if (!config.webPushSubject || config.webPushSubject === defaultWebPushSubject) {
    errors.push('WEB_PUSH_SUBJECT must be set to a real production contact identity.');
  }

  if (!config.googleClientId) {
    errors.push('GOOGLE_CLIENT_ID is required in production for Google Drive sync.');
  }

  if (!config.googleClientSecret) {
    errors.push('GOOGLE_CLIENT_SECRET is required in production for Google Drive sync.');
  }

  if (!config.googleRedirectUri) {
    errors.push('GOOGLE_REDIRECT_URI is required in production for Google OAuth callbacks.');
  }

  return errors;
}

export const apiConfig = createApiConfig();
export const apiConfigValidationErrors = [
  ...getApiEnvironmentValidationErrors(process.env),
  ...getApiConfigValidationErrors(apiConfig),
];

export const runtimeStatus: RuntimeResponse = {
  authFlowImplemented: true,
  calendarSyncImplemented: false,
  driveBackupImplemented: true,
  googleServerCredentialsConfigured: Boolean(
    apiConfig.googleClientId && apiConfig.googleClientSecret && apiConfig.googleRedirectUri,
  ),
  stage: apiConfig.stage,
};
