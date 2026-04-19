import {
  and,
  eq,
  inArray,
  lte,
} from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type {
  NotificationScheduleJob,
  PrayerNotificationPreferences,
  PrayerPreferences,
  RuntimeResponse,
  SavedLocation,
  WebPushSubscriptionInput,
} from '@prayer-app/core';

import {
  installations,
  notificationProfiles,
  pushDeliveryJobs,
  webPushSubscriptions,
} from './schema';
import { RateLimitError, BadRequestError, ServiceUnavailableError } from '../errors';

export interface StoredInstallationProfile {
  installationId: string;
  notificationPreferences: PrayerNotificationPreferences;
  platform: 'web';
  prayerPreferences: PrayerPreferences;
  pushSubscription: WebPushSubscriptionInput | null;
  savedLocation: SavedLocation;
}

export interface StoredPushJob {
  dedupeKey: string;
  endpoint: string;
  fireAt: string;
  installationId: string;
  payload: NotificationScheduleJob & {
    subscription: WebPushSubscriptionInput;
    url: string;
  };
}

export interface NotificationStore {
  disableInstallation: (installationId: string) => Promise<void>;
  getInstallationProfile: (installationId: string) => Promise<StoredInstallationProfile | null>;
  getDueJobs: (now: Date, limit: number) => Promise<StoredPushJob[]>;
  replacePendingJobs: (installationId: string, jobs: StoredPushJob[]) => Promise<void>;
  markJobsFailed: (dedupeKeys: string[], message: string) => Promise<void>;
  markJobsSent: (dedupeKeys: string[]) => Promise<void>;
  upsertWebInstallation: (profile: StoredInstallationProfile) => Promise<void>;
}

export interface NotificationStoreOptions {
  allowMemoryFallback?: boolean;
  stage?: RuntimeResponse['stage'];
}

class MemoryNotificationStore implements NotificationStore {
  private readonly jobs = new Map<string, StoredPushJob & { status: 'failed' | 'pending' | 'sent'; lastError?: string }>();

  private readonly profiles = new Map<string, StoredInstallationProfile>();

  async disableInstallation(installationId: string) {
    const existing = this.profiles.get(installationId);
    if (!existing) {
      return;
    }

    this.profiles.set(installationId, {
      ...existing,
      pushSubscription: null,
    });

    for (const [dedupeKey, job] of this.jobs.entries()) {
      if (job.installationId === installationId && job.status === 'pending') {
        this.jobs.delete(dedupeKey);
      }
    }
  }

  async getInstallationProfile(installationId: string) {
    return this.profiles.get(installationId) ?? null;
  }

  async getDueJobs(now: Date, limit: number) {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === 'pending' && Date.parse(job.fireAt) <= now.getTime())
      .sort((left, right) => Date.parse(left.fireAt) - Date.parse(right.fireAt))
      .slice(0, limit)
      .map(({ status: _status, lastError: _lastError, ...job }) => job);
  }

  async replacePendingJobs(installationId: string, jobs: StoredPushJob[]) {
    // Guardrails: cap number of pending jobs per installation and payload size.
    const maxJobs = Number(process.env.NOTIFICATION_MAX_PENDING_JOBS_PER_INSTALLATION ?? '500');
    const maxPayloadBytes = Number(process.env.NOTIFICATION_MAX_PAYLOAD_BYTES ?? '4096');

        if (jobs.length > maxJobs) {
          throw new RateLimitError('Too many pending notification jobs', { max: maxJobs });
        }

    for (const job of jobs) {
      const payloadSize = Buffer.byteLength(JSON.stringify(job.payload), 'utf8');
          if (payloadSize > maxPayloadBytes) {
            throw new BadRequestError('Notification payload too large', 'notification_payload_too_large');
          }
    }

    for (const [dedupeKey, job] of this.jobs.entries()) {
      if (job.installationId === installationId && job.status === 'pending') {
        this.jobs.delete(dedupeKey);
      }
    }

    for (const job of jobs) {
      this.jobs.set(job.dedupeKey, {
        ...job,
        status: 'pending',
      });
    }
  }

  async markJobsFailed(dedupeKeys: string[], message: string) {
    for (const dedupeKey of dedupeKeys) {
      const existing = this.jobs.get(dedupeKey);
      if (!existing) {
        continue;
      }

      this.jobs.set(dedupeKey, {
        ...existing,
        lastError: message,
        status: 'failed',
      });
    }
  }

  async markJobsSent(dedupeKeys: string[]) {
    for (const dedupeKey of dedupeKeys) {
      const existing = this.jobs.get(dedupeKey);
      if (!existing) {
        continue;
      }

      this.jobs.set(dedupeKey, {
        ...existing,
        status: 'sent',
      });
    }
  }

  async upsertWebInstallation(profile: StoredInstallationProfile) {
    this.profiles.set(profile.installationId, profile);
  }
}

class PostgresNotificationStore implements NotificationStore {
  private readonly database: NodePgDatabase;

  private readonly pool: Pool;

  private schemaReady = false;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    });
    this.database = drizzle(this.pool);
  }

  private async ensureSchema() {
    if (this.schemaReady) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS installations (
        installation_id text PRIMARY KEY,
        platform text NOT NULL,
        account_provider text,
        account_subject text,
        last_known_time_zone text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS notification_profiles (
        installation_id text PRIMARY KEY REFERENCES installations(installation_id) ON DELETE CASCADE,
        prayer_preferences jsonb NOT NULL,
        notification_preferences jsonb NOT NULL,
        saved_location jsonb NOT NULL,
        notifications_enabled boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS web_push_subscriptions (
        installation_id text PRIMARY KEY REFERENCES installations(installation_id) ON DELETE CASCADE,
        endpoint text NOT NULL UNIQUE,
        expiration_time bigint,
        auth_key text NOT NULL,
        p256dh_key text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS push_delivery_jobs (
        dedupe_key text PRIMARY KEY,
        installation_id text NOT NULL REFERENCES installations(installation_id) ON DELETE CASCADE,
        endpoint text NOT NULL,
        fire_at timestamptz NOT NULL,
        payload jsonb NOT NULL,
        prayer_name text NOT NULL,
        kind text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.schemaReady = true;
  }

  async disableInstallation(installationId: string) {
    await this.ensureSchema();

    await this.database
      .update(notificationProfiles)
      .set({
        notificationsEnabled: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(notificationProfiles.installationId, installationId));

    await this.database
      .delete(webPushSubscriptions)
      .where(eq(webPushSubscriptions.installationId, installationId));

    await this.database
      .delete(pushDeliveryJobs)
      .where(and(eq(pushDeliveryJobs.installationId, installationId), eq(pushDeliveryJobs.status, 'pending')));
  }

  async getInstallationProfile(installationId: string) {
    await this.ensureSchema();

    const rows = await this.database
      .select({
        installationId: installations.installationId,
        notificationPreferences: notificationProfiles.notificationPreferences,
        platform: installations.platform,
        prayerPreferences: notificationProfiles.prayerPreferences,
        savedLocation: notificationProfiles.savedLocation,
        subscriptionAuthKey: webPushSubscriptions.authKey,
        subscriptionEndpoint: webPushSubscriptions.endpoint,
        subscriptionExpirationTime: webPushSubscriptions.expirationTime,
        subscriptionP256dhKey: webPushSubscriptions.p256dhKey,
        subscriptionStatus: webPushSubscriptions.status,
      })
      .from(installations)
      .innerJoin(notificationProfiles, eq(notificationProfiles.installationId, installations.installationId))
      .leftJoin(webPushSubscriptions, eq(webPushSubscriptions.installationId, installations.installationId))
      .where(eq(installations.installationId, installationId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      installationId: row.installationId,
      notificationPreferences: row.notificationPreferences as PrayerNotificationPreferences,
      platform: 'web' as const,
      prayerPreferences: row.prayerPreferences as PrayerPreferences,
      pushSubscription:
        row.subscriptionStatus === 'active' &&
        row.subscriptionEndpoint &&
        row.subscriptionAuthKey &&
        row.subscriptionP256dhKey
          ? {
              endpoint: row.subscriptionEndpoint,
              expirationTime: row.subscriptionExpirationTime ?? null,
              keys: {
                auth: row.subscriptionAuthKey,
                p256dh: row.subscriptionP256dhKey,
              },
            }
          : null,
      savedLocation: row.savedLocation as SavedLocation,
    };
  }

  async getDueJobs(now: Date, limit: number) {
    await this.ensureSchema();

    const rows = await this.database
      .select({
        dedupeKey: pushDeliveryJobs.dedupeKey,
        endpoint: pushDeliveryJobs.endpoint,
        fireAt: pushDeliveryJobs.fireAt,
        installationId: pushDeliveryJobs.installationId,
        payload: pushDeliveryJobs.payload,
      })
      .from(pushDeliveryJobs)
      .where(and(eq(pushDeliveryJobs.status, 'pending'), lte(pushDeliveryJobs.fireAt, now.toISOString())))
      .limit(limit);

    return rows as StoredPushJob[];
  }

  async replacePendingJobs(installationId: string, jobs: StoredPushJob[]) {
    await this.ensureSchema();
    // Guardrails: cap number of pending jobs per installation and payload size.
    const maxJobs = Number(process.env.NOTIFICATION_MAX_PENDING_JOBS_PER_INSTALLATION ?? '500');
    const maxPayloadBytes = Number(process.env.NOTIFICATION_MAX_PAYLOAD_BYTES ?? '4096');

        if (jobs.length > maxJobs) {
          throw new RateLimitError('Too many pending notification jobs', { max: maxJobs });
        }

    for (const job of jobs) {
      const payloadSize = Buffer.byteLength(JSON.stringify(job.payload), 'utf8');
          if (payloadSize > maxPayloadBytes) {
            throw new BadRequestError('Notification payload too large', 'notification_payload_too_large');
          }
    }

    await this.database
      .delete(pushDeliveryJobs)
      .where(and(eq(pushDeliveryJobs.installationId, installationId), eq(pushDeliveryJobs.status, 'pending')));

    if (jobs.length === 0) {
      return;
    }

    await this.database
      .insert(pushDeliveryJobs)
      .values(
        jobs.map((job) => ({
          dedupeKey: job.dedupeKey,
          endpoint: job.endpoint,
          fireAt: job.fireAt,
          installationId: job.installationId,
          kind: job.payload.kind,
          payload: job.payload,
          prayerName: job.payload.prayerName,
        })),
      );
  }

  async markJobsFailed(dedupeKeys: string[], message: string) {
    await this.ensureSchema();
    if (dedupeKeys.length === 0) {
      return;
    }

    await this.database
      .update(pushDeliveryJobs)
      .set({
        attempts: 1,
        lastError: message,
        status: 'failed',
        updatedAt: new Date().toISOString(),
      })
      .where(inArray(pushDeliveryJobs.dedupeKey, dedupeKeys));
  }

  async markJobsSent(dedupeKeys: string[]) {
    await this.ensureSchema();
    if (dedupeKeys.length === 0) {
      return;
    }

    await this.database
      .update(pushDeliveryJobs)
      .set({
        sentAt: new Date().toISOString(),
        status: 'sent',
        updatedAt: new Date().toISOString(),
      })
      .where(inArray(pushDeliveryJobs.dedupeKey, dedupeKeys));
  }

  async upsertWebInstallation(profile: StoredInstallationProfile) {
    await this.ensureSchema();

    await this.database
      .insert(installations)
      .values({
        installationId: profile.installationId,
        lastKnownTimeZone: profile.savedLocation.timeZone,
        platform: profile.platform,
      })
      .onConflictDoUpdate({
        set: {
          lastKnownTimeZone: profile.savedLocation.timeZone,
          platform: profile.platform,
          updatedAt: new Date().toISOString(),
        },
        target: installations.installationId,
      });

    await this.database
      .insert(notificationProfiles)
      .values({
        installationId: profile.installationId,
        notificationPreferences: profile.notificationPreferences,
        notificationsEnabled: Boolean(profile.pushSubscription),
        prayerPreferences: profile.prayerPreferences,
        savedLocation: profile.savedLocation,
      })
      .onConflictDoUpdate({
        set: {
          notificationPreferences: profile.notificationPreferences,
          notificationsEnabled: Boolean(profile.pushSubscription),
          prayerPreferences: profile.prayerPreferences,
          savedLocation: profile.savedLocation,
          updatedAt: new Date().toISOString(),
        },
        target: notificationProfiles.installationId,
      });

    if (!profile.pushSubscription) {
      await this.database
        .delete(webPushSubscriptions)
        .where(eq(webPushSubscriptions.installationId, profile.installationId));
      return;
    }

    await this.database
      .insert(webPushSubscriptions)
      .values({
        authKey: profile.pushSubscription.keys.auth,
        endpoint: profile.pushSubscription.endpoint,
        expirationTime: profile.pushSubscription.expirationTime ?? null,
        installationId: profile.installationId,
        p256dhKey: profile.pushSubscription.keys.p256dh,
        status: 'active',
      })
      .onConflictDoUpdate({
        set: {
          authKey: profile.pushSubscription.keys.auth,
          endpoint: profile.pushSubscription.endpoint,
          expirationTime: profile.pushSubscription.expirationTime ?? null,
          p256dhKey: profile.pushSubscription.keys.p256dh,
          status: 'active',
          updatedAt: new Date().toISOString(),
        },
        target: webPushSubscriptions.installationId,
      });
  }
}

export function createNotificationStore(
  databaseUrl?: string,
  options: NotificationStoreOptions = {},
): NotificationStore {
  const stage = options.stage ?? 'development';
  const allowMemoryFallback = options.allowMemoryFallback ?? stage === 'development';

        if (!databaseUrl) {
          if (!allowMemoryFallback) {
            throw new ServiceUnavailableError(`DATABASE_URL is required in ${stage} for durable notification storage.`);
          }

    return new MemoryNotificationStore();
  }

  return new PostgresNotificationStore(databaseUrl);
}
