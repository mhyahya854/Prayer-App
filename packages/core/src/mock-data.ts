import type {
  AppOverview,
  CoreModule,
  DuaCollection,
  IntegrationItem,
  PersonalSettingPreview,
  PrayerTime,
  RoadmapMilestone,
  SurahPreview,
  WorshipMetric,
} from './types';

export const appOverview: AppOverview = {
  name: 'Prayer App',
  tagline: 'Prayer, Quran, duas, and sync in one calm place.',
  city: 'Kuala Lumpur',
  hijriDate: '13 Ramadan 1447 AH',
  gregorianDate: '23 March 2026',
  nextPrayer: 'Asr',
  nextPrayerTime: '4:48 PM',
  focus: 'Tier 1 foundation with offline-first worship tools and Google-ready sync architecture.',
};

export const todayPrayerSchedule: PrayerTime[] = [
  { isoTime: '2026-03-23T22:04:00.000Z', name: 'Fajr', time: '6:04 AM', window: 'Ends 7:21 AM' },
  { isoTime: '2026-03-23T23:21:00.000Z', name: 'Sunrise', time: '7:21 AM', window: 'Morning dhikr after sunrise' },
  { isoTime: '2026-03-24T05:21:00.000Z', name: 'Dhuhr', time: '1:21 PM', window: 'Ends 4:47 PM' },
  { isoTime: '2026-03-24T08:48:00.000Z', name: 'Asr', time: '4:48 PM', window: 'Next prayer', isNext: true },
  { isoTime: '2026-03-24T11:27:00.000Z', name: 'Maghrib', time: '7:27 PM', window: 'Iftar reminder available' },
  { isoTime: '2026-03-24T12:39:00.000Z', name: 'Isha', time: '8:39 PM', window: 'Night recitation and witr' },
];

export const coreModules: CoreModule[] = [
  {
    title: 'Prayer Times',
    summary: 'Accurate local schedule, manual adjustments, and future athan delivery.',
    status: 'live shell',
  },
  {
    title: 'Quran Reader',
    summary: 'Arabic text, translations, tafsir hooks, bookmarks, and audio entry points.',
    status: 'live shell',
  },
  {
    title: 'Duas & Dhikr',
    summary: 'Category system for morning, evening, travel, sleep, and daily routines.',
    status: 'live shell',
  },
  {
    title: 'Google Sync',
    summary: 'Separate connect flows for Calendar and Drive with least-privilege scopes.',
    status: 'next build',
  },
  {
    title: 'Prayer Tracking',
    summary: 'Daily check-ins, streaks, and worship insights for serious users.',
    status: 'planned',
  },
];

export const featuredSurahs: SurahPreview[] = [
  { id: 1, arabicName: 'الفاتحة', transliteration: 'Al-Fatihah', translation: 'The Opening', ayahs: 7 },
  { id: 18, arabicName: 'الكهف', transliteration: 'Al-Kahf', translation: 'The Cave', ayahs: 110 },
  { id: 36, arabicName: 'يس', transliteration: 'Ya-Sin', translation: 'Ya-Sin', ayahs: 83 },
  { id: 67, arabicName: 'الملك', transliteration: 'Al-Mulk', translation: 'The Sovereignty', ayahs: 30 },
];

export const duaCollections: DuaCollection[] = [
  { title: 'Morning Adhkar', count: 18, summary: 'Start the day with protection, gratitude, and intention.' },
  { title: 'Evening Adhkar', count: 17, summary: 'Calm end-of-day remembrance with transliteration and audio hooks.' },
  { title: 'Travel Duas', count: 6, summary: 'Supplications for departure, arrival, and safety on the road.' },
  { title: 'Sleep Routine', count: 8, summary: 'Night duas, ayat recitation, and bedtime remembrance.' },
];

export const worshipMetrics: WorshipMetric[] = [
  { label: 'Prayer streak', value: '12 days', trend: '+3 this week' },
  { label: 'Quran reading', value: '26 pages', trend: 'Last read synced' },
  { label: 'Dhikr target', value: '420 / 500', trend: '84% complete' },
];

export const integrationsChecklist: IntegrationItem[] = [
  {
    title: 'Google Sign-In',
    status: 'ready',
    detail: 'Foundation is prepared for OAuth-backed identity on mobile, web, and API.',
  },
  {
    title: 'Prayer Calendar',
    status: 'requires oauth',
    detail: 'Will create a dedicated prayer calendar instead of touching the main calendar by default.',
  },
  {
    title: 'Drive Backup',
    status: 'requires oauth',
    detail: 'Designed for notes, bookmarks, and settings export with narrow Drive permissions.',
  },
  {
    title: 'Family Sync',
    status: 'planned',
    detail: 'Future shared household reminders and Ramadan accountability tools.',
  },
];

export const personalSettingsPreview: PersonalSettingPreview[] = [
  { title: 'Calculation Method', value: 'MWL', note: 'Changeable per region with manual offsets.' },
  { title: 'Madhab', value: 'Shafi', note: 'Hanafi mode will adjust Asr automatically.' },
  { title: 'Theme', value: 'Dawn Sand', note: 'Dark and mosque-inspired themes are planned next.' },
  { title: 'Offline Mode', value: 'Enabled', note: 'Prayer schedule and core reading stay available without data.' },
];

export const roadmapMilestones: RoadmapMilestone[] = [
  { phase: 'Phase 1', objective: 'Prayer times, Quran, duas, offline cache, and product shell polish.' },
  { phase: 'Phase 2', objective: 'Google auth, Calendar sync, Drive backup, and prayer tracking.' },
  { phase: 'Phase 3', objective: 'Athan audio, widgets, Ramadan utilities, and mosque discovery.' },
];
