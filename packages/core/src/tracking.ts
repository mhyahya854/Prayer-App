import type {
  PrayerHistoryDay,
  PrayerLogDay,
  PrayerLogStore,
  PrayerProgressSummary,
  TrackablePrayerName,
} from './types';
import { createUtcAnchorFromDateKey, shiftDateKey } from './prayer';

export const trackablePrayerNames: TrackablePrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function createPrayerRecord() {
  return {
    Fajr: false,
    Dhuhr: false,
    Asr: false,
    Maghrib: false,
    Isha: false,
  } satisfies Record<TrackablePrayerName, boolean>;
}

function countCompleted(log: PrayerLogDay | undefined) {
  if (!log) {
    return 0;
  }

  return trackablePrayerNames.reduce(
    (count, prayerName) => count + (log.prayers[prayerName] ? 1 : 0),
    0,
  );
}

function isCompleteDay(log: PrayerLogDay | undefined) {
  return countCompleted(log) === trackablePrayerNames.length;
}

function formatHistoryLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(createUtcAnchorFromDateKey(dateKey));
}

export function createPrayerLogDay(dateKey: string): PrayerLogDay {
  return {
    dateKey,
    prayers: createPrayerRecord(),
  };
}

export function isTrackablePrayerName(prayerName: string): prayerName is TrackablePrayerName {
  return trackablePrayerNames.includes(prayerName as TrackablePrayerName);
}

export function setPrayerCompletion(
  store: PrayerLogStore,
  dateKey: string,
  prayerName: TrackablePrayerName,
  completed: boolean,
) {
  const existing = store[dateKey] ?? createPrayerLogDay(dateKey);

  return {
    ...store,
    [dateKey]: {
      ...existing,
      prayers: {
        ...existing.prayers,
        [prayerName]: completed,
      },
    },
  };
}

export function calculatePrayerMetrics(store: PrayerLogStore, todayKey: string): PrayerProgressSummary {
  const completedToday = countCompleted(store[todayKey]);

  let currentStreak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const key = shiftDateKey(todayKey, -offset);
    if (!isCompleteDay(store[key])) {
      break;
    }
    currentStreak += 1;
  }

  const orderedKeys = Object.keys(store).sort((left, right) => left.localeCompare(right));
  let bestStreak = 0;
  let runningStreak = 0;
  let previousKey: string | null = null;

  for (const dateKey of orderedKeys) {
    const isComplete = isCompleteDay(store[dateKey]);

    if (!isComplete) {
      runningStreak = 0;
      previousKey = dateKey;
      continue;
    }

    const continuesPrevious =
      previousKey !== null &&
      shiftDateKey(previousKey, 1) === dateKey &&
      isCompleteDay(store[previousKey]);

    runningStreak = continuesPrevious ? runningStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, runningStreak);
    previousKey = dateKey;
  }

  let completedInLast7Days = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    completedInLast7Days += countCompleted(store[shiftDateKey(todayKey, -offset)]);
  }

  let completedPrayersLast30Days = 0;
  for (let offset = 0; offset < 30; offset += 1) {
    completedPrayersLast30Days += countCompleted(store[shiftDateKey(todayKey, -offset)]);
  }

  const recentDays: PrayerHistoryDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const dateKey = shiftDateKey(todayKey, -offset);
    const completedCount = countCompleted(store[dateKey]);

    recentDays.push({
      completedCount,
      dateKey,
      isComplete: completedCount === trackablePrayerNames.length,
      label: formatHistoryLabel(dateKey),
      totalCount: trackablePrayerNames.length,
    });
  }

  return {
    bestStreak,
    completedPrayersLast30Days,
    completedToday,
    currentStreak,
    last7DayCompletionRate: Math.round(
      (completedInLast7Days / (trackablePrayerNames.length * 7)) * 100,
    ),
    recentDays,
    totalTrackablePrayers: trackablePrayerNames.length,
  };
}
