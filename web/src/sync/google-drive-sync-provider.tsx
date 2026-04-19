import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createPrayerAppBackupPayload,
  createTimestampedValue,
  hasMeaningfulPrayerAppBackupData,
  mergePrayerAppBackupPayload,
  syncEpochTimestamp,
  type AppPlatform,
  type GoogleDriveAccount,
} from '@prayer-app/core';
import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  completeGoogleDriveAuth,
  disconnectGoogleDriveSession,
  fetchGoogleDriveBackup,
  fetchGoogleDriveSession,
  startGoogleDriveAuth,
  upsertGoogleDriveBackup,
  exportGoogleDriveDocument,
  syncGoogleCalendarEvents,
} from '@/src/lib/api/client';
import {
  clearGoogleDriveSessionSnapshot,
  loadGoogleDriveSessionSnapshot,
  saveGoogleDriveSessionSnapshot,
} from '@/src/lib/storage/drive-sync-storage';
import { usePrayerNotifications } from '@/src/notifications/notification-provider';
import { usePrayerData } from '@/src/prayer/prayer-provider';
import { useThemePreference } from '@/src/theme/theme-provider';

void WebBrowser.maybeCompleteAuthSession();

interface GoogleDriveSyncContextValue {
  account: GoogleDriveAccount | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  hasLoadedSession: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  sessionToken: string | null;
  syncError: string | null;
  syncNow: () => Promise<void>;
  exportDocument: (folderName: string, fileName: string, content: string, mimeType: string) => Promise<{ fileId: string; webViewLink?: string } | null>;
  syncToCalendar: (events: Array<{ summary: string; start: string; end: string; description?: string }>) => Promise<{ createdCount: number } | null>;
}

const GoogleDriveSyncContext = createContext<GoogleDriveSyncContextValue | null>(null);

function getAppPlatform(): AppPlatform {
  if (Platform.OS === 'ios') {
    return 'ios';
  }

  if (Platform.OS === 'android') {
    return 'android';
  }

  return 'web';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Google Drive sync failed.';
}

function isSessionError(message: string) {
  return (
    message.includes('no longer available') ||
    message.includes('no longer valid') ||
    message.includes('Sign in again')
  );
}

export function GoogleDriveSyncProvider({ children }: PropsWithChildren) {
  const {
    accentTheme,
    accentThemeUpdatedAt,
    hasLoadedPreference,
    replaceThemeAccentSnapshot,
    replaceThemePreferenceSnapshot,
    themePreference,
    themePreferenceUpdatedAt,
  } = useThemePreference();
  const {
    installationId,
    isHydrated: notificationsHydrated,
    preferences,
    preferencesUpdatedAt,
    replaceNotificationPreferencesSnapshot,
  } = usePrayerNotifications();
  const {
    isHydrated: prayerHydrated,
    prayerLogs,
    prayerLogsUpdatedAt,
    prayerPreferences,
    prayerPreferencesUpdatedAt,
    replacePrayerDataSnapshot,
    savedLocation,
    savedLocationUpdatedAt,
  } = usePrayerData();
  const [account, setAccount] = useState<GoogleDriveAccount | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasCompletedInitialSyncRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const lastUploadedSignatureRef = useRef<string | null>(null);

  const hasHydratedLocalState = hasLoadedPreference && notificationsHydrated && prayerHydrated;
  const localBackup = createPrayerAppBackupPayload({
    notificationPreferences: createTimestampedValue(
      preferences,
      preferencesUpdatedAt || syncEpochTimestamp,
    ),
    prayerLogs: createTimestampedValue(prayerLogs, prayerLogsUpdatedAt || syncEpochTimestamp),
    prayerPreferences: createTimestampedValue(
      prayerPreferences,
      prayerPreferencesUpdatedAt || syncEpochTimestamp,
    ),
    savedLocation: createTimestampedValue(savedLocation, savedLocationUpdatedAt || syncEpochTimestamp),
    themeAccent: createTimestampedValue(
      accentTheme,
      accentThemeUpdatedAt || syncEpochTimestamp,
    ),
    themePreference: createTimestampedValue(
      themePreference,
      themePreferenceUpdatedAt || syncEpochTimestamp,
    ),
  });
  const localBackupSignature = JSON.stringify(localBackup);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const snapshot = await loadGoogleDriveSessionSnapshot();

      if (!isMounted) {
        return;
      }

      setAccount(snapshot?.account ?? null);
      setSessionToken(snapshot?.sessionToken ?? null);
      setHasLoadedSession(true);
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const activeSessionToken = sessionToken;
    if (!hasLoadedSession || !activeSessionToken) {
      return;
    }
    const sessionTokenValue = activeSessionToken;

    let isMounted = true;

    async function validateSession() {
      try {
        const session = await fetchGoogleDriveSession(sessionTokenValue);

        if (!isMounted) {
          return;
        }

        setAccount(session.account);
        await saveGoogleDriveSessionSnapshot({
          account: session.account,
          sessionToken: sessionTokenValue,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        await clearPersistedSession();
      }
    }

    void validateSession();

    return () => {
      isMounted = false;
    };
  }, [hasLoadedSession, sessionToken]);

  async function clearPersistedSession() {
    hasCompletedInitialSyncRef.current = false;
    lastUploadedSignatureRef.current = null;
    setAccount(null);
    setLastSyncedAt(null);
    setSessionToken(null);
    await clearGoogleDriveSessionSnapshot();
  }

  async function uploadBackup(signature: string) {
    if (!sessionToken || !hasMeaningfulPrayerAppBackupData(localBackup)) {
      lastUploadedSignatureRef.current = signature;
      return;
    }

    const response = await upsertGoogleDriveBackup(sessionToken, {
      backup: localBackup,
    });

    lastUploadedSignatureRef.current = JSON.stringify(response.backup);
    setLastSyncedAt(response.modifiedAt);
  }

  async function syncNow() {
    if (!sessionToken || !hasHydratedLocalState) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const remote = await fetchGoogleDriveBackup(sessionToken);
      const mergedBackup = remote.backup ? mergePrayerAppBackupPayload(localBackup, remote.backup) : localBackup;
      const mergedSignature = JSON.stringify(mergedBackup);
      const remoteSignature = remote.backup ? JSON.stringify(remote.backup) : null;

      if (mergedSignature !== localBackupSignature) {
        isApplyingRemoteRef.current = true;
        lastUploadedSignatureRef.current = mergedSignature;

        await Promise.all([
          replaceThemeAccentSnapshot(mergedBackup.themeAccent),
          replaceThemePreferenceSnapshot(mergedBackup.themePreference),
          replacePrayerDataSnapshot({
            prayerLogs: mergedBackup.prayerLogs,
            prayerPreferences: mergedBackup.prayerPreferences,
            savedLocation: mergedBackup.savedLocation,
          }),
          replaceNotificationPreferencesSnapshot(mergedBackup.notificationPreferences),
        ]);
      }

      if (hasMeaningfulPrayerAppBackupData(mergedBackup) && mergedSignature !== remoteSignature) {
        const uploadResponse = await upsertGoogleDriveBackup(sessionToken, {
          backup: mergedBackup,
        });
        lastUploadedSignatureRef.current = JSON.stringify(uploadResponse.backup);
        setLastSyncedAt(uploadResponse.modifiedAt);
      } else {
        lastUploadedSignatureRef.current = mergedSignature;
        setLastSyncedAt(remote.modifiedAt ?? mergedBackup.exportedAt);
      }

      hasCompletedInitialSyncRef.current = true;
    } catch (error) {
      const message = getErrorMessage(error);
      if (isSessionError(message)) {
        await clearPersistedSession();
      }
      setSyncError(message);
    } finally {
      isApplyingRemoteRef.current = false;
      setIsSyncing(false);
    }
  }

  async function connect() {
    if (!installationId) {
      setSyncError('Device installation is still loading. Try again in a moment.');
      return;
    }

    setIsConnecting(true);
    setSyncError(null);

    try {
      const redirectUri = Linking.createURL('auth-complete');
      const authStart = await startGoogleDriveAuth({
        installationId,
        platform: getAppPlatform(),
        redirectUri,
      });
      const authResult = await WebBrowser.openAuthSessionAsync(authStart.authUrl, redirectUri);

      if (authResult.type !== 'success' || !('url' in authResult)) {
        return;
      }

      const parsed = Linking.parse(authResult.url);
      const queryParams = parsed.queryParams ?? {};
      const returnedState = typeof queryParams.state === 'string' ? queryParams.state : null;
      const returnedStatus = typeof queryParams.status === 'string' ? queryParams.status : null;
      const returnedError = typeof queryParams.error === 'string' ? queryParams.error : null;

      if (returnedState !== authStart.state) {
        throw new Error('Google auth completed with an unexpected state token.');
      }

      if (returnedStatus === 'error') {
        throw new Error(returnedError ?? 'Google authentication failed.');
      }

      const completedAuth = await completeGoogleDriveAuth({
        installationId,
        state: authStart.state,
      });

      setAccount(completedAuth.account);
      setSessionToken(completedAuth.sessionToken);
      hasCompletedInitialSyncRef.current = false;
      lastUploadedSignatureRef.current = null;

      await saveGoogleDriveSessionSnapshot({
        account: completedAuth.account,
        sessionToken: completedAuth.sessionToken,
      });
    } catch (error) {
      setSyncError(getErrorMessage(error));
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnect() {
    if (sessionToken) {
      try {
        await disconnectGoogleDriveSession(sessionToken);
      } catch (error) {
        console.warn('[drive-sync] Failed to revoke Google Drive session during disconnect.', error);
        setSyncError(getErrorMessage(error));
      }
    }

    await clearPersistedSession();
  }

  async function exportDocument(folderName: string, fileName: string, content: string, mimeType: string) {
    if (!sessionToken) {
      return null;
    }
    
    try {
      const response = await exportGoogleDriveDocument(sessionToken, {
        folderName,
        fileName,
        content,
        mimeType,
      });
      return response;
    } catch (error) {
      setSyncError(getErrorMessage(error));
      return null;
    }
  }

  async function syncToCalendar(events: Array<{ summary: string; start: string; end: string; description?: string }>) {
    if (!sessionToken) {
      return null;
    }

    try {
      const response = await syncGoogleCalendarEvents(sessionToken, { events });
      return response;
    } catch (error) {
      setSyncError(getErrorMessage(error));
      return null;
    }
  }

  useEffect(() => {
    if (!hasLoadedSession || !sessionToken || !hasHydratedLocalState || hasCompletedInitialSyncRef.current) {
      return;
    }

    void syncNow();
  }, [hasHydratedLocalState, hasLoadedSession, sessionToken, localBackupSignature]);

  useEffect(() => {
    if (
      !hasLoadedSession ||
      !sessionToken ||
      !hasHydratedLocalState ||
      !hasCompletedInitialSyncRef.current ||
      isApplyingRemoteRef.current ||
      !hasMeaningfulPrayerAppBackupData(localBackup) ||
      lastUploadedSignatureRef.current === localBackupSignature
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          setIsSyncing(true);
          setSyncError(null);
          await uploadBackup(localBackupSignature);
        } catch (error) {
          const message = getErrorMessage(error);
          if (isSessionError(message)) {
            await clearPersistedSession();
          }
          setSyncError(message);
        } finally {
          setIsSyncing(false);
        }
      })();
    }, 1_500);

    return () => {
      clearTimeout(timeout);
    };
  }, [hasHydratedLocalState, hasLoadedSession, localBackup, localBackupSignature, sessionToken]);

  return (
    <GoogleDriveSyncContext.Provider
      value={{
        account,
        connect,
        disconnect,
        hasLoadedSession,
        isConnecting,
        isSyncing,
        lastSyncedAt,
        sessionToken,
        syncError,
        syncNow,
        exportDocument,
        syncToCalendar,
      }}
    >
      {children}
    </GoogleDriveSyncContext.Provider>
  );
}

export function useGoogleDriveSync() {
  const context = useContext(GoogleDriveSyncContext);

  if (!context) {
    throw new Error('useGoogleDriveSync must be used inside GoogleDriveSyncProvider.');
  }

  return context;
}
