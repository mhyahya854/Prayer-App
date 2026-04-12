import webpush from 'web-push';
import {
  createRollingPrayerNotificationSchedule,
  formatDateKey,
  type NotificationDisableRequest,
  type NotificationRefreshRequest,
  type NotificationScheduleJob,
  type NotificationSyncRequest,
  type NotificationSyncResponse,
} from '@prayer-app/core';

import type { NotificationStore, StoredPushJob } from './store';

interface WebPushSender {
  configured: boolean;
  send: (job: StoredPushJob) => Promise<void>;
}

export interface NotificationService {
  disableWebPush: (request: NotificationDisableRequest) => Promise<NotificationSyncResponse>;
  processDueJobs: (now?: Date) => Promise<number>;
  refreshWebPush: (request: NotificationRefreshRequest) => Promise<NotificationSyncResponse>;
  syncWebPush: (request: NotificationSyncRequest) => Promise<NotificationSyncResponse>;
  startWorker: () => () => void;
}

function createWebPushSender(config: {
  subject: string;
  vapidPrivateKey: string;
  vapidPublicKey: string;
}): WebPushSender {
  const configured = Boolean(config.subject && config.vapidPrivateKey && config.vapidPublicKey);

  if (configured) {
    webpush.setVapidDetails(config.subject, config.vapidPublicKey, config.vapidPrivateKey);
  }

  return {
    configured,
    async send(job) {
      if (!configured) {
        return;
      }

      await webpush.sendNotification(
        {
          endpoint: job.endpoint,
          keys: {
            auth: job.payload.subscription.keys.auth,
            p256dh: job.payload.subscription.keys.p256dh,
          },
        },
        JSON.stringify(job.payload),
      );
    },
  };
}

function buildJobPayload(job: NotificationScheduleJob, subscription: NotificationSyncRequest['pushSubscription']) {
  return {
    ...job,
    subscription,
    url: '/',
  };
}

export function createNotificationService({
  notificationWorkerIntervalMs,
  sender: senderOverride,
  store,
  webPush,
}: {
  notificationWorkerIntervalMs: number;
  sender?: WebPushSender;
  store: NotificationStore;
  webPush: {
    subject: string;
    vapidPrivateKey: string;
    vapidPublicKey: string;
  };
}): NotificationService {
  const sender = senderOverride ?? createWebPushSender(webPush);

  async function upsertWebJobs(
    installationId: string,
    jobs: NotificationScheduleJob[],
    pushSubscription: NotificationSyncRequest['pushSubscription'] | null,
  ) {
    if (!pushSubscription) {
      await store.replacePendingJobs(installationId, []);
      return 0;
    }

    const nextJobs = jobs.map((job) => ({
      dedupeKey: `${installationId}:${job.id}`,
      endpoint: pushSubscription.endpoint,
      fireAt: job.fireAt,
      installationId,
      payload: buildJobPayload(job, pushSubscription),
    }));

    await store.replacePendingJobs(installationId, nextJobs);
    return nextJobs.length;
  }

  async function syncLike(
    request: NotificationSyncRequest | NotificationRefreshRequest,
    pushSubscription: NotificationSyncRequest['pushSubscription'] | null,
  ) {
    const now = new Date();
    const effectivePushSubscription = pushSubscription && sender.configured ? pushSubscription : null;

    await store.upsertWebInstallation({
      installationId: request.installationId,
      notificationPreferences: request.notificationPreferences,
      platform: 'web',
      prayerPreferences: request.prayerPreferences,
      pushSubscription: effectivePushSubscription,
      savedLocation: request.savedLocation,
    });

    const jobs = createRollingPrayerNotificationSchedule({
      notificationPreferences: request.notificationPreferences,
      now,
      prayerPreferences: request.prayerPreferences,
      savedLocation: request.savedLocation,
      startDateKey: formatDateKey(now, request.savedLocation.timeZone),
      windowDays: 5,
    });
    const scheduledJobCount = await upsertWebJobs(
      request.installationId,
      jobs,
      effectivePushSubscription,
    );

    return {
      installationId: request.installationId,
      scheduledJobCount,
      success: true as const,
      webPushEnabled: Boolean(effectivePushSubscription),
    };
  }

  async function refreshWebPush(request: NotificationRefreshRequest) {
    const existingProfile = await store.getInstallationProfile(request.installationId);
    const pushSubscription = existingProfile?.pushSubscription ?? null;

    return syncLike(request, pushSubscription);
  }

  async function processDueJobs(now = new Date()) {
    if (!sender.configured) {
      return 0;
    }

    const dueJobs = await store.getDueJobs(now, 50);
    if (dueJobs.length === 0) {
      return 0;
    }

    const sentKeys: string[] = [];
    const failedKeys: string[] = [];

    for (const job of dueJobs) {
      try {
        await sender.send(job);
        sentKeys.push(job.dedupeKey);
      } catch {
        failedKeys.push(job.dedupeKey);
      }
    }

    if (sentKeys.length > 0) {
      await store.markJobsSent(sentKeys);
    }

    if (failedKeys.length > 0) {
      await store.markJobsFailed(failedKeys, 'Web push delivery failed.');
    }

    return sentKeys.length;
  }

  return {
    async disableWebPush(request) {
      await store.disableInstallation(request.installationId);

      return {
        installationId: request.installationId,
        scheduledJobCount: 0,
        success: true,
        webPushEnabled: false,
      };
    },

    processDueJobs,

    refreshWebPush,

    syncWebPush(request) {
      return syncLike(request, request.pushSubscription);
    },

    startWorker() {
      const interval = setInterval(() => {
        void processDueJobs();
      }, notificationWorkerIntervalMs);
      interval.unref?.();

      return () => {
        clearInterval(interval);
      };
    },
  };
}
