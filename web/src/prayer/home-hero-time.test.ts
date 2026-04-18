import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHomeHeroClockParts,
  getPrayerIsoMinutesInTimeZone,
  getTimeOfDayPhase,
  getTimeZoneMinutes,
} from './home-hero-time';

test('home hero clock parts follow the saved prayer timezone', () => {
  const date = new Date('2026-03-25T00:30:45.000Z');
  const clock = getHomeHeroClockParts(date, 'Asia/Kuala_Lumpur', '12h');

  assert.equal(clock.hour, '8');
  assert.equal(clock.minuteLabel, '30');
  assert.equal(clock.secondLabel, '45');
  assert.equal(clock.meridiem, 'AM');
  assert.equal(clock.hour24, 8);
});

test('timezone minute helpers read prayer times in the saved timezone', () => {
  const date = new Date('2026-03-25T00:30:00.000Z');

  assert.equal(getTimeZoneMinutes(date, 'Asia/Kuala_Lumpur'), 510);
  assert.equal(getPrayerIsoMinutesInTimeZone('2026-03-25T00:30:00.000Z', 'Asia/Kuala_Lumpur'), 510);
});

test('time of day phase uses the saved prayer timezone rather than the browser timezone', () => {
  assert.equal(getTimeOfDayPhase(new Date('2026-03-25T00:30:00.000Z'), 'Asia/Kuala_Lumpur'), 'day');
  assert.equal(getTimeOfDayPhase(new Date('2026-03-25T00:30:00.000Z'), 'America/New_York'), 'night');
});
