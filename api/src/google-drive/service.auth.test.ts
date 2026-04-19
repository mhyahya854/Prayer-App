import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleDriveService } from './service';
import type { GoogleDriveAuthStore } from './store';

class MockAuthStore implements GoogleDriveAuthStore {
  states = new Map<string, { redirectUri: string; expiresAt: number }>();
  
  async createPendingState(record: { state: string; redirectUri: string; expiresAt: string }) {
    this.states.set(record.state, { redirectUri: record.redirectUri, expiresAt: Date.parse(record.expiresAt) });
  }

  async getRedirectUriForState(state: string) {
    return this.states.get(state)?.redirectUri ?? null;
  }

  async claimCompletedState() { return null; }
  async deleteSession() {}
  async finalizeState() { return null; }
  async getAccount() { return null; }
  async getSession() { return null; }
}

test('GoogleDriveService.startAuth generates a secure state token and saves it', async () => {
  const store = new MockAuthStore();
  const service = new GoogleDriveService(
    { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' },
    store
  );

  const response = await service.startAuth({
    installationId: 'test-inst',
    platform: 'web',
    redirectUri: 'http://app.local/auth-finish'
  });

  assert.ok(response.authUrl.includes('state=gdrv_'));
  const stateToken = new URL(response.authUrl).searchParams.get('state')!;
  
  const saved = store.states.get(stateToken);
  assert.ok(saved);
  assert.equal(saved.redirectUri, 'http://app.local/auth-finish');
});

test('GoogleDriveService.getRedirectUriForState returns nothing for expired or missing tokens', async () => {
    const store = new MockAuthStore();
    const service = new GoogleDriveService(
      { clientId: 'id', clientSecret: 'secret', redirectUri: 'http://localhost/cb' },
      store
    );
  
    // Missing token
    assert.equal(await service.getRedirectUriForState('missing'), null);
  
    // Expired token
    store.states.set('expired', { redirectUri: 'http://uri', expiresAt: Date.now() - 1000 });
    assert.equal(await service.getRedirectUriForState('expired'), null);
});
