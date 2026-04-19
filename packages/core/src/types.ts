export type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type TrackablePrayerName = PrayerName;
export type NotifiablePrayerName = TrackablePrayerName;
export type AppPlatform = 'android' | 'ios' | 'web';
export type AppThemePreference = 'light' | 'dark' | 'system';
export type AppThemeAccent = 'default' | 'gold' | 'emerald' | 'rose' | 'sky' | 'violet';
export type CalculationMethodId =
  | 'muslim-world-league'
  | 'egyptian'
  | 'karachi'
  | 'umm-al-qura'
  | 'north-america'
  | 'singapore'
  | 'qatar'
  | 'turkey';
export type MadhabId = 'shafi' | 'hanafi';
export type PrayerCalculationMode = 'manual' | 'auto';
export type PrayerTimeFormat = '12h' | '24h';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type TimeZoneSource = 'geo' | 'manual' | 'device-fallback';

export interface SavedLocation {
  coordinates: Coordinates;
  label: string;
  source: 'device' | 'manual';
  timeZone: string | null;
  timeZoneSource: TimeZoneSource;
  updatedAt: string;
}

export interface PrayerAdjustmentMap {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface PrayerPreferences {
  adjustments: PrayerAdjustmentMap;
  autoRefreshLocation: boolean;
  calculationMethod: CalculationMethodId;
  calculationMode: PrayerCalculationMode;
  madhab: MadhabId;
  timeFormat: PrayerTimeFormat;
}

export type PrayerPreReminderMinutes = 10 | 15 | 20 | 30 | null;
export type NotificationPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';
export type NotificationScheduleJobKind = 'prayer-start' | 'pre-reminder';

export interface PrayerNotificationPreferences {
  enabledPrayers: Record<NotifiablePrayerName, boolean>;
  preReminderMinutes: PrayerPreReminderMinutes;
}

export interface NotificationScheduleJob {
  body: string;
  channelId: NotificationScheduleJobKind;
  city: string;
  dateKey: string;
  fireAt: string;
  id: string;
  kind: NotificationScheduleJobKind;
  prayerName: NotifiablePrayerName;
  soundKey: 'athan' | 'reminder';
  title: string;
}

export interface WebPushSubscriptionInput {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface NotificationSyncRequest {
  installationId: string;
  notificationPreferences: PrayerNotificationPreferences;
  platform: 'web';
  prayerPreferences: PrayerPreferences;
  pushSubscription: WebPushSubscriptionInput;
  savedLocation: SavedLocation;
}

export interface NotificationRefreshRequest {
  installationId: string;
  notificationPreferences: PrayerNotificationPreferences;
  platform: 'web';
  prayerPreferences: PrayerPreferences;
  savedLocation: SavedLocation;
}

export interface NotificationDisableRequest {
  installationId: string;
  platform: 'web';
}

export interface NotificationSyncResponse {
  installationId: string;
  scheduledJobCount: number;
  success: true;
  webPushEnabled: boolean;
}

export interface AppOverview {
  name: string;
  tagline: string;
  city: string;
  hijriDate: string;
  gregorianDate: string;
  nextPrayer: PrayerName;
  nextPrayerTime: string;
  focus: string;
}

export interface PrayerTime {
  isoTime: string;
  isCurrent?: boolean;
  name: PrayerName;
  time: string;
  window: string;
  isNext?: boolean;
}

export interface PrayerDay {
  city: string;
  coordinates: Coordinates;
  currentPrayer: PrayerName | null;
  generatedAt: string;
  gregorianDate: string;
  hijriDate: string | null;
  madhabLabel: string;
  methodLabel: string;
  nextPrayer: PrayerName | null;
  nextPrayerIsoTime: string | null;
  nextPrayerTime: string | null;
  prayers: PrayerTime[];
  timeZone: string | null;
}

export interface PrayerLogDay {
  dateKey: string;
  prayers: Record<TrackablePrayerName, boolean>;
}

export type PrayerLogStore = Record<string, PrayerLogDay>;

export interface TimestampedValue<T> {
  updatedAt: string;
  value: T;
}

export interface PrayerHistoryDay {
  completedCount: number;
  dateKey: string;
  isComplete: boolean;
  label: string;
  totalCount: number;
}

export interface PrayerProgressSummary {
  bestStreak: number;
  completedPrayersLast30Days: number;
  completedToday: number;
  currentStreak: number;
  last7DayCompletionRate: number;
  recentDays: PrayerHistoryDay[];
  totalTrackablePrayers: number;
}

export interface CoreModule {
  title: string;
  summary: string;
  status: 'live shell' | 'next build' | 'planned';
}

export interface SurahPreview {
  id: number;
  arabicName: string;
  transliteration: string;
  translation: string;
  ayahs: number;
}

export interface DuaCollection {
  title: string;
  count: number;
  summary: string;
}

export interface WorshipMetric {
  label: string;
  value: string;
  trend: string;
}

export interface IntegrationItem {
  title: string;
  status: 'ready' | 'requires oauth' | 'planned';
  detail: string;
}

export interface PersonalSettingPreview {
  title: string;
  value: string;
  note: string;
}

export interface RoadmapMilestone {
  phase: string;
  objective: string;
}

export interface ApiHealthResponse {
  service: string;
  status: 'ok';
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface RuntimeResponse {
  authFlowImplemented: boolean;
  calendarSyncImplemented: boolean;
  driveBackupImplemented: boolean;
  googleServerCredentialsConfigured: boolean;
  stage: 'development' | 'staging' | 'production';
}

export type MosqueSource = 'google' | 'openstreetmap';

export interface MosqueSearchResult {
  address: string;
  distanceKm: number;
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  source: MosqueSource;
}

export interface MosqueSearchResponse {
  providerErrors: Partial<Record<MosqueSource, string>>;
  providerStatus: Record<MosqueSource, 'disabled' | 'error' | 'ok'>;
  results: MosqueSearchResult[];
}

export interface PrayerAppBackupPayload {
  exportedAt: string;
  notificationPreferences: TimestampedValue<PrayerNotificationPreferences>;
  prayerLogs: TimestampedValue<PrayerLogStore>;
  prayerPreferences: TimestampedValue<PrayerPreferences>;
  savedLocation: TimestampedValue<SavedLocation | null>;
  themeAccent: TimestampedValue<AppThemeAccent>;
  themePreference: TimestampedValue<AppThemePreference>;
  version: number;
}

export interface GoogleDriveAccount {
  email: string;
  name: string | null;
  pictureUrl: string | null;
  subject: string;
}

export interface GoogleDriveAuthStartRequest {
  installationId: string;
  platform: AppPlatform;
  redirectUri: string;
}

export interface GoogleDriveAuthStartResponse {
  authUrl: string;
  state: string;
}

export interface GoogleDriveAuthCompleteRequest {
  installationId: string;
  state: string;
}

export interface GoogleDriveAuthCompleteResponse {
  account: GoogleDriveAccount;
  sessionToken: string;
}

export interface GoogleDriveSessionResponse {
  account: GoogleDriveAccount;
  connected: boolean;
}

export interface GoogleDriveBackupFetchResponse {
  backup: PrayerAppBackupPayload | null;
  fileId: string | null;
  modifiedAt: string | null;
}

export interface GoogleDriveBackupUpsertRequest {
  backup: PrayerAppBackupPayload;
}

export interface GoogleDriveBackupUpsertResponse {
  backup: PrayerAppBackupPayload;
  fileId: string;
  modifiedAt: string;
}

export interface GoogleDriveExportDocumentRequest {
  folderName: string;
  fileName: string;
  content: string;
  mimeType: string;
}

export interface GoogleDriveExportDocumentResponse {
  fileId: string;
  webViewLink?: string;
}

export interface OverviewResponse {
  overview: AppOverview;
  modules: CoreModule[];
  roadmap: RoadmapMilestone[];
}

export type PrayerTimesResponse = PrayerDay;

export interface FeaturedQuranResponse {
  recitationMode: string;
  surahs: SurahPreview[];
}

export interface DuaCollectionsResponse {
  collections: DuaCollection[];
}

export interface DashboardResponse {
  overview: AppOverview;
  prayers: PrayerTime[];
  metrics: WorshipMetric[];
  integrations: IntegrationItem[];
}

export interface GoogleCalendarEvent {
  description?: string;
  end: string;
  start: string;
  summary: string;
}

export interface GoogleCalendarSyncRequest {
  calendarId?: string;
  events: GoogleCalendarEvent[];
}

export interface GoogleCalendarSyncResponse {
  createdCount: number;
  success: true;
}

// Content Types
export interface ContentSourceSummary {
  collection: string;
  license: string;
  name: string;
  version: string;
}

export interface QuranSourceSummary extends ContentSourceSummary {
  translation: string;
}

export interface QuranSeedVerse {
  id: number;
  text: string;
  translation: string;
  transliteration: string;
  explanation?: string | null;
}

export interface QuranSeedChapter {
  arabicName: string;
  id: number;
  totalVerses: number;
  translation: string;
  transliteration: string;
  type: string;
  verses: QuranSeedVerse[];
}

export interface QuranSeedBundle {
  chapters: QuranSeedChapter[];
  source: QuranSourceSummary;
}

export interface DuaSeedCategory {
  itemCount: number;
  order: number;
  slug: string;
  title: string;
}

export interface DuaSeedItem {
  categorySlug: string;
  id: string;
  originalSection: string;
  textArabic: string;
  translation: string;
  transliteration: string;
}

export interface DuaSourceSummary extends ContentSourceSummary {
  itemCount: number;
}

export interface DuaSeedBundle {
  categories: DuaSeedCategory[];
  items: DuaSeedItem[];
  source: DuaSourceSummary;
}

export interface QuranChapterSummary {
  arabicName: string;
  chapterId: number;
  totalVerses: number;
  translation: string;
  transliteration: string;
  type: string;
}

export interface QuranSavedVerse {
  arabicText: string;
  chapterArabicName: string;
  chapterId: number;
  chapterTranslation: string;
  chapterTransliteration: string;
  translation: string;
  transliteration: string;
  explanation?: string | null;
  updatedAt: string;
  verseId: number;
}

export interface QuranBookmark extends QuranSavedVerse {
  createdAt: string;
}

export interface QuranVerse {
  arabicText: string;
  chapterId: number;
  isBookmarked: boolean;
  isLastRead: boolean;
  translation: string;
  transliteration: string;
  explanation?: string | null;
  verseId: number;
}

export interface QuranChapterDetail extends QuranChapterSummary {
  verses: QuranVerse[];
}

export interface QuranSearchResult {
  arabicText: string | null;
  chapterArabicName: string;
  chapterId: number;
  chapterTranslation: string;
  chapterTransliteration: string;
  matchType: 'chapter' | 'verse';
  translationSnippet: string | null;
  verseId: number | null;
}

export interface QuranHomeSnapshot {
  bookmarks: QuranBookmark[];
  chapters: QuranChapterSummary[];
  lastRead: QuranSavedVerse | null;
}

export interface DuaCategorySummary {
  itemCount: number;
  slug: string;
  title: string;
}

export interface DuaItem {
  arabicText: string;
  categorySlug: string;
  categoryTitle: string;
  id: string;
  isFavorite: boolean;
  personalCount: number;
  translation: string;
  transliteration: string;
}

export interface DuaCategoryDetail extends DuaCategorySummary {
  items: DuaItem[];
}

export interface DuaHomeSnapshot {
  categories: DuaCategorySummary[];
  favoriteDuas: DuaItem[];
}

export interface HadithSourceSummary extends ContentSourceSummary {
  books: string[];
  generatedAt: string;
}

export interface HadithBook {
  authorArabic: string;
  authorEnglish: string;
  hadithCount: number;
  id: number;
  isShipNow: boolean;
  slug: string;
  titleArabic: string;
  titleEnglish: string;
}

export interface HadithChapter {
  bookId: number;
  bookSlug: string;
  id: number;
  titleArabic: string;
  titleEnglish: string;
}

export interface HadithItem {
  benefits: string[];
  benefitsArabic: string[];
  bookHadithNumber: number;
  bookId: number;
  bookSlug: string;
  chapterId: number;
  chapterTitleArabic: string;
  chapterTitleEnglish: string;
  explanation: string;
  explanationArabic: string;
  globalHadithId: number;
  grade: string;
  gradeArabic: string;
  hadeethEncId: string | null;
  id: string;
  isBookmarked: boolean;
  isGradeVerified: boolean;
  narratorEnglish: string;
  sourceLink: string;
  takhrij: string;
  takhrijArabic: string;
  textArabic: string;
  textEnglish: string;
  wordMeaningsArabic: string[];
}

export interface HadithHomeSnapshot {
  books: HadithBook[];
  bookmarkedItems: HadithItem[];
}

export interface PrayerTopic {
  description: string;
  itemCount: number;
  slug: string;
  title: string;
}

export interface PrayerTopicItem {
  bookSlug: string;
  chapterId: number;
  grade: string;
  hadithId: string;
  isGradeVerified: boolean;
  topicSlug: string;
}

export interface HadithSeedBundle {
  books: HadithBook[];
  chapters: HadithChapter[];
  entries: Omit<HadithItem, 'isBookmarked'>[];
  source: HadithSourceSummary;
}

export interface PrayerTopicsSourceSummary extends ContentSourceSummary {
  generatedAt: string;
}

export interface PrayerTopicsSeedBundle {
  items: PrayerTopicItem[];
  source: PrayerTopicsSourceSummary;
  topics: PrayerTopic[];
}
