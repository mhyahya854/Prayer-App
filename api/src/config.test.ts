import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiConfig, getApiConfigValidationErrors } from './config';

test('createApiConfig falls back to safe numeric defaults when env values are invalid', () => {
  const config = createApiConfig({
    APP_STAGE: 'staging',
    NOTIFICATION_WORKER_INTERVAL_MS: '250',
    PORT: 'invalid',
  });

  assert.equal(config.port, 4000);
  assert.equal(config.notificationWorkerIntervalMs, 30_000);
  assert.equal(config.stage, 'staging');
});

test('production config validation reports missing notification infrastructure', () => {
  const config = createApiConfig({
    ALLOWED_ORIGINS: '',
    APP_STAGE: 'production',
    DATABASE_URL: '',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_REDIRECT_URI: 'https://example.com/api/google/callback',
    WEB_PUSH_PRIVATE_KEY: '',
    WEB_PUSH_PUBLIC_KEY: '',
    WEB_PUSH_SUBJECT: '',
  });

  const errors = getApiConfigValidationErrors(config);

  assert.equal(errors.some((error) => error.includes('DATABASE_URL')), true);
  assert.equal(errors.some((error) => error.includes('ALLOWED_ORIGINS')), true);
  assert.equal(errors.some((error) => error.includes('WEB_PUSH_PUBLIC_KEY')), true);
  assert.equal(errors.some((error) => error.includes('WEB_PUSH_PRIVATE_KEY')), true);
  assert.equal(errors.some((error) => error.includes('WEB_PUSH_SUBJECT')), true);
  assert.equal(errors.some((error) => error.includes('GOOGLE_CLIENT_ID')), false);
  assert.equal(errors.some((error) => error.includes('GOOGLE_CLIENT_SECRET')), false);
  assert.equal(errors.some((error) => error.includes('GOOGLE_REDIRECT_URI')), false);
});

test('production config validation reports missing Google Drive sync credentials', () => {
  const config = createApiConfig({
    ALLOWED_ORIGINS: 'https://prayer-app.example',
    APP_STAGE: 'production',
    DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/prayer_app',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GOOGLE_REDIRECT_URI: '',
    WEB_PUSH_PRIVATE_KEY: 'private-key',
    WEB_PUSH_PUBLIC_KEY: 'public-key',
    WEB_PUSH_SUBJECT: 'mailto:notifications@example.com',
  });

  const errors = getApiConfigValidationErrors(config);

  assert.equal(errors.some((error) => error.includes('GOOGLE_CLIENT_ID')), true);
  assert.equal(errors.some((error) => error.includes('GOOGLE_CLIENT_SECRET')), true);
  assert.equal(errors.some((error) => error.includes('GOOGLE_REDIRECT_URI')), true);
  assert.equal(errors.some((error) => error.includes('DATABASE_URL')), false);
  assert.equal(errors.some((error) => error.includes('ALLOWED_ORIGINS')), false);
  assert.equal(errors.some((error) => error.includes('WEB_PUSH_PUBLIC_KEY')), false);
  assert.equal(errors.some((error) => error.includes('WEB_PUSH_PRIVATE_KEY')), false);
  assert.equal(errors.some((error) => error.includes('WEB_PUSH_SUBJECT')), false);
});
