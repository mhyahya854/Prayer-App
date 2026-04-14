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
import { AppState } from 'react-native';

import {
  loadNotificationInstallationId,
  loadNotificationPreferences,
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
import { usePrayerData } from '@/src/prayer/prayer-provider';

const athanSoundSource = require('../../assets/sounds/athan.wav');
const reminderSoundSource = require('../../assets/sounds/reminder.wav');

void Promise.resolve(preload(athanSoundSource)).catch(() => undefined);
void Promise.resolve(preload(reminderSoundSource)).catch(() => undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    priority: Notifications.AndroidNotificationPriority.MAX,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type NotificationCapability = 'local' | 'unsupported';

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

  if (value.granted === true || value.status === Notifications.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (value.canAskAgain === false || value.status === Notifications.PermissionStatus.DENIED) {
    return 'denied';
  }

  return 'unknown';
}

async function configureAndroidChannels() {
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
  const lastDayKeyRef = useRef<string | null>(null);
  const notificationCapability: NotificationCapability = 'local';

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
    }).catch(() => undefined);
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
      const permissions = await Notifications.getPermissionsAsync();
      await configureAndroidChannels();

      if (isMounted) {
        setPermissionState(mapNativePermissionStatus(permissions));
        setIsHydrated(true);
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
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

  async function syncNow() {
    if (!isHydrated || !isPrayerHydrated) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await syncNativeNotifications();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to sync notification schedules.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function requestPermission() {
    setSyncError(null);

    const result = await Notifications.requestPermissionsAsync();
    const nextState = mapNativePermissionStatus(result);
    setPermissionState(nextState);

    if (nextState === 'granted') {
      await configureAndroidChannels();
      if (!savedLocation) {
        await refreshLocation().catch(() => undefined);
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

      void Notifications.getPermissionsAsync().then((permissions) => {
        setPermissionState(mapNativePermissionStatus(permissions));
      });

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
