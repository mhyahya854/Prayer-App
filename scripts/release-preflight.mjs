import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(__dirname, '..');

const requiredTemplateKeys = [
  'APP_STAGE',
  'EXPO_PUBLIC_APP_STAGE',
  'HOST',
  'PORT',
  'ALLOWED_ORIGINS',
  'DATABASE_URL',
  'NOTIFICATION_WORKER_INTERVAL_MS',
  'WEB_PUSH_PUBLIC_KEY',
  'WEB_PUSH_PRIVATE_KEY',
  'WEB_PUSH_SUBJECT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
];

const requiredRuntimeKeys = [
  'APP_STAGE',
  'ALLOWED_ORIGINS',
  'DATABASE_URL',
  'WEB_PUSH_PUBLIC_KEY',
  'WEB_PUSH_PRIVATE_KEY',
  'WEB_PUSH_SUBJECT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY',
];

const audioAssetPaths = [
  'android/assets/sounds/athan.wav',
  'android/assets/sounds/reminder.wav',
  'ios/assets/sounds/athan.wav',
  'ios/assets/sounds/reminder.wav',
  'web/assets/sounds/athan.wav',
  'web/assets/sounds/reminder.wav',
];

const audioLicenseDocs = [
  'android/assets/sounds/ASSET_LICENSES.md',
  'ios/assets/sounds/ASSET_LICENSES.md',
  'web/assets/sounds/ASSET_LICENSES.md',
];

function parseArgs(argv) {
  return {
    strictRelease: argv.includes('--strict-release'),
  };
}

function parseEnvTemplate(content) {
  const keys = new Set();

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=/u);
    if (match?.[1]) {
      keys.add(match[1]);
    }
  }

  return keys;
}

async function assertPathsExist(relativePaths) {
  const missing = [];

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    try {
      await access(absolutePath);
    } catch {
      missing.push(relativePath);
    }
  }

  return missing;
}

function validateRuntimeEnvironment() {
  const errors = [];

  for (const key of requiredRuntimeKeys) {
    const value = process.env[key]?.trim();
    if (!value) {
      errors.push(`Missing runtime environment variable: ${key}`);
    }
  }

  const stage = process.env.APP_STAGE?.trim();
  if (stage && stage !== 'staging' && stage !== 'production') {
    errors.push('APP_STAGE must be set to "staging" or "production" for strict release preflight.');
  }

  return errors;
}

async function detectPlaceholderAudioStatus() {
  const indicators = [];

  for (const docPath of audioLicenseDocs) {
    const fullPath = path.join(workspaceRoot, docPath);
    const content = await readFile(fullPath, 'utf8');
    const lower = content.toLowerCase();

    if (
      lower.includes('placeholder asset') ||
      lower.includes('not approved for polished public launch')
    ) {
      indicators.push(docPath);
    }
  }

  return indicators;
}

async function main() {
  const { strictRelease } = parseArgs(process.argv.slice(2));
  const errors = [];

  const envTemplatePath = path.join(workspaceRoot, '.env.example');
  try {
    const envTemplate = await readFile(envTemplatePath, 'utf8');
    const parsedKeys = parseEnvTemplate(envTemplate);

    for (const key of requiredTemplateKeys) {
      if (!parsedKeys.has(key)) {
        errors.push(`.env.example is missing required key: ${key}`);
      }
    }
  } catch {
    errors.push('Missing .env.example at workspace root.');
  }

  const missingAudioPaths = await assertPathsExist(audioAssetPaths);
  for (const missingPath of missingAudioPaths) {
    errors.push(`Missing required audio asset: ${missingPath}`);
  }

  const missingLicenseDocs = await assertPathsExist(audioLicenseDocs);
  for (const missingPath of missingLicenseDocs) {
    errors.push(`Missing required audio asset license status file: ${missingPath}`);
  }

  if (strictRelease) {
    errors.push(...validateRuntimeEnvironment());

    const placeholderIndicators = await detectPlaceholderAudioStatus();
    for (const docPath of placeholderIndicators) {
      errors.push(
        `Placeholder/non-approved launch audio is still declared in ${docPath}. Replace with licensed launch assets before release.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error('Release preflight failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    strictRelease
      ? 'Release preflight passed in strict mode (runtime env + launch assets validated).'
      : 'Release preflight passed (template/env key coverage + asset presence validated).',
  );
}

await main();
