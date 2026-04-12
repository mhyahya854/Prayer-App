import type { WebPushSubscriptionInput } from '@prayer-app/core';

const serviceWorkerPath = '/notifications-sw.js';

function convertBase64ToUint8Array(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizeSubscription(subscription: PushSubscription): WebPushSubscriptionInput {
  const serialized = subscription.toJSON();
  const auth = serialized.keys?.auth;
  const p256dh = serialized.keys?.p256dh;

  if (!serialized.endpoint || !auth || !p256dh) {
    throw new Error('Browser push subscription is missing encryption keys.');
  }

  return {
    endpoint: serialized.endpoint,
    expirationTime: serialized.expirationTime ?? null,
    keys: {
      auth,
      p256dh,
    },
  };
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function registerNotificationServiceWorker() {
  if (!isWebPushSupported()) {
    return null;
  }

  return navigator.serviceWorker.register(serviceWorkerPath);
}

export async function getWebPushSubscription(registration: ServiceWorkerRegistration) {
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? normalizeSubscription(subscription) : null;
}

export async function ensureWebPushSubscription(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
) {
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    return normalizeSubscription(existingSubscription);
  }

  const subscription = await registration.pushManager.subscribe({
    applicationServerKey: convertBase64ToUint8Array(vapidPublicKey),
    userVisibleOnly: true,
  });

  return normalizeSubscription(subscription);
}

export async function removeWebPushSubscription(registration: ServiceWorkerRegistration) {
  const existingSubscription = await registration.pushManager.getSubscription();
  if (!existingSubscription) {
    return false;
  }

  return existingSubscription.unsubscribe();
}
