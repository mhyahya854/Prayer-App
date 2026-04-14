import { z } from 'zod';

const trackablePrayerRecordSchema = z.object({
  Asr: z.boolean(),
  Dhuhr: z.boolean(),
  Fajr: z.boolean(),
  Isha: z.boolean(),
  Maghrib: z.boolean(),
  Sunrise: z.boolean(),
});

const prayerLogDaySchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prayers: trackablePrayerRecordSchema,
});

const prayerLogStoreSchema = z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), prayerLogDaySchema);

const prayerPreferencesSchema = z.object({
  adjustments: z.object({
    fajr: z.number().int().min(-30).max(30),
    sunrise: z.number().int().min(-30).max(30),
    dhuhr: z.number().int().min(-30).max(30),
    asr: z.number().int().min(-30).max(30),
    maghrib: z.number().int().min(-30).max(30),
    isha: z.number().int().min(-30).max(30),
  }),
  calculationMethod: z.enum([
    'muslim-world-league',
    'egyptian',
    'karachi',
    'umm-al-qura',
    'north-america',
    'singapore',
    'qatar',
    'turkey',
  ]),
  madhab: z.enum(['shafi', 'hanafi']),
});

const notificationPreferencesSchema = z.object({
  enabledPrayers: z.object({
    Asr: z.boolean(),
    Dhuhr: z.boolean(),
    Fajr: z.boolean(),
    Isha: z.boolean(),
    Maghrib: z.boolean(),
    Sunrise: z.boolean(),
  }),
  preReminderMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.null()]),
});

const savedLocationSchema = z.object({
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  label: z.string().trim().min(1).max(120),
  source: z.enum(['device', 'manual']),
  timeZone: z.string().trim().min(1).max(120).nullable(),
  timeZoneSource: z.enum(['geo', 'manual', 'device-fallback']),
  updatedAt: z.string().trim().min(1),
});

function createTimestampedValueSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    updatedAt: z.string().trim().min(1),
    value: schema,
  });
}

export const prayerAppBackupPayloadSchema = z.object({
  exportedAt: z.string().trim().min(1),
  notificationPreferences: createTimestampedValueSchema(notificationPreferencesSchema),
  prayerLogs: createTimestampedValueSchema(prayerLogStoreSchema),
  prayerPreferences: createTimestampedValueSchema(prayerPreferencesSchema),
  savedLocation: createTimestampedValueSchema(savedLocationSchema.nullable()),
  themePreference: createTimestampedValueSchema(z.enum(['system', 'light', 'dark'])),
  version: z.number().int().min(1),
});

export const googleDriveAuthStartBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  platform: z.enum(['android', 'ios', 'web']),
  redirectUri: z.string().trim().url(),
});

export const googleDriveAuthCompleteBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1),
});

export const googleDriveBackupUpsertBodySchema = z.object({
  backup: prayerAppBackupPayloadSchema,
});

export const googleDriveExportDocumentBodySchema = z.object({
  folderName: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  content: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
});
