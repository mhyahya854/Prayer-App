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
  GoogleDriveExportDocumentRequest,
  GoogleDriveExportDocumentResponse,
  GoogleDriveSessionResponse,
  MosqueSearchResponse,
  NotificationDisableRequest,
  NotificationRefreshRequest,
  NotificationSyncRequest,
  NotificationSyncResponse,
  RuntimeResponse,
} from '@prayer-app/core';

import { appConfig } from '@/src/config/app-config';

function getRequiredApiUrl() {
  if (!appConfig.apiUrl) {
    throw new Error(appConfig.apiConfigErrors[0] ?? 'The web API is not configured for this environment.');
  }

  return appConfig.apiUrl;
}

async function apiRequest<T>(path: string, init?: RequestInit, sessionToken?: string): Promise<T> {
  const response = await fetch(`${getRequiredApiUrl()}${path}`, {
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

export function fetchNearbyMosques(latitude: number, longitude: number, radiusKm: number) {
  const searchParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    radiusKm: radiusKm.toString(),
  });

  return apiRequest<MosqueSearchResponse>(`/api/mosques/nearby?${searchParams.toString()}`);
}

export function syncWebNotifications(payload: NotificationSyncRequest) {
  return apiRequest<NotificationSyncResponse>('/api/notifications/web/sync', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function refreshWebNotifications(payload: NotificationRefreshRequest) {
  return apiRequest<NotificationSyncResponse>('/api/notifications/web/refresh', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function disableWebNotifications(payload: NotificationDisableRequest) {
  return apiRequest<NotificationSyncResponse>('/api/notifications/web/disable', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
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

export function exportGoogleDriveDocument(
  sessionToken: string,
  payload: GoogleDriveExportDocumentRequest,
) {
  return apiRequest<GoogleDriveExportDocumentResponse>(
    '/api/google/drive/export-document',
    {
      body: JSON.stringify(payload),
      method: 'POST',
    },
    sessionToken,
  );
}
