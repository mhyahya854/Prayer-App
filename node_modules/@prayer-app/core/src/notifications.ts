import { computePrayerDay, formatDateKey, shiftDateKey } from './prayer';
import { isTrackablePrayerName, trackablePrayerNames } from './tracking';
import type {
  NotificationScheduleJob,
  NotifiablePrayerName,
  PrayerDay,
  PrayerNotificationPreferences,
  PrayerPreReminderMinutes,
  PrayerPreferences,
  SavedLocation,
} from './types';

export const notificationPreReminderOptions: Array<{
  label: string;
  value: PrayerPreReminderMinutes;
}> = [
  { label: 'Off', value: null },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
];

export const notifiablePrayerNames = [...trackablePrayerNames] satisfies NotifiablePrayerName[];

export function getDefaultPrayerNotificationPreferences(): PrayerNotificationPreferences {
  return {
    enabledPrayers: {
      Fajr: true,
      Dhuhr: true,
      Asr: true,
      Maghrib: true,
      Isha: true,
    },
    preReminderMinutes: null,
  };
}

export function isNotifiablePrayerName(prayerName: string): prayerName is NotifiablePrayerName {
  return isTrackablePrayerName(prayerName);
}

export function createPrayerNotificationScheduleJobs(
  prayerDay: PrayerDay,
  preferences: PrayerNotificationPreferences,
  now = new Date(),
): NotificationScheduleJob[] {
  const jobs: NotificationScheduleJob[] = [];

  for (const prayer of prayerDay.prayers) {
    if (!isNotifiablePrayerName(prayer.name) || !prayer.isoTime) {
      continue;
    }

    if (!preferences.enabledPrayers[prayer.name]) {
      continue;
    }

    const prayerDate = new Date(prayer.isoTime);
    if (Number.isNaN(prayerDate.getTime())) {
      continue;
    }

    const dateKey = formatDateKey(prayerDate, prayerDay.timeZone);
    const startJob = createScheduleJob({
      city: prayerDay.city,
      dateKey,
      fireAt: prayerDate,
      kind: 'prayer-start',
      prayerName: prayer.name,
      prayerTimeLabel: prayer.time,
    });

    if (prayerDate.getTime() > now.getTime()) {
      jobs.push(startJob);
    }

    if (!preferences.preReminderMinutes) {
      continue;
    }

    const reminderDate = new Date(prayerDate.getTime() - preferences.preReminderMinutes * 60_000);
    if (reminderDate.getTime() <= now.getTime()) {
      continue;
    }

    jobs.push(
      createScheduleJob({
        city: prayerDay.city,
        dateKey,
        fireAt: reminderDate,
        kind: 'pre-reminder',
        preReminderMinutes: preferences.preReminderMinutes,
        prayerName: prayer.name,
        prayerTimeLabel: prayer.time,
      }),
    );
  }

  return jobs.sort((left, right) => Date.parse(left.fireAt) - Date.parse(right.fireAt));
}

export function createRollingPrayerNotificationSchedule({
  notificationPreferences,
  now = new Date(),
  prayerPreferences,
  savedLocation,
  startDateKey,
  windowDays = 5,
}: {
  notificationPreferences: PrayerNotificationPreferences;
  now?: Date;
  prayerPreferences: PrayerPreferences;
  savedLocation: SavedLocation;
  startDateKey: string;
  windowDays?: number;
}) {
  const jobs: NotificationScheduleJob[] = [];

  for (let offset = 0; offset < windowDays; offset += 1) {
    const dateKey = shiftDateKey(startDateKey, offset);
    const prayerDay = computePrayerDay({
      coordinates: savedLocation.coordinates,
      dateKey,
      locationLabel: savedLocation.label,
      now,
      preferences: prayerPreferences,
      timeZone: savedLocation.timeZone,
    });

    jobs.push(...createPrayerNotificationScheduleJobs(prayerDay, notificationPreferences, now));
  }

  return jobs.sort((left, right) => Date.parse(left.fireAt) - Date.parse(right.fireAt));
}

function createScheduleJob({
  city,
  dateKey,
  fireAt,
  kind,
  preReminderMinutes,
  prayerName,
  prayerTimeLabel,
}: {
  city: string;
  dateKey: string;
  fireAt: Date;
  kind: NotificationScheduleJob['kind'];
  preReminderMinutes?: PrayerPreReminderMinutes;
  prayerName: NotifiablePrayerName;
  prayerTimeLabel: string;
}): NotificationScheduleJob {
  const isPrayerStart = kind === 'prayer-start';

  return {
    body: isPrayerStart
      ? `It's time for ${prayerName} in ${city}.`
      : `${prayerName} begins in ${preReminderMinutes} minutes at ${prayerTimeLabel}.`,
    channelId: kind,
    city,
    dateKey,
    fireAt: fireAt.toISOString(),
    id: `${dateKey}:${prayerName}:${kind}`,
    kind,
    prayerName,
    soundKey: isPrayerStart ? 'athan' : 'reminder',
    title: isPrayerStart ? `${prayerName} Time` : `${prayerName} Soon`,
  };
}
