import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  resolveWorkspacePresence,
  selectPresentWorkspacePaths,
  workspaceRoot,
} from './workspace-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const localHostNames = new Set(['127.0.0.1', '::1', 'localhost']);
const webReleaseStages = new Set(['production', 'staging']);

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

const groupedAudioAssetPaths = {
  android: ['android/assets/sounds/athan.wav', 'android/assets/sounds/reminder.wav'],
  ios: ['ios/assets/sounds/athan.wav', 'ios/assets/sounds/reminder.wav'],
  web: ['web/assets/sounds/athan.wav', 'web/assets/sounds/reminder.wav'],
};

const groupedAudioLicenseDocs = {
  android: ['android/assets/sounds/ASSET_LICENSES.md'],
  ios: ['ios/assets/sounds/ASSET_LICENSES.md'],
  web: ['web/assets/sounds/ASSET_LICENSES.md'],
};

function trimEnvValue(env, key) {
  return env[key]?.trim() ?? '';
}

function isLocalHostName(hostName) {
  return hostName ? localHostNames.has(hostName.trim().toLowerCase()) : false;
}

function parseAbsoluteUrl(rawValue, key, errors) {
  try {
    return new URL(rawValue);
  } catch {
    errors.push(`${key} must be an absolute URL.`);
    return null;
  }
}

export function parseArgs(argv) {
  return {
    strictRelease: argv.includes('--strict-release'),
    webRelease: argv.includes('--web-release'),
  };
}

export function parseEnvTemplate(content) {
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

export function validateRuntimeEnvironment(env = process.env) {
  const errors = [];

  for (const key of requiredRuntimeKeys) {
    if (!trimEnvValue(env, key)) {
      errors.push(`Missing runtime environment variable: ${key}`);
    }
  }

  const stage = trimEnvValue(env, 'APP_STAGE');
  if (stage && stage !== 'staging' && stage !== 'production') {
    errors.push('APP_STAGE must be set to "staging" or "production" for strict release preflight.');
  }

  return errors;
}

export function validateWebRuntimeEnvironment(env = process.env) {
  const errors = [];
  const appStage = trimEnvValue(env, 'APP_STAGE');
  const publicStage = trimEnvValue(env, 'EXPO_PUBLIC_APP_STAGE');

  if (!appStage) {
    errors.push('APP_STAGE is required for web release preflight.');
  } else if (!webReleaseStages.has(appStage)) {
    errors.push('APP_STAGE must be set to "staging" or "production" for web release preflight.');
  }

  if (!publicStage) {
    errors.push('EXPO_PUBLIC_APP_STAGE is required for web release preflight.');
  } else if (!webReleaseStages.has(publicStage)) {
    errors.push('EXPO_PUBLIC_APP_STAGE must be set to "staging" or "production" for web release preflight.');
  }

  if (appStage && publicStage && appStage !== publicStage) {
    errors.push('APP_STAGE and EXPO_PUBLIC_APP_STAGE must match for web release preflight.');
  }

  const apiUrl = trimEnvValue(env, 'EXPO_PUBLIC_API_URL');
  if (!apiUrl) {
    errors.push('EXPO_PUBLIC_API_URL is required for staging and production web releases.');
  } else {
    const parsedApiUrl = parseAbsoluteUrl(apiUrl, 'EXPO_PUBLIC_API_URL', errors);
    if (parsedApiUrl && isLocalHostName(parsedApiUrl.hostname)) {
      errors.push('EXPO_PUBLIC_API_URL cannot point to localhost for staging or production web releases.');
    }
  }

  const googleRedirectUri = trimEnvValue(env, 'GOOGLE_REDIRECT_URI');
  if (googleRedirectUri) {
    const parsedRedirectUri = parseAbsoluteUrl(googleRedirectUri, 'GOOGLE_REDIRECT_URI', errors);
    if (parsedRedirectUri && isLocalHostName(parsedRedirectUri.hostname)) {
      errors.push('GOOGLE_REDIRECT_URI cannot point to localhost for staging or production web releases.');
    }
  }

  if (!trimEnvValue(env, 'EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY')) {
    errors.push('EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY is required for staging and production web releases.');
  }

  return errors;
}

async function detectPlaceholderAudioStatus(paths) {
  const indicators = [];

  for (const docPath of paths) {
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

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { strictRelease, webRelease } = parseArgs(argv);
  const errors = [];
  const workspacePresence = await resolveWorkspacePresence(['android', 'ios', 'web']);
  const assetPathsToCheck = selectPresentWorkspacePaths(
    workspacePresence,
    webRelease ? { web: groupedAudioAssetPaths.web } : groupedAudioAssetPaths,
  );
  const audioLicenseDocsToCheck = selectPresentWorkspacePaths(
    workspacePresence,
    webRelease ? { web: groupedAudioLicenseDocs.web } : groupedAudioLicenseDocs,
  );
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

  const missingAudioPaths = await assertPathsExist(assetPathsToCheck);
  for (const missingPath of missingAudioPaths) {
    errors.push(`Missing required audio asset: ${missingPath}`);
  }

  const missingLicenseDocs = await assertPathsExist(audioLicenseDocsToCheck);
  for (const missingPath of missingLicenseDocs) {
    errors.push(`Missing required audio asset license status file: ${missingPath}`);
  }

  if (strictRelease) {
    errors.push(...validateRuntimeEnvironment(env));

    const placeholderIndicators = await detectPlaceholderAudioStatus(audioLicenseDocsToCheck);
    for (const docPath of placeholderIndicators) {
      errors.push(
        `Placeholder/non-approved launch audio is still declared in ${docPath}. Replace with licensed launch assets before release.`,
      );
    }
  }

  if (webRelease) {
    errors.push(...validateWebRuntimeEnvironment(env));
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
      : webRelease
        ? 'Web release preflight passed (public web env validated).'
        : 'Release preflight passed (template/env key coverage + asset presence validated).',
  );
}

const entryFile = process.argv[1];
const isMain = entryFile ? import.meta.url === pathToFileURL(path.resolve(entryFile)).href : false;

if (isMain) {
  await main();
}
