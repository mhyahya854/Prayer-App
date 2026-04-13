export type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type TrackablePrayerName = Exclude<PrayerName, 'Sunrise'>;
export type NotifiablePrayerName = TrackablePrayerName;
export type AppPlatform = 'android' | 'ios' | 'web';
export type AppThemePreference = 'light' | 'dark' | 'system';
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
  calculationMethod: CalculationMethodId;
  madhab: MadhabId;
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
  isoTime?: string;
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

export interface PrayerAppBackupPayload {
  exportedAt: string;
  notificationPreferences: TimestampedValue<PrayerNotificationPreferences>;
  prayerLogs: TimestampedValue<PrayerLogStore>;
  prayerPreferences: TimestampedValue<PrayerPreferences>;
  savedLocation: TimestampedValue<SavedLocation | null>;
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
