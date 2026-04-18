import type { PrayerTimeFormat } from '@prayer-app/core';

export interface HomeHeroClockParts {
  hour: string;
  hour24: number;
  meridiem: string | null;
  minute: number;
  minuteLabel: string;
  second: number;
  secondLabel: string;
}

function createTimeZoneFormatter(
  timeZone: string | null,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: timeZone ?? undefined,
  });
}

function createPartLookup(date: Date, timeZone: string | null, options: Intl.DateTimeFormatOptions) {
  return Object.fromEntries(
    createTimeZoneFormatter(timeZone, options)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
}

function parseNumberPart(value: string | undefined) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getHomeHeroClockParts(
  date: Date,
  timeZone: string | null,
  timeFormat: PrayerTimeFormat,
): HomeHeroClockParts {
  const numericLookup = createPartLookup(date, timeZone, {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    second: '2-digit',
  });
  const displayLookup = createPartLookup(date, timeZone, {
    hour: timeFormat === '24h' ? '2-digit' : 'numeric',
    hour12: timeFormat === '12h',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    hour: displayLookup.hour ?? '00',
    hour24: parseNumberPart(numericLookup.hour),
    meridiem: displayLookup.dayPeriod?.toUpperCase() ?? null,
    minute: parseNumberPart(numericLookup.minute),
    minuteLabel: displayLookup.minute ?? '00',
    second: parseNumberPart(numericLookup.second),
    secondLabel: displayLookup.second ?? '00',
  };
}

export function getTimeZoneMinutes(date: Date, timeZone: string | null) {
  const clock = getHomeHeroClockParts(date, timeZone, '24h');
  return clock.hour24 * 60 + clock.minute;
}

export function getPrayerIsoMinutesInTimeZone(isoTime: string, timeZone: string | null) {
  return getTimeZoneMinutes(new Date(isoTime), timeZone);
}

export function getTimeOfDayPhase(date: Date, timeZone: string | null) {
  const clock = getHomeHeroClockParts(date, timeZone, '24h');
  return clock.hour24 >= 6 && clock.hour24 < 18 ? 'day' : 'night';
}
