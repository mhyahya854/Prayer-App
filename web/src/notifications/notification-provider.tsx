import { preload, setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import {
  formatDateKey,
  getDefaultPrayerNotificationPreferences,
  type NotificationPermissionState,
  type NotifiablePrayerName,
  type PrayerNotificationPreferences,
  type PrayerPreReminderMinutes,
  type TimestampedValue,
} from '@prayer-app/core';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { appConfig } from '@/src/config/app-config';
import {
  disableWebNotifications,
  syncWebNotifications,
} from '@/src/lib/api/client';
import {
  loadNotificationInstallationId,
  loadNotificationPreferencesSnapshot,
  saveNotificationInstallationId,
  saveNotificationPreferences,
} from '@/src/lib/storage/notification-storage';
import {
  applyNativePrayerNotificationSchedule,
  createNativeNotificationSyncPlan,
  nativeNotificationSoundFiles,
  notificationWindowDays,
} from '@/src/notifications/mobile-scheduler';
import {
  ensureWebPushSubscription,
  getWebPushSubscription,
  isWebPushSupported,
  registerNotificationServiceWorker,
  removeWebPushSubscription,
} from '@/src/notifications/web-push';
import { usePrayerData } from '@/src/prayer/prayer-provider';

const athanSoundSource = require('../../assets/sounds/athan.wav');
const reminderSoundSource = require('../../assets/sounds/reminder.wav');

function logRecoverableNotificationError(scope: string, error: unknown) {
  console.warn(`[notifications] ${scope}`, error);
}

void Promise.resolve(preload(athanSoundSource)).catch((error) => {
  logRecoverableNotificationError('Unable to preload athan sound.', error);
  return undefined;
});
void Promise.resolve(preload(reminderSoundSource)).catch((error) => {
  logRecoverableNotificationError('Unable to preload reminder sound.', error);
  return undefined;
});

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      priority: Notifications.AndroidNotificationPriority.MAX,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type NotificationCapability = 'local' | 'unsupported' | 'web-push';

interface PrayerNotificationContextValue {
  capability: NotificationCapability;
  installationId: string | null;
  isHydrated: boolean;
  isSyncing: boolean;
  lastScheduledCount: number;
  permissionState: NotificationPermissionState;
  preferences: PrayerNotificationPreferences;
  preferencesUpdatedAt: string;
  replaceNotificationPreferencesSnapshot: (
    snapshot: TimestampedValue<PrayerNotificationPreferences>,
  ) => Promise<void>;
  requestPermission: () => Promise<void>;
  setPreReminderMinutes: (value: PrayerPreReminderMinutes) => Promise<void>;
  setPrayerEnabled: (prayerName: NotifiablePrayerName, enabled: boolean) => Promise<void>;
  syncError: string | null;
  syncNow: () => Promise<void>;
}

const PrayerNotificationContext = createContext<PrayerNotificationContextValue | null>(null);

function createInstallationId() {
  return `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapNativePermissionStatus(permissions: unknown): NotificationPermissionState {
  const value =
    typeof permissions === 'object' && permissions !== null
      ? (permissions as Record<string, unknown>)
      : {};

  if (value.granted === true) {
    return 'granted';
  }

  if (value.status === Notifications.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (value.canAskAgain === false || value.status === Notifications.PermissionStatus.DENIED) {
    return 'denied';
  }

  return 'unknown';
}

function getWebPermissionState(): NotificationPermissionState {
  if (!isWebPushSupported()) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  return 'unknown';
}

async function configureAndroidChannels() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('prayer-start', {
    importance: Notifications.AndroidImportance.MAX,
    lightColor: '#0C8C6C',
    name: 'Prayer start',
    sound: nativeNotificationSoundFiles.athan,
    vibrationPattern: [0, 300, 150, 300],
  });

  await Notifications.setNotificationChannelAsync('pre-reminder', {
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#A87A2A',
    name: 'Prayer reminder',
    sound: nativeNotificationSoundFiles.reminder,
    vibrationPattern: [0, 180, 100, 180],
  });
}

export function PrayerNotificationProvider({ children }: PropsWithChildren) {
  const { isHydrated: isPrayerHydrated, prayerPreferences, refreshLocation, savedLocation, todayKey } =
    usePrayerData();
  const athanPlayer = useAudioPlayer(athanSoundSource);
  const reminderPlayer = useAudioPlayer(reminderSoundSource);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastScheduledCount, setLastScheduledCount] = useState(0);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>('unknown');
  const [preferences, setPreferences] = useState<PrayerNotificationPreferences>(
    getDefaultPrayerNotificationPreferences(),
  );
  const [preferencesUpdatedAt, setPreferencesUpdatedAt] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastDayKeyRef = useRef<string | null>(null);
  const notificationCapability: NotificationCapability =
    Platform.OS === 'web' ? (isWebPushSupported() ? 'web-push' : 'unsupported') : 'local';

  const syncSignature = useMemo(
    () =>
      JSON.stringify({
        notificationPreferences: preferences,
        prayerPreferences,
        savedLocation,
        todayKey,
      }),
    [preferences, prayerPreferences, savedLocation, todayKey],
  );

  useEffect(() => {
    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    }).catch((error) => {
      logRecoverableNotificationError('Unable to set audio mode for notifications.', error);
      return undefined;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const [storedPreferences, storedInstallationId] = await Promise.all([
        loadNotificationPreferencesSnapshot(),
        loadNotificationInstallationId(),
      ]);

      const resolvedInstallationId = storedInstallationId ?? createInstallationId();
      if (!storedInstallationId) {
        await saveNotificationInstallationId(resolvedInstallationId);
      }

      if (!isMounted) {
        return;
      }

      setPreferences(storedPreferences.value);
      setPreferencesUpdatedAt(storedPreferences.updatedAt);
      setInstallationId(resolvedInstallationId);

      if (Platform.OS === 'web') {
        setPermissionState(getWebPermissionState());
        serviceWorkerRegistrationRef.current = isWebPushSupported()
          ? await registerNotificationServiceWorker()
          : null;
      } else {
        const permissions = await Notifications.getPermissionsAsync();
        setPermissionState(mapNativePermissionStatus(permissions));
        await configureAndroidChannels();
      }

      if (isMounted) {
        setIsHydrated(true);
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isHydrated || !isWebPushSupported()) {
      return;
    }

    const handleServiceWorkerMessage: EventListener = (event) => {
      const messageEvent = event as MessageEvent<{ type?: string; payload?: Record<string, string> }>;

      if (messageEvent.data?.type !== 'prayer-notification' || document.visibilityState !== 'visible') {
        return;
      }

      const soundKey = messageEvent.data.payload?.soundKey;
      void (async () => {
        if (soundKey === 'athan') {
          await athanPlayer.seekTo(0);
          athanPlayer.play();
          return;
        }

        if (soundKey === 'reminder') {
          await reminderPlayer.seekTo(0);
          reminderPlayer.play();
        }
      })();
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [athanPlayer, isHydrated, reminderPlayer]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const soundKey = notification.request.content.data?.soundKey;

      if (soundKey === 'athan') {
        void athanPlayer.seekTo(0).then(() => {
          athanPlayer.play();
        });
        return;
      }

      if (soundKey === 'reminder') {
        void reminderPlayer.seekTo(0).then(() => {
          reminderPlayer.play();
        });
      }
    });

    return () => {
      receivedSubscription.remove();
    };
  }, [athanPlayer, reminderPlayer]);

  async function persistPreferences(
    nextPreferences: PrayerNotificationPreferences,
    updatedAt = new Date().toISOString(),
  ) {
    setPreferences(nextPreferences);
    setPreferencesUpdatedAt(updatedAt);
    await saveNotificationPreferences(nextPreferences, updatedAt);
  }

  async function replaceNotificationPreferencesSnapshot(
    snapshot: TimestampedValue<PrayerNotificationPreferences>,
  ) {
    setPreferences(snapshot.value);
    setPreferencesUpdatedAt(snapshot.updatedAt);
    await saveNotificationPreferences(snapshot.value, snapshot.updatedAt);
  }

  async function syncNativeNotifications() {
    const now = new Date();
    const plan = createNativeNotificationSyncPlan({
      notificationPreferences: preferences,
      now,
      permissionState,
      prayerPreferences,
      savedLocation,
      startDateKey: todayKey,
      windowDays: notificationWindowDays,
    });

    const count = await applyNativePrayerNotificationSchedule(Notifications, plan.jobs, now);
    setLastScheduledCount(count);
  }

  async function syncWebPushNotifications() {
    if (!installationId || !savedLocation) {
      setLastScheduledCount(0);
      return;
    }

    if (!isWebPushSupported()) {
      setPermissionState('unsupported');
      setLastScheduledCount(0);
      return;
    }

    const registration =
      serviceWorkerRegistrationRef.current ?? (await registerNotificationServiceWorker());
    serviceWorkerRegistrationRef.current = registration;

    if (!registration) {
      throw new Error('Web push registration is unavailable in this browser.');
    }

    if (permissionState !== 'granted') {
      const existingSubscription = await getWebPushSubscription(registration);
      if (existingSubscription) {
        try {
          await disableWebNotifications({
            installationId,
            platform: 'web',
          });
        } catch (error) {
          logRecoverableNotificationError('Unable to disable web notifications after permission loss.', error);
        }
      }

      try {
        await removeWebPushSubscription(registration);
      } catch (error) {
        logRecoverableNotificationError('Unable to remove browser push subscription after permission loss.', error);
      }
      setLastScheduledCount(0);
      return;
    }

    if (!appConfig.webPushPublicKey) {
      throw new Error('Web push is enabled in the app, but EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY is missing.');
    }

    const pushSubscription = await ensureWebPushSubscription(registration, appConfig.webPushPublicKey);
    const response = await syncWebNotifications({
      installationId,
      notificationPreferences: preferences,
      platform: 'web',
      prayerPreferences,
      pushSubscription,
      savedLocation,
    });

    setLastScheduledCount(response.scheduledJobCount);
  }

  async function syncNow() {
    if (!isHydrated || !isPrayerHydrated) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      if (Platform.OS === 'web') {
        await syncWebPushNotifications();
      } else {
        await syncNativeNotifications();
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to sync notification schedules.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function requestPermission() {
    setSyncError(null);

    if (Platform.OS === 'web') {
      if (!isWebPushSupported()) {
        setPermissionState('unsupported');
        return;
      }

      const result = await Notification.requestPermission();
      const nextState =
        result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'unknown';
      setPermissionState(nextState);

      if (nextState === 'granted' && !savedLocation) {
        try {
          await refreshLocation();
        } catch (error) {
          logRecoverableNotificationError('Unable to refresh location after granting web notification permissions.', error);
          setSyncError('Notification permission was granted, but location refresh failed. Please refresh location manually.');
        }
      }
      return;
    }

    const result = await Notifications.requestPermissionsAsync();
    const nextState = mapNativePermissionStatus(result);
    setPermissionState(nextState);

    if (nextState === 'granted') {
      await configureAndroidChannels();
      if (!savedLocation) {
        try {
          await refreshLocation();
        } catch (error) {
          logRecoverableNotificationError('Unable to refresh location after granting native notification permissions.', error);
          setSyncError('Notification permission was granted, but location refresh failed. Please refresh location manually.');
        }
      }
    }
  }

  async function setPrayerEnabled(prayerName: NotifiablePrayerName, enabled: boolean) {
    await persistPreferences({
      ...preferences,
      enabledPrayers: {
        ...preferences.enabledPrayers,
        [prayerName]: enabled,
      },
    });
  }

  async function setPreReminderMinutes(value: PrayerPreReminderMinutes) {
    await persistPreferences({
      ...preferences,
      preReminderMinutes: value,
    });
  }

  useEffect(() => {
    if (!isHydrated || !isPrayerHydrated) {
      return;
    }

    lastDayKeyRef.current = todayKey;
    void syncNow();
  }, [isHydrated, isPrayerHydrated, syncSignature]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      if (Platform.OS === 'web') {
        setPermissionState(getWebPermissionState());
      } else {
        void Notifications.getPermissionsAsync().then((permissions) => {
          setPermissionState(mapNativePermissionStatus(permissions));
        });
      }

      void syncNow();
    });

    return () => {
      subscription.remove();
    };
  }, [syncSignature]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDayKey = formatDateKey(new Date(), savedLocation?.timeZone ?? null);
      if (lastDayKeyRef.current === nextDayKey) {
        return;
      }

      lastDayKeyRef.current = nextDayKey;
      void syncNow();
    }, 60_000);

    return () => {
      clearInterval(interval);
    };
  }, [savedLocation?.timeZone, syncSignature]);

  return (
    <PrayerNotificationContext.Provider
      value={{
        capability: notificationCapability,
        installationId,
        isHydrated,
        isSyncing,
        lastScheduledCount,
        permissionState,
        preferences,
        preferencesUpdatedAt,
        replaceNotificationPreferencesSnapshot,
        requestPermission,
        setPreReminderMinutes,
        setPrayerEnabled,
        syncError,
        syncNow,
      }}
    >
      {children}
    </PrayerNotificationContext.Provider>
  );
}

export function usePrayerNotifications() {
  const context = useContext(PrayerNotificationContext);

  if (!context) {
    throw new Error('usePrayerNotifications must be used inside PrayerNotificationProvider.');
  }

  return context;
}
