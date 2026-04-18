export type AppStage = 'development' | 'production' | 'staging';

const localHostNames = new Set(['127.0.0.1', '::1', 'localhost']);

export interface AppConfig {
  apiConfigErrors: string[];
  apiUrl: string | null;
  allowDevelopmentDiagnostics: boolean;
  buildStage: AppStage;
  isApiConfigured: boolean;
  webHostName: string | null;
  webPushPublicKey: string;
}

export function isLocalHostName(hostName: string | null | undefined) {
  if (!hostName) {
    return false;
  }

  return localHostNames.has(hostName.trim().toLowerCase());
}

export function isLocalHostUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) {
    return false;
  }

  try {
    return isLocalHostName(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

export function canAccessDevelopmentDiagnostics(buildStage: AppStage, webHostName: string | null, platform: string) {
  return platform === 'web' && buildStage === 'development' && isLocalHostName(webHostName);
}

function normalizeStage(rawStage: string | null | undefined, isLocalHost: boolean): AppStage {
  const stage = rawStage?.trim().toLowerCase();

  if (stage === 'development' || stage === 'staging' || stage === 'production') {
    return stage;
  }

  return isLocalHost ? 'development' : 'production';
}

export function createAppConfig(
  env: Record<string, string | undefined>,
  options: {
    platform: string;
    webHostName: string | null;
  },
): AppConfig {
  const isLocalHost = options.platform === 'web' && isLocalHostName(options.webHostName);
  const buildStage = normalizeStage(env.EXPO_PUBLIC_APP_STAGE, isLocalHost);
  const configuredApiUrl = env.EXPO_PUBLIC_API_URL?.trim() || null;
  const apiConfigErrors: string[] = [];
  let apiUrl: string | null = null;

  if (configuredApiUrl) {
    try {
      const parsedUrl = new URL(configuredApiUrl);

      if ((buildStage === 'staging' || buildStage === 'production') && isLocalHostName(parsedUrl.hostname)) {
        apiConfigErrors.push('EXPO_PUBLIC_API_URL cannot point to localhost outside localhost development.');
      } else {
        apiUrl = configuredApiUrl;
      }
    } catch {
      apiConfigErrors.push('EXPO_PUBLIC_API_URL must be an absolute URL.');
    }
  }

  if (!apiUrl && options.platform === 'web' && buildStage === 'development' && isLocalHost) {
    apiUrl = 'http://localhost:4000';
  }

  if (apiUrl === null && apiConfigErrors.length === 0) {
    apiConfigErrors.push('EXPO_PUBLIC_API_URL is required outside localhost development.');
  }

  return {
    apiConfigErrors,
    apiUrl,
    allowDevelopmentDiagnostics: canAccessDevelopmentDiagnostics(buildStage, options.webHostName, options.platform),
    buildStage,
    isApiConfigured: apiUrl !== null,
    webHostName: options.webHostName,
    webPushPublicKey: env.EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() || '',
  };
}
