import {
  CalculationMethod,
  Coordinates as AdhanCoordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from 'adhan';

import type {
  CalculationMethodId,
  PrayerCalculationMode,
  MadhabId,
  PrayerAdjustmentMap,
  PrayerDay,
  PrayerName,
  PrayerPreferences,
  PrayerTimeFormat,
  SavedLocation,
  TimeZoneSource,
} from './types';

export const calculationMethodOptions: Array<{
  description: string;
  id: CalculationMethodId;
  label: string;
}> = [
  {
    id: 'muslim-world-league',
    label: 'Muslim World League',
    description: 'Balanced global default with 18 degree Fajr and 17 degree Isha.',
  },
  {
    id: 'umm-al-qura',
    label: 'Umm al-Qura',
    description: 'Makkah standard with fixed-interval Isha.',
  },
  {
    id: 'north-america',
    label: 'ISNA / North America',
    description: 'Later Fajr and earlier Isha commonly used in North America.',
  },
  {
    id: 'singapore',
    label: 'Singapore / Malaysia',
    description: 'Widely used in Malaysia, Singapore, and Indonesia.',
  },
  {
    id: 'egyptian',
    label: 'Egyptian',
    description: 'Early Fajr and slightly earlier Isha.',
  },
  {
    id: 'karachi',
    label: 'Karachi',
    description: '18 degree method commonly used in South Asia.',
  },
  {
    id: 'qatar',
    label: 'Qatar',
    description: 'Standard Fajr with fixed-interval Isha.',
  },
  {
    id: 'turkey',
    label: 'Turkey',
    description: 'Approximation of the Diyanet method.',
  },
];

export const madhabOptions: Array<{
  description: string;
  id: MadhabId;
  label: string;
}> = [
  {
    id: 'shafi',
    label: 'Shafi',
    description: 'Earlier Asr time used by Shafi, Maliki, and Hanbali juristic opinion.',
  },
  {
    id: 'hanafi',
    label: 'Hanafi',
    description: 'Later Asr time used by Hanafi juristic opinion.',
  },
];

export const prayerAdjustmentOptions: Array<{
  key: keyof PrayerAdjustmentMap;
  label: PrayerName;
}> = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'sunrise', label: 'Sunrise' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
];

const prayerNameMap = {
  asr: 'Asr',
  dhuhr: 'Dhuhr',
  fajr: 'Fajr',
  isha: 'Isha',
  maghrib: 'Maghrib',
  none: null,
  sunrise: 'Sunrise',
} as const;

const calculationParameterFactories = {
  egyptian: CalculationMethod.Egyptian,
  karachi: CalculationMethod.Karachi,
  'muslim-world-league': CalculationMethod.MuslimWorldLeague,
  'north-america': CalculationMethod.NorthAmerica,
  qatar: CalculationMethod.Qatar,
  singapore: CalculationMethod.Singapore,
  turkey: CalculationMethod.Turkey,
  'umm-al-qura': CalculationMethod.UmmAlQura,
} satisfies Record<CalculationMethodId, () => ReturnType<typeof CalculationMethod.MuslimWorldLeague>>;

function getCalculationMethodLabel(id: CalculationMethodId) {
  return calculationMethodOptions.find((option) => option.id === id)?.label ?? 'Custom';
}

function getMadhabLabel(id: MadhabId) {
  return madhabOptions.find((option) => option.id === id)?.label ?? 'Shafi';
}

const singaporeTimeZones = new Set([
  'Asia/Bangkok',
  'Asia/Brunei',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Makassar',
  'Asia/Manila',
  'Asia/Phnom_Penh',
  'Asia/Pontianak',
  'Asia/Singapore',
  'Asia/Ho_Chi_Minh',
]);

const karachiTimeZones = new Set([
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Kolkata',
]);

function formatWithTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string | null
) {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: timeZone ?? undefined,
  }).format(date);
}

function formatGregorianDate(date: Date, timeZone?: string | null) {
  return formatWithTimeZone(
    date,
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
    timeZone,
  );
}

function formatHijriDate(date: Date, timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timeZone ?? undefined,
    }).format(date);
  } catch {
    return null;
  }
}

export function resolveCalculationMethodForTimeZone(
  timeZone?: string | null,
  fallback: CalculationMethodId = 'muslim-world-league',
) {
  if (!timeZone) {
    return fallback;
  }

  if (timeZone.startsWith('America/')) {
    return 'north-america';
  }

  if (singaporeTimeZones.has(timeZone)) {
    return 'singapore';
  }

  if (karachiTimeZones.has(timeZone)) {
    return 'karachi';
  }

  if (timeZone === 'Asia/Riyadh') {
    return 'umm-al-qura';
  }

  if (timeZone === 'Asia/Qatar') {
    return 'qatar';
  }

  if (timeZone === 'Europe/Istanbul') {
    return 'turkey';
  }

  if (timeZone === 'Africa/Cairo') {
    return 'egyptian';
  }

  return fallback;
}

export function resolvePrayerCalculationMethod(
  calculationMode: PrayerCalculationMode,
  manualMethod: CalculationMethodId,
  timeZone?: string | null,
) {
  if (calculationMode !== 'auto') {
    return manualMethod;
  }

  return resolveCalculationMethodForTimeZone(timeZone);
}

export function formatPrayerTime(
  date: Date,
  timeZone?: string | null,
  timeFormat: PrayerTimeFormat = '12h',
) {
  return formatWithTimeZone(
    date,
    {
      hour: timeFormat === '24h' ? '2-digit' : 'numeric',
      hour12: timeFormat === '12h',
      minute: '2-digit',
    },
    timeZone,
  );
}

export function formatDateKey(date: Date, timeZone?: string | null) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timeZone ?? undefined,
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function parseDateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));

  return {
    day,
    month,
    year,
  };
}

export function createCalendarDateFromDateKey(dateKey: string) {
  const { year, month, day } = parseDateKeyParts(dateKey);
  return new Date(year, month - 1, day);
}

export function createUtcAnchorFromDateKey(dateKey: string) {
  const { year, month, day } = parseDateKeyParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function shiftDateKey(dateKey: string, amount: number) {
  const { year, month, day } = parseDateKeyParts(dateKey);
  const nextDate = new Date(Date.UTC(year, month - 1, day + amount, 12));

  return formatDateKey(nextDate, 'UTC');
}

export function getDefaultPrayerPreferences(): PrayerPreferences {
  return {
    adjustments: {
      fajr: 0,
      sunrise: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0,
    },
    autoRefreshLocation: false,
    calculationMethod: 'muslim-world-league',
    calculationMode: 'manual',
    madhab: 'shafi',
    timeFormat: '12h',
  };
}

export function createSavedLocation(
  coordinates: SavedLocation['coordinates'],
  label: string,
  timeZone: string | null,
  source: SavedLocation['source'] = 'device',
  timeZoneSource: TimeZoneSource = source === 'manual' ? 'manual' : 'device-fallback',
): SavedLocation {
  return {
    coordinates,
    label,
    source,
    timeZone,
    timeZoneSource,
    updatedAt: new Date().toISOString(),
  };
}

export function computePrayerDay({
  coordinates,
  date = new Date(),
  dateKey,
  locationLabel,
  now = new Date(),
  preferences,
  timeZone,
}: {
  coordinates: SavedLocation['coordinates'];
  date?: Date;
  dateKey?: string;
  locationLabel: string;
  now?: Date;
  preferences: PrayerPreferences;
  timeZone?: string | null;
}): PrayerDay {
  const effectiveDateKey = dateKey ?? formatDateKey(date, timeZone);
  const normalizedDate = createCalendarDateFromDateKey(effectiveDateKey);
  const nextDate = createCalendarDateFromDateKey(shiftDateKey(effectiveDateKey, 1));
  const adhanCoordinates = new AdhanCoordinates(coordinates.latitude, coordinates.longitude);
  const effectiveCalculationMethod = resolvePrayerCalculationMethod(
    preferences.calculationMode,
    preferences.calculationMethod,
    timeZone,
  );
  const parameters = calculationParameterFactories[effectiveCalculationMethod]();

  parameters.madhab = preferences.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  parameters.highLatitudeRule = HighLatitudeRule.recommended(adhanCoordinates);
  parameters.adjustments.fajr = preferences.adjustments.fajr;
  parameters.adjustments.sunrise = preferences.adjustments.sunrise;
  parameters.adjustments.dhuhr = preferences.adjustments.dhuhr;
  parameters.adjustments.asr = preferences.adjustments.asr;
  parameters.adjustments.maghrib = preferences.adjustments.maghrib;
  parameters.adjustments.isha = preferences.adjustments.isha;

  const prayerTimes = new PrayerTimes(adhanCoordinates, normalizedDate, parameters);
  const nextPrayerTimes = new PrayerTimes(adhanCoordinates, nextDate, parameters);
  const currentPrayerKey = prayerTimes.currentPrayer(now);
  const nextPrayerKey = prayerTimes.nextPrayer(now);
  const currentPrayer = prayerNameMap[currentPrayerKey];
  const isAfterIsha = now >= prayerTimes.isha;
  const nextPrayer = nextPrayerKey === 'none' && isAfterIsha ? 'Fajr' : prayerNameMap[nextPrayerKey];
  const nextPrayerDate =
    (nextPrayerKey === 'fajr' || (nextPrayerKey === 'none' && isAfterIsha)) && isAfterIsha
      ? nextPrayerTimes.fajr
      : nextPrayer
        ? prayerTimes.timeForPrayer(nextPrayer.toLowerCase() as never)
        : null;
  const dateAnchor = prayerTimes.dhuhr;

  const prayerWindows = {
    Asr: prayerTimes.maghrib,
    Dhuhr: prayerTimes.asr,
    Fajr: prayerTimes.sunrise,
    Isha: nextPrayerTimes.fajr,
    Maghrib: prayerTimes.isha,
    Sunrise: prayerTimes.dhuhr,
  } as const;

  const prayers = [
    { name: 'Fajr' as const, value: prayerTimes.fajr },
    { name: 'Sunrise' as const, value: prayerTimes.sunrise },
    { name: 'Dhuhr' as const, value: prayerTimes.dhuhr },
    { name: 'Asr' as const, value: prayerTimes.asr },
    { name: 'Maghrib' as const, value: prayerTimes.maghrib },
    { name: 'Isha' as const, value: prayerTimes.isha },
  ].map((entry) => ({
    isoTime: entry.value.toISOString(),
    isCurrent: currentPrayer === entry.name,
    isNext: nextPrayer === entry.name,
    name: entry.name,
    time: formatPrayerTime(entry.value, timeZone, preferences.timeFormat),
    window:
      entry.name === 'Sunrise'
        ? `Daylight until ${formatPrayerTime(prayerWindows.Sunrise, timeZone, preferences.timeFormat)}`
        : `Ends ${formatPrayerTime(prayerWindows[entry.name], timeZone, preferences.timeFormat)}`,
  }));

  return {
    city: locationLabel,
    coordinates,
    currentPrayer,
    generatedAt: now.toISOString(),
    gregorianDate: formatGregorianDate(dateAnchor, timeZone),
    hijriDate: formatHijriDate(dateAnchor, timeZone),
    madhabLabel: getMadhabLabel(preferences.madhab),
    methodLabel: getCalculationMethodLabel(effectiveCalculationMethod),
    nextPrayer,
    nextPrayerIsoTime: nextPrayerDate ? nextPrayerDate.toISOString() : null,
    nextPrayerTime: nextPrayerDate
      ? formatPrayerTime(nextPrayerDate, timeZone, preferences.timeFormat)
      : null,
    prayers,
    timeZone: timeZone ?? null,
  };
}
