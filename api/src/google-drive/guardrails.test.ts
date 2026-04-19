import assert from 'node:assert/strict';
import test from 'node:test';

import { createGoogleDriveAuthStore } from './store';
import { GoogleDriveService } from './service';

test('in-memory sessions expire after TTL', async () => {
  const store = createGoogleDriveAuthStore();

  // create pending state and finalize to create a session
  await store.createPendingState({
    state: 's1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    installationId: 'inst-1',
    platform: 'web',
    redirectUri: 'http://app.local',
  });

  const account = {
    email: 'a@example.com',
    name: 'A',
    pictureUrl: null,
    refreshToken: 'rt',
    subject: 'sub1',
  };

  const token = 'sess-guardrails-1';
  await store.finalizeState({ account, sessionToken: token, state: 's1' });

  // session should exist initially
  const session = await store.getSession(token);
  assert.ok(session);

  // force the in-memory session createdAt into the past so TTL check triggers
  const sessionsMap = (store as any).sessions as Map<string, any>;
  const raw = sessionsMap.get(token);
  raw.createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31).toISOString();
  sessionsMap.set(token, raw);

  const expired = await store.getSession(token);
  assert.equal(expired, null);
});

test('upsertBackup aborts when snapshot copy fails', async () => {
  // Prepare a memory-based store with a valid session
  const store = createGoogleDriveAuthStore();
  await store.createPendingState({
    state: 's2',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    installationId: 'inst-2',
    platform: 'web',
    redirectUri: 'http://app.local',
  });

  const account = {
    email: 'b@example.com',
    name: 'B',
    pictureUrl: null,
    refreshToken: 'rt',
    subject: 'sub2',
  };

  const token = 'sess-guardrails-2';
  await store.finalizeState({ account, sessionToken: token, state: 's2' });

  const service = new GoogleDriveService({ clientId: 'id', clientSecret: 'secret', redirectUri: 'http://cb' }, store);

  // Monkeypatch internals: refreshAccessToken and findBackupFile
  (service as any).refreshAccessToken = async () => 'fake-access-token';
  (service as any).findBackupFile = async () => ({ id: 'file-123', modifiedTime: new Date().toISOString() });

  // Stub global fetch so that copy attempt fails
  const originalFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });

  let threw = false;
  try {
    await (service as any).upsertBackup(token, { version: '1', payload: {} });
  } catch (err) {
    threw = true;
  } finally {
    (globalThis as any).fetch = originalFetch;
  }

  assert.ok(threw, 'upsertBackup should throw when snapshot copy fails');
});
