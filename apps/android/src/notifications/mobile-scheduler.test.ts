import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSavedLocation,
  getDefaultPrayerNotificationPreferences,
  getDefaultPrayerPreferences,
} from '@prayer-app/core';

import {
  applyNativePrayerNotificationSchedule,
  buildRollingNotificationSchedule,
  createNativeNotificationSyncPlan,
  createNativeNotificationRequest,
} from './mobile-scheduler';

const savedLocation = createSavedLocation(
  {
    latitude: 3.139,
    longitude: 101.6869,
  },
  'Kuala Lumpur',
  'Asia/Kuala_Lumpur',
  'manual',
  'manual',
);

const newYorkManualLocation = createSavedLocation(
  {
    latitude: 40.7128,
    longitude: -74.006,
  },
  'New York City',
  'America/New_York',
  'manual',
  'manual',
);

test('buildRollingNotificationSchedule builds a five-day prayer reminder window', () => {
  const jobs = buildRollingNotificationSchedule({
    notificationPreferences: {
      ...getDefaultPrayerNotificationPreferences(),
      preReminderMinutes: 10,
    },
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });

  assert.equal(jobs.length, 50);
  assert.equal(jobs[0]?.kind, 'pre-reminder');
  assert.equal(jobs.at(-1)?.prayerName, 'Isha');
});

test('createNativeNotificationRequest maps prayer jobs into schedule requests', () => {
  const jobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
    windowDays: 1,
  });

  const request = createNativeNotificationRequest(jobs[0]);

  assert.equal(request.identifier, jobs[0]?.id);
  assert.equal(request.trigger.channelId, 'prayer-start');
  assert.equal(request.content.sound, 'athan.wav');
});

test('applyNativePrayerNotificationSchedule replaces the existing scheduled notification window', async () => {
  const scheduledRequests: string[] = [];
  const jobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
    windowDays: 2,
  });

  const scheduledCount = await applyNativePrayerNotificationSchedule(
    {
      cancelAllScheduledNotificationsAsync: async () => {
        scheduledRequests.length = 0;
      },
      scheduleNotificationAsync: async (request) => {
        scheduledRequests.push(request.identifier);
        return request.identifier;
      },
    },
    jobs,
    new Date('2026-03-24T16:00:00.000Z'),
  );

  assert.equal(scheduledCount, jobs.length);
  assert.equal(scheduledRequests.length, jobs.length);
});

test('createNativeNotificationSyncPlan avoids scheduling when permission is denied', () => {
  const plan = createNativeNotificationSyncPlan({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    permissionState: 'denied',
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });

  assert.equal(plan.reason, 'permission-denied');
  assert.equal(plan.shouldClearExisting, true);
  assert.equal(plan.jobs.length, 0);
});

test('permission revocation clears existing schedules without rescheduling', async () => {
  const scheduledRequests: string[] = [];
  const syncTime = new Date('2026-03-24T16:00:00.000Z');
  const scheduler = {
    cancelAllScheduledNotificationsAsync: async () => {
      scheduledRequests.length = 0;
    },
    scheduleNotificationAsync: async (request: { identifier: string }) => {
      scheduledRequests.push(request.identifier);
      return request.identifier;
    },
  };

  const grantedPlan = createNativeNotificationSyncPlan({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: syncTime,
    permissionState: 'granted',
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });
  await applyNativePrayerNotificationSchedule(
    scheduler,
    grantedPlan.jobs,
    syncTime,
  );
  assert.equal(scheduledRequests.length > 0, true);

  const revokedPlan = createNativeNotificationSyncPlan({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: syncTime,
    permissionState: 'denied',
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });
  const revokedCount = await applyNativePrayerNotificationSchedule(
    scheduler,
    revokedPlan.jobs,
    syncTime,
  );

  assert.equal(revokedCount, 0);
  assert.deepEqual(scheduledRequests, []);
});

test('prayer toggle changes remove jobs for disabled prayers', () => {
  const baselineJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });
  const noFajrJobs = buildRollingNotificationSchedule({
    notificationPreferences: {
      ...getDefaultPrayerNotificationPreferences(),
      enabledPrayers: {
        ...getDefaultPrayerNotificationPreferences().enabledPrayers,
        Fajr: false,
      },
    },
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });

  assert.equal(baselineJobs.length - noFajrJobs.length, 5);
  assert.equal(noFajrJobs.some((job) => job.prayerName === 'Fajr'), false);
});

test('pre-reminder changes expand the scheduled window without changing prayer-start jobs', () => {
  const withoutReminders = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });
  const withReminders = buildRollingNotificationSchedule({
    notificationPreferences: {
      ...getDefaultPrayerNotificationPreferences(),
      preReminderMinutes: 15,
    },
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });

  assert.equal(withReminders.filter((job) => job.kind === 'prayer-start').length, withoutReminders.length);
  assert.equal(withReminders.filter((job) => job.kind === 'pre-reminder').length, 25);
});

test('location changes regenerate the schedule for the new city and timezone', () => {
  const kualaLumpurJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
    windowDays: 1,
  });
  const newYorkJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation: newYorkManualLocation,
    startDateKey: '2026-03-25',
    windowDays: 1,
  });

  assert.notEqual(kualaLumpurJobs[0]?.fireAt, newYorkJobs[0]?.fireAt);
  assert.equal(newYorkJobs[0]?.city, 'New York City');
});

test('calculation method changes regenerate the notification schedule', () => {
  const singaporeJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'singapore',
    },
    savedLocation,
    startDateKey: '2026-03-25',
    windowDays: 1,
  });
  const ummAlQuraJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: {
      ...getDefaultPrayerPreferences(),
      calculationMethod: 'umm-al-qura',
    },
    savedLocation,
    startDateKey: '2026-03-25',
    windowDays: 1,
  });

  assert.notEqual(singaporeJobs[0]?.fireAt, ummAlQuraJobs[0]?.fireAt);
});

test('rolling schedules do not contain duplicate notification identifiers', () => {
  const jobs = buildRollingNotificationSchedule({
    notificationPreferences: {
      ...getDefaultPrayerNotificationPreferences(),
      preReminderMinutes: 20,
    },
    now: new Date('2026-03-24T16:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
  });

  assert.equal(new Set(jobs.map((job) => job.id)).size, jobs.length);
});

test('midnight rollover advances the schedule window to the new prayer day', () => {
  const beforeMidnightJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-25T10:00:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-25',
    windowDays: 1,
  });
  const afterMidnightJobs = buildRollingNotificationSchedule({
    notificationPreferences: getDefaultPrayerNotificationPreferences(),
    now: new Date('2026-03-25T16:05:00.000Z'),
    prayerPreferences: getDefaultPrayerPreferences(),
    savedLocation,
    startDateKey: '2026-03-26',
    windowDays: 1,
  });

  assert.equal(beforeMidnightJobs.some((job) => job.dateKey === '2026-03-25'), true);
  assert.equal(afterMidnightJobs.some((job) => job.dateKey === '2026-03-25'), false);
  assert.equal(afterMidnightJobs.every((job) => job.dateKey === '2026-03-26'), true);
});
