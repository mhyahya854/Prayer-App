import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateWebRuntimeEnvironment } from './release-preflight.mjs';

function parseEnvAssignments(content) {
  const env = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    env[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }

  return env;
}

test('.env.example development defaults are rejected by web release validation', async () => {
  const envTemplate = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const env = parseEnvAssignments(envTemplate);
  const errors = validateWebRuntimeEnvironment(env);

  assert.equal(errors.includes('APP_STAGE must be set to "staging" or "production" for web release preflight.'), true);
  assert.equal(
    errors.includes('EXPO_PUBLIC_APP_STAGE must be set to "staging" or "production" for web release preflight.'),
    true,
  );
  assert.equal(
    errors.includes('EXPO_PUBLIC_API_URL cannot point to localhost for staging or production web releases.'),
    true,
  );
  assert.equal(
    errors.includes('GOOGLE_REDIRECT_URI cannot point to localhost for staging or production web releases.'),
    true,
  );
});

test('web release validation rejects stage mismatches and localhost callbacks', () => {
  const errors = validateWebRuntimeEnvironment({
    APP_STAGE: 'staging',
    EXPO_PUBLIC_API_URL: 'https://api.prayer-app.example',
    EXPO_PUBLIC_APP_STAGE: 'production',
    EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY: 'test-key',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/api/google/callback',
  });

  assert.equal(errors.includes('APP_STAGE and EXPO_PUBLIC_APP_STAGE must match for web release preflight.'), true);
  assert.equal(
    errors.includes('GOOGLE_REDIRECT_URI cannot point to localhost for staging or production web releases.'),
    true,
  );
});
