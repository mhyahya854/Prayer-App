import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const installations = pgTable('installations', {
  accountProvider: text('account_provider'),
  accountSubject: text('account_subject'),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  installationId: text('installation_id').primaryKey(),
  lastKnownTimeZone: text('last_known_time_zone'),
  platform: text('platform').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const notificationProfiles = pgTable('notification_profiles', {
  installationId: text('installation_id')
    .primaryKey()
    .references(() => installations.installationId, { onDelete: 'cascade' }),
  notificationPreferences: jsonb('notification_preferences').notNull(),
  notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
  prayerPreferences: jsonb('prayer_preferences').notNull(),
  savedLocation: jsonb('saved_location').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const webPushSubscriptions = pgTable('web_push_subscriptions', {
  authKey: text('auth_key').notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  endpoint: text('endpoint').notNull().unique(),
  expirationTime: bigint('expiration_time', { mode: 'number' }),
  installationId: text('installation_id')
    .primaryKey()
    .references(() => installations.installationId, { onDelete: 'cascade' }),
  p256dhKey: text('p256dh_key').notNull(),
  status: text('status').default('active').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const pushDeliveryJobs = pgTable('push_delivery_jobs', {
  attempts: integer('attempts').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  dedupeKey: text('dedupe_key').primaryKey(),
  endpoint: text('endpoint').notNull(),
  fireAt: timestamp('fire_at', { mode: 'string', withTimezone: true }).notNull(),
  installationId: text('installation_id')
    .references(() => installations.installationId, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull(),
  lastError: text('last_error'),
  payload: jsonb('payload').notNull(),
  prayerName: text('prayer_name').notNull(),
  sentAt: timestamp('sent_at', { mode: 'string', withTimezone: true }),
  status: text('status').default('pending').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const installationRelations = relations(installations, ({ many, one }) => ({
  jobs: many(pushDeliveryJobs),
  profile: one(notificationProfiles, {
    fields: [installations.installationId],
    references: [notificationProfiles.installationId],
  }),
  subscription: one(webPushSubscriptions, {
    fields: [installations.installationId],
    references: [webPushSubscriptions.installationId],
  }),
}));

export const notificationProfileRelations = relations(notificationProfiles, ({ one }) => ({
  installation: one(installations, {
    fields: [notificationProfiles.installationId],
    references: [installations.installationId],
  }),
}));

export const webPushSubscriptionRelations = relations(webPushSubscriptions, ({ one }) => ({
  installation: one(installations, {
    fields: [webPushSubscriptions.installationId],
    references: [installations.installationId],
  }),
}));

export const pushDeliveryJobRelations = relations(pushDeliveryJobs, ({ one }) => ({
  installation: one(installations, {
    fields: [pushDeliveryJobs.installationId],
    references: [installations.installationId],
  }),
}));
