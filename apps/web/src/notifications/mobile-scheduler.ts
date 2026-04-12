import {
  createRollingPrayerNotificationSchedule,
  type NotificationPermissionState,
  type NotificationScheduleJob,
  type PrayerNotificationPreferences,
  type PrayerPreferences,
  type SavedLocation,
} from '@prayer-app/core';

export const notificationWindowDays = 5;

export const nativeNotificationSoundFiles = {
  athan: 'athan.wav',
  reminder: 'reminder.wav',
} as const;

export interface NativeNotificationRequest {
  content: {
    body: string;
    data: Record<string, string>;
    sound: string;
    title: string;
  };
  identifier: string;
  trigger: {
    channelId: NotificationScheduleJob['channelId'];
    date: Date;
    type: 'date';
  };
}

export interface NativeNotificationScheduler {
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  scheduleNotificationAsync: (request: NativeNotificationRequest) => Promise<string>;
}

export interface NativeNotificationSyncPlan {
  jobs: NotificationScheduleJob[];
  reason: 'missing-location' | 'permission-denied' | 'scheduled';
  shouldClearExisting: boolean;
}

export function buildRollingNotificationSchedule({
  notificationPreferences,
  now = new Date(),
  prayerPreferences,
  savedLocation,
  startDateKey,
  windowDays = notificationWindowDays,
}: {
  notificationPreferences: PrayerNotificationPreferences;
  now?: Date;
  prayerPreferences: PrayerPreferences;
  savedLocation: SavedLocation;
  startDateKey: string;
  windowDays?: number;
}) {
  return createRollingPrayerNotificationSchedule({
    notificationPreferences,
    now,
    prayerPreferences,
    savedLocation,
    startDateKey,
    windowDays,
  });
}

export function createNativeNotificationSyncPlan({
  notificationPreferences,
  permissionState,
  now = new Date(),
  prayerPreferences,
  savedLocation,
  startDateKey,
  windowDays = notificationWindowDays,
}: {
  notificationPreferences: PrayerNotificationPreferences;
  permissionState: NotificationPermissionState;
  now?: Date;
  prayerPreferences: PrayerPreferences;
  savedLocation: SavedLocation | null;
  startDateKey: string;
  windowDays?: number;
}): NativeNotificationSyncPlan {
  if (permissionState !== 'granted') {
    return {
      jobs: [],
      reason: 'permission-denied',
      shouldClearExisting: true,
    };
  }

  if (!savedLocation) {
    return {
      jobs: [],
      reason: 'missing-location',
      shouldClearExisting: true,
    };
  }

  return {
    jobs: buildRollingNotificationSchedule({
      notificationPreferences,
      now,
      prayerPreferences,
      savedLocation,
      startDateKey,
      windowDays,
    }),
    reason: 'scheduled',
    shouldClearExisting: true,
  };
}

export function createNativeNotificationRequest(job: NotificationScheduleJob): NativeNotificationRequest {
  return {
    content: {
      body: job.body,
      data: {
        city: job.city,
        fireAt: job.fireAt,
        jobId: job.id,
        kind: job.kind,
        prayerName: job.prayerName,
        soundKey: job.soundKey,
      },
      sound: nativeNotificationSoundFiles[job.soundKey],
      title: job.title,
    },
    identifier: job.id,
    trigger: {
      channelId: job.channelId,
      date: new Date(job.fireAt),
      type: 'date',
    },
  };
}

export async function applyNativePrayerNotificationSchedule(
  scheduler: NativeNotificationScheduler,
  jobs: NotificationScheduleJob[],
  now = new Date(),
) {
  await scheduler.cancelAllScheduledNotificationsAsync();

  let scheduledCount = 0;

  for (const job of jobs) {
    const fireAt = new Date(job.fireAt);
    if (Number.isNaN(fireAt.getTime()) || fireAt.getTime() <= now.getTime()) {
      continue;
    }

    await scheduler.scheduleNotificationAsync(createNativeNotificationRequest(job));
    scheduledCount += 1;
  }

  return scheduledCount;
}
