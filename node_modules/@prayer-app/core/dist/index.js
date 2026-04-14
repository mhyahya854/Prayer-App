// src/prayer.ts
import {
  CalculationMethod,
  Coordinates as AdhanCoordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes
} from "adhan";
var calculationMethodOptions = [
  {
    id: "muslim-world-league",
    label: "Muslim World League",
    description: "Balanced global default with 18 degree Fajr and 17 degree Isha."
  },
  {
    id: "umm-al-qura",
    label: "Umm al-Qura",
    description: "Makkah standard with fixed-interval Isha."
  },
  {
    id: "north-america",
    label: "ISNA / North America",
    description: "Later Fajr and earlier Isha commonly used in North America."
  },
  {
    id: "singapore",
    label: "Singapore / Malaysia",
    description: "Widely used in Malaysia, Singapore, and Indonesia."
  },
  {
    id: "egyptian",
    label: "Egyptian",
    description: "Early Fajr and slightly earlier Isha."
  },
  {
    id: "karachi",
    label: "Karachi",
    description: "18 degree method commonly used in South Asia."
  },
  {
    id: "qatar",
    label: "Qatar",
    description: "Standard Fajr with fixed-interval Isha."
  },
  {
    id: "turkey",
    label: "Turkey",
    description: "Approximation of the Diyanet method."
  }
];
var madhabOptions = [
  {
    id: "shafi",
    label: "Shafi",
    description: "Earlier Asr time used by Shafi, Maliki, and Hanbali juristic opinion."
  },
  {
    id: "hanafi",
    label: "Hanafi",
    description: "Later Asr time used by Hanafi juristic opinion."
  }
];
var prayerAdjustmentOptions = [
  { key: "fajr", label: "Fajr" },
  { key: "sunrise", label: "Sunrise" },
  { key: "dhuhr", label: "Dhuhr" },
  { key: "asr", label: "Asr" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isha" }
];
var prayerNameMap = {
  asr: "Asr",
  dhuhr: "Dhuhr",
  fajr: "Fajr",
  isha: "Isha",
  maghrib: "Maghrib",
  none: null,
  sunrise: "Sunrise"
};
var calculationParameterFactories = {
  egyptian: CalculationMethod.Egyptian,
  karachi: CalculationMethod.Karachi,
  "muslim-world-league": CalculationMethod.MuslimWorldLeague,
  "north-america": CalculationMethod.NorthAmerica,
  qatar: CalculationMethod.Qatar,
  singapore: CalculationMethod.Singapore,
  turkey: CalculationMethod.Turkey,
  "umm-al-qura": CalculationMethod.UmmAlQura
};
function getCalculationMethodLabel(id) {
  return calculationMethodOptions.find((option) => option.id === id)?.label ?? "Custom";
}
function getMadhabLabel(id) {
  return madhabOptions.find((option) => option.id === id)?.label ?? "Shafi";
}
function formatWithTimeZone(date, options, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: timeZone ?? void 0
  }).format(date);
}
function formatGregorianDate(date, timeZone) {
  return formatWithTimeZone(
    date,
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    },
    timeZone
  );
}
function formatHijriDate(date, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timeZone ?? void 0
    }).format(date);
  } catch {
    return null;
  }
}
function formatPrayerTime(date, timeZone) {
  return formatWithTimeZone(
    date,
    {
      hour: "numeric",
      minute: "2-digit"
    },
    timeZone
  );
}
function formatDateKey(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timeZone ?? void 0,
    year: "numeric"
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}
function parseDateKeyParts(dateKey) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return {
    day,
    month,
    year
  };
}
function createCalendarDateFromDateKey(dateKey) {
  const { year, month, day } = parseDateKeyParts(dateKey);
  return new Date(year, month - 1, day);
}
function createUtcAnchorFromDateKey(dateKey) {
  const { year, month, day } = parseDateKeyParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
function shiftDateKey(dateKey, amount) {
  const { year, month, day } = parseDateKeyParts(dateKey);
  const nextDate = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return formatDateKey(nextDate, "UTC");
}
function getDefaultPrayerPreferences() {
  return {
    adjustments: {
      fajr: 0,
      sunrise: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0
    },
    calculationMethod: "muslim-world-league",
    madhab: "shafi"
  };
}
function createSavedLocation(coordinates, label, timeZone, source = "device", timeZoneSource = source === "manual" ? "manual" : "device-fallback") {
  return {
    coordinates,
    label,
    source,
    timeZone,
    timeZoneSource,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function computePrayerDay({
  coordinates,
  date = /* @__PURE__ */ new Date(),
  dateKey,
  locationLabel,
  now = /* @__PURE__ */ new Date(),
  preferences,
  timeZone
}) {
  const effectiveDateKey = dateKey ?? formatDateKey(date, timeZone);
  const normalizedDate = createCalendarDateFromDateKey(effectiveDateKey);
  const nextDate = createCalendarDateFromDateKey(shiftDateKey(effectiveDateKey, 1));
  const adhanCoordinates = new AdhanCoordinates(coordinates.latitude, coordinates.longitude);
  const parameters = calculationParameterFactories[preferences.calculationMethod]();
  parameters.madhab = preferences.madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
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
  const nextPrayer = nextPrayerKey === "none" && isAfterIsha ? "Fajr" : prayerNameMap[nextPrayerKey];
  const nextPrayerTime = (nextPrayerKey === "fajr" || nextPrayerKey === "none" && isAfterIsha) && isAfterIsha ? nextPrayerTimes.fajr : nextPrayer ? prayerTimes.timeForPrayer(nextPrayer.toLowerCase()) : null;
  const dateAnchor = prayerTimes.dhuhr;
  const prayerWindows = {
    Asr: prayerTimes.maghrib,
    Dhuhr: prayerTimes.asr,
    Fajr: prayerTimes.sunrise,
    Isha: nextPrayerTimes.fajr,
    Maghrib: prayerTimes.isha,
    Sunrise: prayerTimes.dhuhr
  };
  const prayers = [
    { name: "Fajr", value: prayerTimes.fajr },
    { name: "Sunrise", value: prayerTimes.sunrise },
    { name: "Dhuhr", value: prayerTimes.dhuhr },
    { name: "Asr", value: prayerTimes.asr },
    { name: "Maghrib", value: prayerTimes.maghrib },
    { name: "Isha", value: prayerTimes.isha }
  ].map((entry) => ({
    isoTime: entry.value.toISOString(),
    isCurrent: currentPrayer === entry.name,
    isNext: nextPrayer === entry.name,
    name: entry.name,
    time: formatPrayerTime(entry.value, timeZone),
    window: entry.name === "Sunrise" ? `Daylight until ${formatPrayerTime(prayerWindows.Sunrise, timeZone)}` : `Ends ${formatPrayerTime(prayerWindows[entry.name], timeZone)}`
  }));
  return {
    city: locationLabel,
    coordinates,
    currentPrayer,
    generatedAt: now.toISOString(),
    gregorianDate: formatGregorianDate(dateAnchor, timeZone),
    hijriDate: formatHijriDate(dateAnchor, timeZone),
    madhabLabel: getMadhabLabel(preferences.madhab),
    methodLabel: getCalculationMethodLabel(preferences.calculationMethod),
    nextPrayer,
    nextPrayerTime: nextPrayerTime ? formatPrayerTime(nextPrayerTime, timeZone) : null,
    prayers,
    timeZone: timeZone ?? null
  };
}

// src/notifications.ts
var notificationPreReminderOptions = [
  { label: "Off", value: null },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 }
];
var notifiablePrayerNames = [
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha"
];
function getDefaultPrayerNotificationPreferences() {
  return {
    enabledPrayers: {
      Fajr: true,
      Sunrise: true,
      Dhuhr: true,
      Asr: true,
      Maghrib: true,
      Isha: true
    },
    preReminderMinutes: null
  };
}
function isNotifiablePrayerName(prayerName) {
  return notifiablePrayerNames.includes(prayerName);
}
function createPrayerNotificationScheduleJobs(prayerDay, preferences, now = /* @__PURE__ */ new Date()) {
  const jobs = [];
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
      kind: "prayer-start",
      prayerName: prayer.name,
      prayerTimeLabel: prayer.time
    });
    if (prayerDate.getTime() > now.getTime()) {
      jobs.push(startJob);
    }
    if (!preferences.preReminderMinutes) {
      continue;
    }
    const reminderDate = new Date(prayerDate.getTime() - preferences.preReminderMinutes * 6e4);
    if (reminderDate.getTime() <= now.getTime()) {
      continue;
    }
    jobs.push(
      createScheduleJob({
        city: prayerDay.city,
        dateKey,
        fireAt: reminderDate,
        kind: "pre-reminder",
        preReminderMinutes: preferences.preReminderMinutes,
        prayerName: prayer.name,
        prayerTimeLabel: prayer.time
      })
    );
  }
  return jobs.sort((left, right) => Date.parse(left.fireAt) - Date.parse(right.fireAt));
}
function createRollingPrayerNotificationSchedule({
  notificationPreferences,
  now = /* @__PURE__ */ new Date(),
  prayerPreferences,
  savedLocation,
  startDateKey,
  windowDays = 5
}) {
  const jobs = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    const dateKey = shiftDateKey(startDateKey, offset);
    const prayerDay = computePrayerDay({
      coordinates: savedLocation.coordinates,
      dateKey,
      locationLabel: savedLocation.label,
      now,
      preferences: prayerPreferences,
      timeZone: savedLocation.timeZone
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
  prayerTimeLabel
}) {
  const isPrayerStart = kind === "prayer-start";
  return {
    body: isPrayerStart ? `It's time for ${prayerName} in ${city}.` : `${prayerName} begins in ${preReminderMinutes} minutes at ${prayerTimeLabel}.`,
    channelId: kind,
    city,
    dateKey,
    fireAt: fireAt.toISOString(),
    id: `${dateKey}:${prayerName}:${kind}`,
    kind,
    prayerName,
    soundKey: isPrayerStart ? "athan" : "reminder",
    title: isPrayerStart ? `${prayerName} Time` : `${prayerName} Soon`
  };
}

// src/tracking.ts
var trackablePrayerNames = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
function createPrayerRecord() {
  return {
    Fajr: false,
    Sunrise: false,
    Dhuhr: false,
    Asr: false,
    Maghrib: false,
    Isha: false
  };
}
function countCompleted(log) {
  if (!log) {
    return 0;
  }
  return trackablePrayerNames.reduce(
    (count, prayerName) => count + (log.prayers[prayerName] ? 1 : 0),
    0
  );
}
function isCompleteDay(log) {
  return countCompleted(log) === trackablePrayerNames.length;
}
function formatHistoryLabel(dateKey) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short"
  }).format(createUtcAnchorFromDateKey(dateKey));
}
function createPrayerLogDay(dateKey) {
  return {
    dateKey,
    prayers: createPrayerRecord()
  };
}
function isTrackablePrayerName(prayerName) {
  return trackablePrayerNames.includes(prayerName);
}
function setPrayerCompletion(store, dateKey, prayerName, completed) {
  const existing = store[dateKey] ?? createPrayerLogDay(dateKey);
  return {
    ...store,
    [dateKey]: {
      ...existing,
      prayers: {
        ...existing.prayers,
        [prayerName]: completed
      }
    }
  };
}
function calculatePrayerMetrics(store, todayKey) {
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
  let previousKey = null;
  for (const dateKey of orderedKeys) {
    const isComplete = isCompleteDay(store[dateKey]);
    if (!isComplete) {
      runningStreak = 0;
      previousKey = dateKey;
      continue;
    }
    const continuesPrevious = previousKey !== null && shiftDateKey(previousKey, 1) === dateKey && isCompleteDay(store[previousKey]);
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
  const recentDays = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const dateKey = shiftDateKey(todayKey, -offset);
    const completedCount = countCompleted(store[dateKey]);
    recentDays.push({
      completedCount,
      dateKey,
      isComplete: completedCount === trackablePrayerNames.length,
      label: formatHistoryLabel(dateKey),
      totalCount: trackablePrayerNames.length
    });
  }
  return {
    bestStreak,
    completedPrayersLast30Days,
    completedToday,
    currentStreak,
    last7DayCompletionRate: Math.round(
      completedInLast7Days / (trackablePrayerNames.length * 7) * 100
    ),
    recentDays,
    totalTrackablePrayers: trackablePrayerNames.length
  };
}

// src/drive-sync.ts
var prayerAppBackupVersion = 1;
var syncEpochTimestamp = "1970-01-01T00:00:00.000Z";
function getDefaultThemePreference() {
  return "system";
}
function createTimestampedValue(value, updatedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    updatedAt,
    value
  };
}
function getLatestUpdatedAt(values) {
  return values.reduce(
    (latest, value) => getTimestamp(value.updatedAt) > getTimestamp(latest) ? value.updatedAt : latest,
    syncEpochTimestamp
  );
}
function createPrayerAppBackupPayload(input) {
  const exportedAt = input.exportedAt ?? getLatestUpdatedAt([
    input.notificationPreferences,
    input.prayerLogs,
    input.prayerPreferences,
    input.savedLocation,
    input.themePreference
  ]);
  return {
    exportedAt,
    notificationPreferences: input.notificationPreferences,
    prayerLogs: input.prayerLogs,
    prayerPreferences: input.prayerPreferences,
    savedLocation: input.savedLocation,
    themePreference: input.themePreference,
    version: prayerAppBackupVersion
  };
}
function getTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
function isPrayerLogDayEmpty(log) {
  if (!log) {
    return true;
  }
  return trackablePrayerNames.every((prayerName) => !log.prayers[prayerName]);
}
function mergePrayerLogStores(local, remote) {
  const merged = {};
  const keys = /* @__PURE__ */ new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const dateKey of keys) {
    const localDay = local[dateKey];
    const remoteDay = remote[dateKey];
    if (!localDay && !remoteDay) {
      continue;
    }
    const nextDay = createPrayerLogDay(dateKey);
    for (const prayerName of trackablePrayerNames) {
      nextDay.prayers[prayerName] = Boolean(
        localDay?.prayers[prayerName] || remoteDay?.prayers[prayerName]
      );
    }
    if (!isPrayerLogDayEmpty(nextDay) || localDay || remoteDay) {
      merged[dateKey] = nextDay;
    }
  }
  return merged;
}
function mergeTimestampedValue(local, remote, options) {
  const localTimestamp = getTimestamp(local.updatedAt);
  const remoteTimestamp = getTimestamp(remote.updatedAt);
  if (localTimestamp > remoteTimestamp) {
    return local;
  }
  if (remoteTimestamp > localTimestamp) {
    return remote;
  }
  if (options?.preferNonNullOnEqual) {
    if (local.value === null && remote.value !== null) {
      return remote;
    }
    if (remote.value === null && local.value !== null) {
      return local;
    }
  }
  return remote;
}
function mergePrayerAppBackupPayload(local, remote) {
  const mergedPrayerLogs = createTimestampedValue(
    mergePrayerLogStores(local.prayerLogs.value, remote.prayerLogs.value),
    local.prayerLogs.updatedAt > remote.prayerLogs.updatedAt ? local.prayerLogs.updatedAt : remote.prayerLogs.updatedAt
  );
  return createPrayerAppBackupPayload({
    notificationPreferences: mergeTimestampedValue(
      local.notificationPreferences,
      remote.notificationPreferences
    ),
    prayerLogs: mergedPrayerLogs,
    prayerPreferences: mergeTimestampedValue(local.prayerPreferences, remote.prayerPreferences),
    savedLocation: mergeTimestampedValue(local.savedLocation, remote.savedLocation, {
      preferNonNullOnEqual: true
    }),
    themePreference: mergeTimestampedValue(local.themePreference, remote.themePreference)
  });
}
function hasMeaningfulPrayerAppBackupData(backup) {
  if (backup.savedLocation.value) {
    return true;
  }
  if (backup.themePreference.value !== getDefaultThemePreference()) {
    return true;
  }
  if (JSON.stringify(backup.prayerPreferences.value) !== JSON.stringify(getDefaultPrayerPreferences())) {
    return true;
  }
  if (JSON.stringify(backup.notificationPreferences.value) !== JSON.stringify(getDefaultPrayerNotificationPreferences())) {
    return true;
  }
  return Object.values(backup.prayerLogs.value).some((log) => !isPrayerLogDayEmpty(log));
}

// src/mock-data.ts
var appOverview = {
  name: "Prayer App",
  tagline: "Prayer, Quran, duas, and sync in one calm place.",
  city: "Kuala Lumpur",
  hijriDate: "13 Ramadan 1447 AH",
  gregorianDate: "23 March 2026",
  nextPrayer: "Asr",
  nextPrayerTime: "4:48 PM",
  focus: "Tier 1 foundation with offline-first worship tools and Google-ready sync architecture."
};
var todayPrayerSchedule = [
  { name: "Fajr", time: "6:04 AM", window: "Ends 7:21 AM" },
  { name: "Sunrise", time: "7:21 AM", window: "Morning dhikr after sunrise" },
  { name: "Dhuhr", time: "1:21 PM", window: "Ends 4:47 PM" },
  { name: "Asr", time: "4:48 PM", window: "Next prayer", isNext: true },
  { name: "Maghrib", time: "7:27 PM", window: "Iftar reminder available" },
  { name: "Isha", time: "8:39 PM", window: "Night recitation and witr" }
];
var coreModules = [
  {
    title: "Prayer Times",
    summary: "Accurate local schedule, manual adjustments, and future athan delivery.",
    status: "live shell"
  },
  {
    title: "Quran Reader",
    summary: "Arabic text, translations, tafsir hooks, bookmarks, and audio entry points.",
    status: "live shell"
  },
  {
    title: "Duas & Dhikr",
    summary: "Category system for morning, evening, travel, sleep, and daily routines.",
    status: "live shell"
  },
  {
    title: "Google Sync",
    summary: "Separate connect flows for Calendar and Drive with least-privilege scopes.",
    status: "next build"
  },
  {
    title: "Prayer Tracking",
    summary: "Daily check-ins, streaks, and worship insights for serious users.",
    status: "planned"
  }
];
var featuredSurahs = [
  { id: 1, arabicName: "\u0627\u0644\u0641\u0627\u062A\u062D\u0629", transliteration: "Al-Fatihah", translation: "The Opening", ayahs: 7 },
  { id: 18, arabicName: "\u0627\u0644\u0643\u0647\u0641", transliteration: "Al-Kahf", translation: "The Cave", ayahs: 110 },
  { id: 36, arabicName: "\u064A\u0633", transliteration: "Ya-Sin", translation: "Ya-Sin", ayahs: 83 },
  { id: 67, arabicName: "\u0627\u0644\u0645\u0644\u0643", transliteration: "Al-Mulk", translation: "The Sovereignty", ayahs: 30 }
];
var duaCollections = [
  { title: "Morning Adhkar", count: 18, summary: "Start the day with protection, gratitude, and intention." },
  { title: "Evening Adhkar", count: 17, summary: "Calm end-of-day remembrance with transliteration and audio hooks." },
  { title: "Travel Duas", count: 6, summary: "Supplications for departure, arrival, and safety on the road." },
  { title: "Sleep Routine", count: 8, summary: "Night duas, ayat recitation, and bedtime remembrance." }
];
var worshipMetrics = [
  { label: "Prayer streak", value: "12 days", trend: "+3 this week" },
  { label: "Quran reading", value: "26 pages", trend: "Last read synced" },
  { label: "Dhikr target", value: "420 / 500", trend: "84% complete" }
];
var integrationsChecklist = [
  {
    title: "Google Sign-In",
    status: "ready",
    detail: "Foundation is prepared for OAuth-backed identity on mobile, web, and API."
  },
  {
    title: "Prayer Calendar",
    status: "requires oauth",
    detail: "Will create a dedicated prayer calendar instead of touching the main calendar by default."
  },
  {
    title: "Drive Backup",
    status: "requires oauth",
    detail: "Designed for notes, bookmarks, and settings export with narrow Drive permissions."
  },
  {
    title: "Family Sync",
    status: "planned",
    detail: "Future shared household reminders and Ramadan accountability tools."
  }
];
var personalSettingsPreview = [
  { title: "Calculation Method", value: "MWL", note: "Changeable per region with manual offsets." },
  { title: "Madhab", value: "Shafi", note: "Hanafi mode will adjust Asr automatically." },
  { title: "Theme", value: "Dawn Sand", note: "Dark and mosque-inspired themes are planned next." },
  { title: "Offline Mode", value: "Enabled", note: "Prayer schedule and core reading stay available without data." }
];
var roadmapMilestones = [
  { phase: "Phase 1", objective: "Prayer times, Quran, duas, offline cache, and product shell polish." },
  { phase: "Phase 2", objective: "Google auth, Calendar sync, Drive backup, and prayer tracking." },
  { phase: "Phase 3", objective: "Athan audio, widgets, Ramadan utilities, and mosque discovery." }
];
export {
  appOverview,
  calculatePrayerMetrics,
  calculationMethodOptions,
  computePrayerDay,
  coreModules,
  createCalendarDateFromDateKey,
  createPrayerAppBackupPayload,
  createPrayerLogDay,
  createPrayerNotificationScheduleJobs,
  createRollingPrayerNotificationSchedule,
  createSavedLocation,
  createTimestampedValue,
  createUtcAnchorFromDateKey,
  duaCollections,
  featuredSurahs,
  formatDateKey,
  getDefaultPrayerNotificationPreferences,
  getDefaultPrayerPreferences,
  getDefaultThemePreference,
  hasMeaningfulPrayerAppBackupData,
  integrationsChecklist,
  isNotifiablePrayerName,
  isTrackablePrayerName,
  madhabOptions,
  mergePrayerAppBackupPayload,
  mergePrayerLogStores,
  mergeTimestampedValue,
  notifiablePrayerNames,
  notificationPreReminderOptions,
  parseDateKeyParts,
  personalSettingsPreview,
  prayerAdjustmentOptions,
  prayerAppBackupVersion,
  roadmapMilestones,
  setPrayerCompletion,
  shiftDateKey,
  syncEpochTimestamp,
  todayPrayerSchedule,
  trackablePrayerNames,
  worshipMetrics
};
