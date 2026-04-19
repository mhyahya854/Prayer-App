import type {
  GoogleCalendarEvent,
  GoogleCalendarSyncRequest,
  GoogleCalendarSyncResponse,
} from '@prayer-app/core';

import type { GoogleDriveAuthStore, StoredGoogleDriveSession } from '../google-drive/store';

const calendarApiBaseUrl = 'https://www.googleapis.com/calendar/v3';
const googleTokenUrl = 'https://oauth2.googleapis.com/token';

export interface GoogleCalendarServiceConfig {
  clientId: string;
  clientSecret: string;
}

export class GoogleCalendarService {
  constructor(
    private readonly config: GoogleCalendarServiceConfig,
    private readonly store: GoogleDriveAuthStore,
  ) {}

  async syncEvents(
    sessionToken: string,
    request: GoogleCalendarSyncRequest,
  ): Promise<GoogleCalendarSyncResponse> {
    const session = await this.requireSession(sessionToken);
    const accessToken = await this.refreshAccessToken(session.account.refreshToken);
    const calendarId = request.calendarId ?? 'primary';

    let createdCount = 0;

    for (const event of request.events) {
      const response = await fetch(`${calendarApiBaseUrl}/calendars/${calendarId}/events`, {
        body: JSON.stringify({
          description: event.description,
          end: { dateTime: event.end },
          start: { dateTime: event.start },
          summary: event.summary,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (response.ok) {
        createdCount++;
      } else {
        const error = await response.json().catch(() => ({}));
        console.error('[calendar-sync] Failed to create event:', error);
      }
    }

    return {
      createdCount,
      success: true,
    };
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

    if (!response.ok) {
      throw new Error('Unable to refresh the Google access token for Calendar sync.');
    }

    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw new Error('Google did not return a refreshed access token for Calendar sync.');
    }

    return payload.access_token;
  }

  private async requireSession(sessionToken: string): Promise<StoredGoogleDriveSession> {
    const session = await this.store.getSession(sessionToken);
    if (!session) {
      throw new Error('The Google session is no longer available. Sign in again.');
    }
    return session;
  }
}
