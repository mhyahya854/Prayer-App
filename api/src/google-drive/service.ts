import type {
  GoogleDriveAuthCompleteRequest,
  GoogleDriveAuthCompleteResponse,
  GoogleDriveAuthStartRequest,
  GoogleDriveAuthStartResponse,
  GoogleDriveBackupFetchResponse,
  GoogleDriveBackupUpsertResponse,
  GoogleDriveSessionResponse,
  PrayerAppBackupPayload,
} from '@prayer-app/core';

import { prayerAppBackupPayloadSchema } from './schema';
import type {
  GoogleDriveAuthStore,
  StoredGoogleAccount,
  StoredGoogleDriveSession,
} from './store';

const googleAuthBaseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
const googleTokenUrl = 'https://oauth2.googleapis.com/token';
const googleUserInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';
const driveApiBaseUrl = 'https://www.googleapis.com/drive/v3/files';
const driveUploadBaseUrl = 'https://www.googleapis.com/upload/drive/v3/files';
const googleDriveScope = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const googleIdentityScopes = ['openid', 'email', 'profile'];
const backupFileName = 'prayer-app-backup.json';
const authStateLifetimeMs = 10 * 60_000;

function createStateToken() {
  return `gdrv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function createSessionToken() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`;
}

export function buildRedirectUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function readGoogleError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?:
        | string
        | {
            message?: string;
          };
      error_description?: string;
    };

    if (typeof payload.error === 'string') {
      return payload.error_description
        ? `${payload.error}: ${payload.error_description}`
        : payload.error;
    }

    return payload.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function ensureGoogleResponse(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return response;
  }

  const errorMessage = await readGoogleError(response);
  throw new Error(`${fallbackMessage} ${errorMessage}`.trim());
}

function buildMultipartPayload(metadata: Record<string, unknown>, payload: PrayerAppBackupPayload) {
  const boundary = `prayer-app-${Date.now().toString(36)}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(payload),
    `--${boundary}--`,
  ].join('\r\n');

  return {
    body,
    boundary,
  };
}

export interface GoogleDriveServiceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleDriveService {
  constructor(
    private readonly config: GoogleDriveServiceConfig,
    private readonly store: GoogleDriveAuthStore,
  ) {}

  isConfigured() {
    return Boolean(this.config.clientId && this.config.clientSecret && this.config.redirectUri);
  }

  async startAuth(request: GoogleDriveAuthStartRequest): Promise<GoogleDriveAuthStartResponse> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive sync is not configured on the server.');
    }

    const state = createStateToken();
    await this.store.createPendingState({
      expiresAt: new Date(Date.now() + authStateLifetimeMs).toISOString(),
      installationId: request.installationId,
      platform: request.platform,
      redirectUri: request.redirectUri,
      state,
    });

    const authUrl = new URL(googleAuthBaseUrl);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', [...googleIdentityScopes, googleDriveScope].join(' '));
    authUrl.searchParams.set('state', state);

    return {
      authUrl: authUrl.toString(),
      state,
    };
  }

  async completeAuth(request: GoogleDriveAuthCompleteRequest): Promise<GoogleDriveAuthCompleteResponse | null> {
    const session = await this.store.claimCompletedState(request.installationId, request.state);

    if (!session) {
      return null;
    }

    return {
      account: {
        email: session.account.email,
        name: session.account.name,
        pictureUrl: session.account.pictureUrl,
        subject: session.account.subject,
      },
      sessionToken: session.sessionToken,
    };
  }

  async getRedirectUriForState(state: string) {
    return this.store.getRedirectUriForState(state);
  }

  async finishAuthorization(params: {
    code?: string;
    error?: string;
    errorDescription?: string;
    state: string;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Google Drive sync is not configured on the server.');
    }

    if (params.error) {
      throw new Error(params.errorDescription ?? params.error);
    }

    if (!params.code) {
      throw new Error('Google did not return an authorization code.');
    }

    const tokenResponse = await fetch(googleTokenUrl, {
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: params.code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });
    await ensureGoogleResponse(tokenResponse, 'Google token exchange failed.');

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!tokenPayload.access_token) {
      throw new Error('Google token exchange returned no access token.');
    }

    const userInfoResponse = await fetch(googleUserInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });
    await ensureGoogleResponse(userInfoResponse, 'Unable to read the Google account profile.');

    const userInfo = (await userInfoResponse.json()) as {
      email?: string;
      name?: string;
      picture?: string;
      sub?: string;
    };

    if (!userInfo.sub || !userInfo.email) {
      throw new Error('Google profile response was missing the account identity.');
    }

    const existingAccount = await this.store.getAccount(userInfo.sub);
    const refreshToken = tokenPayload.refresh_token ?? existingAccount?.refreshToken;
    if (!refreshToken) {
      throw new Error('Google did not return a refresh token for this account.');
    }

    const account: StoredGoogleAccount = {
      email: userInfo.email,
      name: userInfo.name ?? null,
      pictureUrl: userInfo.picture ?? null,
      refreshToken,
      subject: userInfo.sub,
    };
    const sessionToken = createSessionToken();
    const redirectUri = await this.store.finalizeState({
      account,
      sessionToken,
      state: params.state,
    });

    if (!redirectUri) {
      throw new Error('The Google auth request expired before it could be completed.');
    }

    return redirectUri;
  }

  async getSession(sessionToken: string): Promise<GoogleDriveSessionResponse | null> {
    const session = await this.store.getSession(sessionToken);

    if (!session) {
      return null;
    }

    return {
      account: {
        email: session.account.email,
        name: session.account.name,
        pictureUrl: session.account.pictureUrl,
        subject: session.account.subject,
      },
      connected: true,
    };
  }

  async disconnect(sessionToken: string) {
    await this.store.deleteSession(sessionToken);
  }

  async fetchBackup(sessionToken: string): Promise<GoogleDriveBackupFetchResponse> {
    const session = await this.requireSession(sessionToken);
    const accessToken = await this.refreshAccessToken(session.account.refreshToken);
    const file = await this.findBackupFile(accessToken);

    if (!file) {
      return {
        backup: null,
        fileId: null,
        modifiedAt: null,
      };
    }

    const response = await fetch(`${driveApiBaseUrl}/${file.id}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await ensureGoogleResponse(response, 'Unable to download the Drive backup.');

    const parsed = prayerAppBackupPayloadSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error('The Drive backup file is not in the expected format.');
    }

    return {
      backup: parsed.data,
      fileId: file.id,
      modifiedAt: file.modifiedTime,
    };
  }

  async upsertBackup(
    sessionToken: string,
    backup: PrayerAppBackupPayload,
  ): Promise<GoogleDriveBackupUpsertResponse> {
    const session = await this.requireSession(sessionToken);
    const accessToken = await this.refreshAccessToken(session.account.refreshToken);
    const existingFile = await this.findBackupFile(accessToken);
    const { body, boundary } = buildMultipartPayload(
      existingFile
        ? {
            name: backupFileName,
          }
        : {
            name: backupFileName,
            parents: ['appDataFolder'],
          },
      backup,
    );

    const response = await fetch(
      existingFile
        ? `${driveUploadBaseUrl}/${existingFile.id}?uploadType=multipart&fields=id,modifiedTime`
        : `${driveUploadBaseUrl}?uploadType=multipart&fields=id,modifiedTime`,
      {
        body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        method: existingFile ? 'PATCH' : 'POST',
      },
    );
    await ensureGoogleResponse(response, 'Unable to upload the Drive backup.');

    const uploadedFile = (await response.json()) as {
      id: string;
      modifiedTime: string;
    };

    return {
      backup,
      fileId: uploadedFile.id,
      modifiedAt: uploadedFile.modifiedTime,
    };
  }

  async exportDocument(
    sessionToken: string,
    params: { folderName: string; fileName: string; content: string; mimeType: string },
  ) {
    const session = await this.requireSession(sessionToken);
    const accessToken = await this.refreshAccessToken(session.account.refreshToken);
    const folderId = await this.findOrCreateFolder(accessToken, params.folderName);
    
    // Check if file already exists in folder
    const fileQuery = encodeURIComponent(`name='${params.fileName}' and '${folderId}' in parents and trashed=false`);
    const fileSearchResponse = await fetch(
      `${driveApiBaseUrl}?fields=files(id)&pageSize=1&q=${fileQuery}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    await ensureGoogleResponse(fileSearchResponse, 'Unable to search for existing exported document.');
    const fileSearchPayload = (await fileSearchResponse.json()) as { files?: Array<{ id: string }> };
    const existingFileId = fileSearchPayload.files?.[0]?.id;

    // Use multipart/related to upload metadata and content together
    const boundary = `export-${Date.now().toString(36)}`;
    const metadata = existingFileId ? {} : { name: params.fileName, parents: [folderId] };
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${params.mimeType}`,
      '',
      params.content,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await fetch(
      existingFileId
        ? `${driveUploadBaseUrl}/${existingFileId}?uploadType=multipart&fields=id,webViewLink`
        : `${driveUploadBaseUrl}?uploadType=multipart&fields=id,webViewLink`,
      {
        body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        method: existingFileId ? 'PATCH' : 'POST',
      },
    );
    await ensureGoogleResponse(response, 'Unable to export document to Google Drive.');

    const result = (await response.json()) as { id: string; webViewLink?: string };
    return { fileId: result.id, webViewLink: result.webViewLink };
  }

  private async findOrCreateFolder(accessToken: string, folderName: string) {
    const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
    const response = await fetch(
      `${driveApiBaseUrl}?fields=files(id)&pageSize=1&q=${query}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    await ensureGoogleResponse(response, 'Unable to list Drive visible folders.');

    const payload = (await response.json()) as { files?: Array<{ id: string }> };
    const existingFolder = payload.files?.[0];

    if (existingFolder) {
      return existingFolder.id;
    }

    const createResponse = await fetch(driveApiBaseUrl, {
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    await ensureGoogleResponse(createResponse, 'Unable to create visible Drive folder.');

    const createdFolder = (await createResponse.json()) as { id: string };
    return createdFolder.id;
  }

  private async findBackupFile(accessToken: string) {
    const query = encodeURIComponent(`name='${backupFileName}' and trashed=false`);
    const response = await fetch(
      `${driveApiBaseUrl}?spaces=appDataFolder&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1&q=${query}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    await ensureGoogleResponse(response, 'Unable to list Drive app data files.');

    const payload = (await response.json()) as {
      files?: Array<{
        id: string;
        modifiedTime: string;
      }>;
    };

    return payload.files?.[0] ?? null;
  }

  private async refreshAccessToken(refreshToken: string) {
    const response = await fetch(googleTokenUrl, {
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });
    await ensureGoogleResponse(response, 'Unable to refresh the Google access token.');

    const payload = (await response.json()) as {
      access_token?: string;
    };

    if (!payload.access_token) {
      throw new Error('Google did not return a refreshed access token.');
    }

    return payload.access_token;
  }

  private async requireSession(sessionToken: string): Promise<StoredGoogleDriveSession> {
    const session = await this.store.getSession(sessionToken);

    if (!session) {
      throw new Error('The Google Drive session is no longer available. Sign in again.');
    }

    return session;
  }
}
