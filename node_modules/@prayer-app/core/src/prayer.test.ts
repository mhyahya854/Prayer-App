import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPrayerNotificationScheduleJobs,
  calculatePrayerMetrics,
  computePrayerDay,
  formatDateKey,
  getDefaultPrayerNotificationPreferences,
  getDefaultPrayerPreferences,
  setPrayerCompletion,
  shiftDateKey,
  type PrayerLogStore,
} from './index';

test('computePrayerDay returns the full prayer schedule in order', () => {
  const result = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    date: new Date(2026, 2, 24),
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
      madhab: 'shafi',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(result.city, 'Kuala Lumpur');
  assert.equal(result.methodLabel, 'Singapore / Malaysia');
  assert.equal(result.madhabLabel, 'Shafi');
  assert.deepEqual(
    result.prayers.map((prayer) => prayer.name),
    ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
  );
  assert.equal(result.prayers.length, 6);
});

test('formatDateKey respects extreme timezone offsets around midnight', () => {
  const anchor = new Date('2026-03-24T23:30:00Z');

  assert.equal(formatDateKey(anchor, 'Pacific/Kiritimati'), '2026-03-25');
  assert.equal(formatDateKey(anchor, 'Pacific/Honolulu'), '2026-03-24');
});

test('computePrayerDay derives the calculation day from the saved location timezone', () => {
  const result = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    date: new Date('2026-03-24T16:30:00Z'),
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(result.gregorianDate, 'March 25, 2026');
});

test('saved timezone wins when the saved prayer day differs from the device-local day', () => {
  const anchor = new Date('2026-03-25T00:30:00.000Z');
  const result = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    date: anchor,
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(formatDateKey(anchor, 'Pacific/Honolulu'), '2026-03-24');
  assert.equal(formatDateKey(anchor, 'Asia/Kuala_Lumpur'), '2026-03-25');
  assert.equal(result.gregorianDate, 'March 25, 2026');
});

test('computePrayerDay moves to the next saved-location calendar day after midnight', () => {
  const beforeMidnight = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    date: new Date('2026-03-25T15:59:00.000Z'),
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const afterMidnight = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    date: new Date('2026-03-25T16:01:00.000Z'),
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(beforeMidnight.gregorianDate, 'March 25, 2026');
  assert.equal(afterMidnight.gregorianDate, 'March 26, 2026');
});

test('switching from a device location to a manual location swaps the active prayer day inputs', () => {
  const anchor = new Date('2026-03-25T00:30:00.000Z');
  const deviceLocationDay = computePrayerDay({
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    date: anchor,
    locationLabel: 'New York City',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'north-america',
    },
    timeZone: 'America/New_York',
  });
  const manualLocationDay = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    date: anchor,
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(deviceLocationDay.gregorianDate, 'March 24, 2026');
  assert.equal(manualLocationDay.gregorianDate, 'March 25, 2026');
  assert.notEqual(deviceLocationDay.prayers[0]?.isoTime, manualLocationDay.prayers[0]?.isoTime);
});

test('manual timezone override changes the chosen prayer day even when coordinates stay the same', () => {
  const anchor = new Date('2026-03-25T00:30:00.000Z');
  const coordinateDerivedDay = computePrayerDay({
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    date: anchor,
    locationLabel: 'New York City',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'north-america',
    },
    timeZone: 'America/New_York',
  });
  const manualOverrideDay = computePrayerDay({
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    date: anchor,
    locationLabel: 'New York City',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'north-america',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(coordinateDerivedDay.gregorianDate, 'March 24, 2026');
  assert.equal(manualOverrideDay.gregorianDate, 'March 26, 2026');
});

test('calculation methods produce different schedules for the same coordinates', () => {
  const defaults = getDefaultPrayerPreferences();
  const location = {
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    dateKey: '2026-03-25',
    locationLabel: 'New York City',
    timeZone: 'America/New_York',
  } as const;

  const muslimWorldLeague = computePrayerDay({
    ...location,
    preferences: {
      ...defaults,
      calculationMethod: 'muslim-world-league',
    },
  });
  const northAmerica = computePrayerDay({
    ...location,
    preferences: {
      ...defaults,
      calculationMethod: 'north-america',
    },
  });

  assert.notEqual(muslimWorldLeague.prayers[0]?.isoTime, northAmerica.prayers[0]?.isoTime);
});

test('hanafi madhab produces a later Asr than shafi for the same day', () => {
  const defaults = getDefaultPrayerPreferences();
  const shafi = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...defaults,
      calculationMethod: 'singapore',
      madhab: 'shafi',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const hanafi = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...defaults,
      calculationMethod: 'singapore',
      madhab: 'hanafi',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.ok(
    Date.parse(hanafi.prayers[3]?.isoTime ?? '') > Date.parse(shafi.prayers[3]?.isoTime ?? ''),
  );
});

test('manual minute adjustments move the computed prayer time', () => {
  const defaults = getDefaultPrayerPreferences();
  const baseline = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...defaults,
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const adjusted = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...defaults,
      adjustments: {
        ...defaults.adjustments,
        fajr: 10,
      },
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  const baselineFajr = Date.parse(baseline.prayers[0]?.isoTime ?? '');
  const adjustedFajr = Date.parse(adjusted.prayers[0]?.isoTime ?? '');

  assert.equal(adjustedFajr - baselineFajr, 10 * 60 * 1000);
});

test('next prayer rolls over to tomorrow fajr after isha', () => {
  const baseline = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const ishaIso = baseline.prayers.find((prayer) => prayer.name === 'Isha')?.isoTime;
  const tomorrow = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: shiftDateKey('2026-03-25', 1),
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const afterIsha = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    now: new Date(Date.parse(ishaIso ?? '') + 15 * 60 * 1000),
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(afterIsha.nextPrayer, 'Fajr');
  assert.equal(afterIsha.nextPrayerTime, tomorrow.prayers[0]?.time ?? null);
});

test('next prayer points to today fajr shortly before fajr begins', () => {
  const baseline = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const fajrIso = baseline.prayers.find((prayer) => prayer.name === 'Fajr')?.isoTime;
  const beforeFajr = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    now: new Date(Date.parse(fajrIso ?? '') - 15 * 60 * 1000),
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  assert.equal(beforeFajr.nextPrayer, 'Fajr');
  assert.equal(beforeFajr.nextPrayerTime, baseline.prayers[0]?.time ?? null);
});

test('createPrayerNotificationScheduleJobs creates prayer start notifications for enabled prayers including sunrise', () => {
  const prayerDay = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });

  const jobs = createPrayerNotificationScheduleJobs(
    prayerDay,
    getDefaultPrayerNotificationPreferences(),
    new Date('2026-03-24T16:00:00.000Z'),
  );

  assert.equal(jobs.filter((job) => job.kind === 'prayer-start').length, 6);
  assert.equal(jobs.map((job) => job.prayerName).includes('Sunrise' as never), true);
});

test('createPrayerNotificationScheduleJobs includes optional pre-reminders and respects prayer toggles', () => {
  const prayerDay = computePrayerDay({
    coordinates: {
      latitude: 3.139,
      longitude: 101.6869,
    },
    dateKey: '2026-03-25',
    locationLabel: 'Kuala Lumpur',
    preferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    timeZone: 'Asia/Kuala_Lumpur',
  });
  const jobs = createPrayerNotificationScheduleJobs(
    prayerDay,
    {
      enabledPrayers: {
        Fajr: true,
        Sunrise: true,
        Dhuhr: false,
        Asr: true,
        Maghrib: true,
        Isha: true,
      },
      preReminderMinutes: 15,
    },
    new Date('2026-03-24T16:00:00.000Z'),
  );

  assert.equal(jobs.filter((job) => job.kind === 'pre-reminder').length, 5);
  assert.equal(jobs.some((job) => job.prayerName === 'Dhuhr'), false);
});

test('calculatePrayerMetrics tracks current streak as today-inclusive and best streak historically', () => {
  let store: PrayerLogStore = {};

  for (const prayerName of ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const) {
    store = setPrayerCompletion(store, '2026-03-20', prayerName, true);
    store = setPrayerCompletion(store, '2026-03-21', prayerName, true);
    store = setPrayerCompletion(store, '2026-03-22', prayerName, true);
    store = setPrayerCompletion(store, '2026-03-23', prayerName, true);
  }

  for (const prayerName of ['Fajr', 'Dhuhr', 'Asr'] as const) {
    store = setPrayerCompletion(store, '2026-03-24', prayerName, true);
  }

  const metrics = calculatePrayerMetrics(store, '2026-03-24');

  assert.equal(metrics.completedToday, 3);
  assert.equal(metrics.currentStreak, 0);
  assert.equal(metrics.bestStreak, 4);
  assert.equal(metrics.last7DayCompletionRate, 64);
  assert.equal(metrics.completedPrayersLast30Days, 27);
  assert.equal(metrics.recentDays[0]?.dateKey, '2026-03-24');
});
