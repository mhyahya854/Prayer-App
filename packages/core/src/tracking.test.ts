import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculatePrayerMetrics,
  createPrayerLogDay,
  setPrayerCompletion,
  trackablePrayerNames,
} from './tracking';

test('calculatePrayerMetrics handles an empty store gracefully', () => {
  const metrics = calculatePrayerMetrics({}, '2026-03-25');

  assert.equal(metrics.completedToday, 0);
  assert.equal(metrics.currentStreak, 0);
  assert.equal(metrics.bestStreak, 0);
  assert.equal(metrics.last7DayCompletionRate, 0);
});

test('calculatePrayerMetrics detects a multi-day streak correctly', () => {
  let store = {};
  const d1 = '2026-03-20';
  const d2 = '2026-03-21';
  const d3 = '2026-03-22';

  // Complete all prayers for 3 days
  for (const date of [d1, d2, d3]) {
    for (const prayer of trackablePrayerNames) {
      store = setPrayerCompletion(store, date, prayer, true);
    }
  }

  const metrics = calculatePrayerMetrics(store, d3);
  assert.equal(metrics.currentStreak, 3);
  assert.equal(metrics.bestStreak, 3);
});

test('calculatePrayerMetrics breaks current streak if today is incomplete but historical streak is preserved', () => {
  let store = {};
  const d1 = '2026-03-20';
  const d2 = '2026-03-21';

  // Complete all prayers for d1
  for (const prayer of trackablePrayerNames) {
    store = setPrayerCompletion(store, d1, prayer, true);
  }

  // Only partial for d2
  store = setPrayerCompletion(store, d2, 'Fajr', true);

  const metrics = calculatePrayerMetrics(store, d2);
  assert.equal(metrics.currentStreak, 0);
  assert.equal(metrics.bestStreak, 1);
});

test('calculatePrayerMetrics handles gaps in history for best streak calculation', () => {
  let store = {};
  const dates = ['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05', '2026-03-06'];

  for (const date of dates) {
    for (const prayer of trackablePrayerNames) {
      store = setPrayerCompletion(store, date, prayer, true);
    }
  }

  const metrics = calculatePrayerMetrics(store, '2026-03-06');
  assert.equal(metrics.bestStreak, 3); // 04, 05, 06 are contiguous
  assert.equal(metrics.currentStreak, 3);
});
