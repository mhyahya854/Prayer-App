import { Platform } from 'react-native';

import { createAppConfig as createAppConfigShared, type AppConfig } from './app-config.shared';

function getWebHostName() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const hostName = window.location.hostname?.trim().toLowerCase();
  return hostName ? hostName : null;
}

export function createAppConfig(
  env: Record<string, string | undefined> = process.env,
  options?: {
    platform?: string;
    webHostName?: string | null;
  },
): AppConfig {
  const platform = options?.platform ?? Platform.OS;
  const webHostName =
    platform === 'web'
      ? (options?.webHostName ?? getWebHostName())
      : null;

  return createAppConfigShared(env, {
    platform,
    webHostName,
  });
}

export { type AppConfig, isLocalHostName } from './app-config.shared';

export const appConfig = createAppConfig();
