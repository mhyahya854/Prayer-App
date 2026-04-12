import type {
  ApiErrorResponse,
  ApiHealthResponse,
  GoogleDriveAuthCompleteRequest,
  GoogleDriveAuthCompleteResponse,
  GoogleDriveAuthStartRequest,
  GoogleDriveAuthStartResponse,
  GoogleDriveBackupFetchResponse,
  GoogleDriveBackupUpsertRequest,
  GoogleDriveBackupUpsertResponse,
  GoogleDriveSessionResponse,
  RuntimeResponse,
} from '@prayer-app/core';

import { appConfig } from '@/src/config/app-config';

async function apiRequest<T>(path: string, init?: RequestInit, sessionToken?: string): Promise<T> {
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'x-prayer-app-session': sessionToken } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as ApiErrorResponse;
      if (payload?.error?.message) {
        errorMessage = payload.error.message;
      }
    } catch {
      // Ignore JSON parsing failures and fall back to the generic message.
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

export function fetchApiHealth() {
  return apiRequest<ApiHealthResponse>('/health');
}

export function fetchRuntimeStatus() {
  return apiRequest<RuntimeResponse>('/api/runtime');
}

export function startGoogleDriveAuth(payload: GoogleDriveAuthStartRequest) {
  return apiRequest<GoogleDriveAuthStartResponse>('/api/google/auth/start', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function completeGoogleDriveAuth(payload: GoogleDriveAuthCompleteRequest) {
  return apiRequest<GoogleDriveAuthCompleteResponse>('/api/google/auth/complete', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function fetchGoogleDriveSession(sessionToken: string) {
  return apiRequest<GoogleDriveSessionResponse>('/api/google/session', undefined, sessionToken);
}

export function disconnectGoogleDriveSession(sessionToken: string) {
  return apiRequest<{ connected: false }>('/api/google/session', {
    method: 'DELETE',
  }, sessionToken);
}

export function fetchGoogleDriveBackup(sessionToken: string) {
  return apiRequest<GoogleDriveBackupFetchResponse>('/api/google/drive/backup', undefined, sessionToken);
}

export function upsertGoogleDriveBackup(
  sessionToken: string,
  payload: GoogleDriveBackupUpsertRequest,
) {
  return apiRequest<GoogleDriveBackupUpsertResponse>(
    '/api/google/drive/backup',
    {
      body: JSON.stringify(payload),
      method: 'PUT',
    },
    sessionToken,
  );
}
