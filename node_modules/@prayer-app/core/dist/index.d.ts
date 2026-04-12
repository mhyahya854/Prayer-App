type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
type TrackablePrayerName = Exclude<PrayerName, 'Sunrise'>;
type NotifiablePrayerName = TrackablePrayerName;
type AppPlatform = 'android' | 'ios' | 'web';
type AppThemePreference = 'light' | 'dark' | 'system';
type CalculationMethodId = 'muslim-world-league' | 'egyptian' | 'karachi' | 'umm-al-qura' | 'north-america' | 'singapore' | 'qatar' | 'turkey';
type MadhabId = 'shafi' | 'hanafi';
interface Coordinates {
    latitude: number;
    longitude: number;
}
type TimeZoneSource = 'geo' | 'manual' | 'device-fallback';
interface SavedLocation {
    coordinates: Coordinates;
    label: string;
    source: 'device' | 'manual';
    timeZone: string | null;
    timeZoneSource: TimeZoneSource;
    updatedAt: string;
}
interface PrayerAdjustmentMap {
    fajr: number;
    sunrise: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
}
interface PrayerPreferences {
    adjustments: PrayerAdjustmentMap;
    calculationMethod: CalculationMethodId;
    madhab: MadhabId;
}
type PrayerPreReminderMinutes = 10 | 15 | 20 | 30 | null;
type NotificationPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';
type NotificationScheduleJobKind = 'prayer-start' | 'pre-reminder';
interface PrayerNotificationPreferences {
    enabledPrayers: Record<NotifiablePrayerName, boolean>;
    preReminderMinutes: PrayerPreReminderMinutes;
}
interface NotificationScheduleJob {
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
interface WebPushSubscriptionInput {
    endpoint: string;
    expirationTime: number | null;
    keys: {
        auth: string;
        p256dh: string;
    };
}
interface NotificationSyncRequest {
    installationId: string;
    notificationPreferences: PrayerNotificationPreferences;
    platform: 'web';
    prayerPreferences: PrayerPreferences;
    pushSubscription: WebPushSubscriptionInput;
    savedLocation: SavedLocation;
}
interface NotificationRefreshRequest {
    installationId: string;
    notificationPreferences: PrayerNotificationPreferences;
    platform: 'web';
    prayerPreferences: PrayerPreferences;
    savedLocation: SavedLocation;
}
interface NotificationDisableRequest {
    installationId: string;
    platform: 'web';
}
interface NotificationSyncResponse {
    installationId: string;
    scheduledJobCount: number;
    success: true;
    webPushEnabled: boolean;
}
interface AppOverview {
    name: string;
    tagline: string;
    city: string;
    hijriDate: string;
    gregorianDate: string;
    nextPrayer: PrayerName;
    nextPrayerTime: string;
    focus: string;
}
interface PrayerTime {
    isoTime?: string;
    isCurrent?: boolean;
    name: PrayerName;
    time: string;
    window: string;
    isNext?: boolean;
}
interface PrayerDay {
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
interface PrayerLogDay {
    dateKey: string;
    prayers: Record<TrackablePrayerName, boolean>;
}
type PrayerLogStore = Record<string, PrayerLogDay>;
interface TimestampedValue<T> {
    updatedAt: string;
    value: T;
}
interface PrayerHistoryDay {
    completedCount: number;
    dateKey: string;
    isComplete: boolean;
    label: string;
    totalCount: number;
}
interface PrayerProgressSummary {
    bestStreak: number;
    completedPrayersLast30Days: number;
    completedToday: number;
    currentStreak: number;
    last7DayCompletionRate: number;
    recentDays: PrayerHistoryDay[];
    totalTrackablePrayers: number;
}
interface CoreModule {
    title: string;
    summary: string;
    status: 'live shell' | 'next build' | 'planned';
}
interface SurahPreview {
    id: number;
    arabicName: string;
    transliteration: string;
    translation: string;
    ayahs: number;
}
interface DuaCollection {
    title: string;
    count: number;
    summary: string;
}
interface WorshipMetric {
    label: string;
    value: string;
    trend: string;
}
interface IntegrationItem {
    title: string;
    status: 'ready' | 'requires oauth' | 'planned';
    detail: string;
}
interface PersonalSettingPreview {
    title: string;
    value: string;
    note: string;
}
interface RoadmapMilestone {
    phase: string;
    objective: string;
}
interface ApiHealthResponse {
    service: string;
    status: 'ok';
}
interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
interface RuntimeResponse {
    authFlowImplemented: boolean;
    calendarSyncImplemented: boolean;
    driveBackupImplemented: boolean;
    googleServerCredentialsConfigured: boolean;
    stage: 'development' | 'staging' | 'production';
}
interface PrayerAppBackupPayload {
    exportedAt: string;
    notificationPreferences: TimestampedValue<PrayerNotificationPreferences>;
    prayerLogs: TimestampedValue<PrayerLogStore>;
    prayerPreferences: TimestampedValue<PrayerPreferences>;
    savedLocation: TimestampedValue<SavedLocation | null>;
    themePreference: TimestampedValue<AppThemePreference>;
    version: number;
}
interface GoogleDriveAccount {
    email: string;
    name: string | null;
    pictureUrl: string | null;
    subject: string;
}
interface GoogleDriveAuthStartRequest {
    installationId: string;
    platform: AppPlatform;
    redirectUri: string;
}
interface GoogleDriveAuthStartResponse {
    authUrl: string;
    state: string;
}
interface GoogleDriveAuthCompleteRequest {
    installationId: string;
    state: string;
}
interface GoogleDriveAuthCompleteResponse {
    account: GoogleDriveAccount;
    sessionToken: string;
}
interface GoogleDriveSessionResponse {
    account: GoogleDriveAccount;
    connected: boolean;
}
interface GoogleDriveBackupFetchResponse {
    backup: PrayerAppBackupPayload | null;
    fileId: string | null;
    modifiedAt: string | null;
}
interface GoogleDriveBackupUpsertRequest {
    backup: PrayerAppBackupPayload;
}
interface GoogleDriveBackupUpsertResponse {
    backup: PrayerAppBackupPayload;
    fileId: string;
    modifiedAt: string;
}
interface OverviewResponse {
    overview: AppOverview;
    modules: CoreModule[];
    roadmap: RoadmapMilestone[];
}
type PrayerTimesResponse = PrayerDay;
interface FeaturedQuranResponse {
    recitationMode: string;
    surahs: SurahPreview[];
}
interface DuaCollectionsResponse {
    collections: DuaCollection[];
}
interface DashboardResponse {
    overview: AppOverview;
    prayers: PrayerTime[];
    metrics: WorshipMetric[];
    integrations: IntegrationItem[];
}

declare const prayerAppBackupVersion = 1;
declare const syncEpochTimestamp = "1970-01-01T00:00:00.000Z";
declare function getDefaultThemePreference(): AppThemePreference;
declare function createTimestampedValue<T>(value: T, updatedAt?: string): TimestampedValue<T>;
declare function createPrayerAppBackupPayload(input: {
    exportedAt?: string;
    notificationPreferences: TimestampedValue<PrayerAppBackupPayload['notificationPreferences']['value']>;
    prayerLogs: TimestampedValue<PrayerLogStore>;
    prayerPreferences: TimestampedValue<PrayerAppBackupPayload['prayerPreferences']['value']>;
    savedLocation: TimestampedValue<PrayerAppBackupPayload['savedLocation']['value']>;
    themePreference: TimestampedValue<AppThemePreference>;
}): PrayerAppBackupPayload;
declare function mergePrayerLogStores(local: PrayerLogStore, remote: PrayerLogStore): PrayerLogStore;
declare function mergeTimestampedValue<T>(local: TimestampedValue<T>, remote: TimestampedValue<T>, options?: {
    preferNonNullOnEqual?: boolean;
}): TimestampedValue<T>;
declare function mergePrayerAppBackupPayload(local: PrayerAppBackupPayload, remote: PrayerAppBackupPayload): PrayerAppBackupPayload;
declare function hasMeaningfulPrayerAppBackupData(backup: PrayerAppBackupPayload): boolean;

declare const appOverview: AppOverview;
declare const todayPrayerSchedule: PrayerTime[];
declare const coreModules: CoreModule[];
declare const featuredSurahs: SurahPreview[];
declare const duaCollections: DuaCollection[];
declare const worshipMetrics: WorshipMetric[];
declare const integrationsChecklist: IntegrationItem[];
declare const personalSettingsPreview: PersonalSettingPreview[];
declare const roadmapMilestones: RoadmapMilestone[];

declare const notificationPreReminderOptions: Array<{
    label: string;
    value: PrayerPreReminderMinutes;
}>;
declare const notifiablePrayerNames: TrackablePrayerName[];
declare function getDefaultPrayerNotificationPreferences(): PrayerNotificationPreferences;
declare function isNotifiablePrayerName(prayerName: string): prayerName is NotifiablePrayerName;
declare function createPrayerNotificationScheduleJobs(prayerDay: PrayerDay, preferences: PrayerNotificationPreferences, now?: Date): NotificationScheduleJob[];
declare function createRollingPrayerNotificationSchedule({ notificationPreferences, now, prayerPreferences, savedLocation, startDateKey, windowDays, }: {
    notificationPreferences: PrayerNotificationPreferences;
    now?: Date;
    prayerPreferences: PrayerPreferences;
    savedLocation: SavedLocation;
    startDateKey: string;
    windowDays?: number;
}): NotificationScheduleJob[];

declare const calculationMethodOptions: Array<{
    description: string;
    id: CalculationMethodId;
    label: string;
}>;
declare const madhabOptions: Array<{
    description: string;
    id: MadhabId;
    label: string;
}>;
declare const prayerAdjustmentOptions: Array<{
    key: keyof PrayerAdjustmentMap;
    label: PrayerName;
}>;
declare function formatDateKey(date: Date, timeZone?: string | null): string;
declare function parseDateKeyParts(dateKey: string): {
    day: number;
    month: number;
    year: number;
};
declare function createCalendarDateFromDateKey(dateKey: string): Date;
declare function createUtcAnchorFromDateKey(dateKey: string): Date;
declare function shiftDateKey(dateKey: string, amount: number): string;
declare function getDefaultPrayerPreferences(): PrayerPreferences;
declare function createSavedLocation(coordinates: SavedLocation['coordinates'], label: string, timeZone: string | null, source?: SavedLocation['source'], timeZoneSource?: TimeZoneSource): SavedLocation;
declare function computePrayerDay({ coordinates, date, dateKey, locationLabel, now, preferences, timeZone, }: {
    coordinates: SavedLocation['coordinates'];
    date?: Date;
    dateKey?: string;
    locationLabel: string;
    now?: Date;
    preferences: PrayerPreferences;
    timeZone?: string | null;
}): PrayerDay;

declare const trackablePrayerNames: TrackablePrayerName[];
declare function createPrayerLogDay(dateKey: string): PrayerLogDay;
declare function isTrackablePrayerName(prayerName: string): prayerName is TrackablePrayerName;
declare function setPrayerCompletion(store: PrayerLogStore, dateKey: string, prayerName: TrackablePrayerName, completed: boolean): {
    [x: string]: PrayerLogDay | {
        prayers: {
            Fajr: boolean;
            Dhuhr: boolean;
            Asr: boolean;
            Maghrib: boolean;
            Isha: boolean;
        };
        dateKey: string;
    };
};
declare function calculatePrayerMetrics(store: PrayerLogStore, todayKey: string): PrayerProgressSummary;

export { type ApiErrorResponse, type ApiHealthResponse, type AppOverview, type AppPlatform, type AppThemePreference, type CalculationMethodId, type Coordinates, type CoreModule, type DashboardResponse, type DuaCollection, type DuaCollectionsResponse, type FeaturedQuranResponse, type GoogleDriveAccount, type GoogleDriveAuthCompleteRequest, type GoogleDriveAuthCompleteResponse, type GoogleDriveAuthStartRequest, type GoogleDriveAuthStartResponse, type GoogleDriveBackupFetchResponse, type GoogleDriveBackupUpsertRequest, type GoogleDriveBackupUpsertResponse, type GoogleDriveSessionResponse, type IntegrationItem, type MadhabId, type NotifiablePrayerName, type NotificationDisableRequest, type NotificationPermissionState, type NotificationRefreshRequest, type NotificationScheduleJob, type NotificationScheduleJobKind, type NotificationSyncRequest, type NotificationSyncResponse, type OverviewResponse, type PersonalSettingPreview, type PrayerAdjustmentMap, type PrayerAppBackupPayload, type PrayerDay, type PrayerHistoryDay, type PrayerLogDay, type PrayerLogStore, type PrayerName, type PrayerNotificationPreferences, type PrayerPreReminderMinutes, type PrayerPreferences, type PrayerProgressSummary, type PrayerTime, type PrayerTimesResponse, type RoadmapMilestone, type RuntimeResponse, type SavedLocation, type SurahPreview, type TimeZoneSource, type TimestampedValue, type TrackablePrayerName, type WebPushSubscriptionInput, type WorshipMetric, appOverview, calculatePrayerMetrics, calculationMethodOptions, computePrayerDay, coreModules, createCalendarDateFromDateKey, createPrayerAppBackupPayload, createPrayerLogDay, createPrayerNotificationScheduleJobs, createRollingPrayerNotificationSchedule, createSavedLocation, createTimestampedValue, createUtcAnchorFromDateKey, duaCollections, featuredSurahs, formatDateKey, getDefaultPrayerNotificationPreferences, getDefaultPrayerPreferences, getDefaultThemePreference, hasMeaningfulPrayerAppBackupData, integrationsChecklist, isNotifiablePrayerName, isTrackablePrayerName, madhabOptions, mergePrayerAppBackupPayload, mergePrayerLogStores, mergeTimestampedValue, notifiablePrayerNames, notificationPreReminderOptions, parseDateKeyParts, personalSettingsPreview, prayerAdjustmentOptions, prayerAppBackupVersion, roadmapMilestones, setPrayerCompletion, shiftDateKey, syncEpochTimestamp, todayPrayerSchedule, trackablePrayerNames, worshipMetrics };
