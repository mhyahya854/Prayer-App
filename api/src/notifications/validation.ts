import { z } from 'zod';

import {
  notificationPreferencesSchema,
  prayerPreferencesSchema,
  savedLocationSchema,
} from '../validation';

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(1),
  expirationTime: z.number().nullable(),
  keys: z.object({
    auth: z.string().trim().min(1),
    p256dh: z.string().trim().min(1),
  }),
});

export const notificationSyncBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  notificationPreferences: notificationPreferencesSchema,
  platform: z.literal('web'),
  prayerPreferences: prayerPreferencesSchema,
  pushSubscription: pushSubscriptionSchema,
  savedLocation: savedLocationSchema,
});

export const notificationRefreshBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  notificationPreferences: notificationPreferencesSchema,
  platform: z.literal('web'),
  prayerPreferences: prayerPreferencesSchema,
  savedLocation: savedLocationSchema,
});

export const notificationDisableBodySchema = z.object({
  installationId: z.string().trim().min(1).max(120),
  platform: z.literal('web'),
});
