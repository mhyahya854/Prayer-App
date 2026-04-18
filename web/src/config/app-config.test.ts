import assert from 'node:assert/strict';
import test from 'node:test';

import { canAccessDevelopmentDiagnostics, createAppConfig } from './app-config.shared';

test('missing EXPO_PUBLIC_API_URL fails fast outside localhost development', () => {
  const config = createAppConfig(
    {
      EXPO_PUBLIC_APP_STAGE: '',
      EXPO_PUBLIC_API_URL: '',
    },
    { platform: 'web', webHostName: 'prayer-app.example' },
  );

  assert.equal(config.buildStage, 'production');
  assert.equal(config.apiUrl, null);
  assert.equal(config.isApiConfigured, false);
  assert.equal(
    config.apiConfigErrors.some((error) => error.includes('EXPO_PUBLIC_API_URL')),
    true,
  );
});

test('localhost development falls back to the local API', () => {
  const config = createAppConfig(
    {
      EXPO_PUBLIC_APP_STAGE: '',
      EXPO_PUBLIC_API_URL: '',
    },
    { platform: 'web', webHostName: 'localhost' },
  );

  assert.equal(config.buildStage, 'development');
  assert.equal(config.apiUrl, 'http://localhost:4000');
  assert.equal(config.allowDevelopmentDiagnostics, true);
  assert.equal(config.isApiConfigured, true);
  assert.deepEqual(config.apiConfigErrors, []);
});

test('staging rejects localhost API urls even when they are configured', () => {
  const config = createAppConfig(
    {
      EXPO_PUBLIC_API_URL: 'http://localhost:4000',
      EXPO_PUBLIC_APP_STAGE: 'staging',
    },
    { platform: 'web', webHostName: 'prayer-app.example' },
  );

  assert.equal(config.apiUrl, null);
  assert.equal(config.isApiConfigured, false);
  assert.equal(
    config.apiConfigErrors.includes('EXPO_PUBLIC_API_URL cannot point to localhost outside localhost development.'),
    true,
  );
});

test('diagnostics are only allowed in true localhost development', () => {
  assert.equal(canAccessDevelopmentDiagnostics('development', 'localhost', 'web'), true);
  assert.equal(canAccessDevelopmentDiagnostics('development', 'prayer-app.example', 'web'), false);
  assert.equal(canAccessDevelopmentDiagnostics('production', 'localhost', 'web'), false);
});
