import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleDriveService } from './service';
import type { GoogleDriveAuthStore } from './store';

class MockAuthStore implements GoogleDriveAuthStore {
  states = new Map<string, { redirectUri: string; expiresAt: number }>();
  
  async saveAuthState(token: string, redirectUri: string, expiresAt: number) {
    this.states.set(token, { redirectUri, expiresAt });
  }

  async getAuthState(token: string) {
    return this.states.get(token) ?? null;
  }

  async deleteAuthState(token: string) {
    this.states.delete(token);
  }

  // Not needed for auth state tests
  async saveAccount() {}
  async getAccount() { return null; }
  async saveSession() {}
  async getSession() { return null; }
  async deleteSession() {}
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
  
  const saved = await store.getAuthState(stateToken);
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
    await store.saveAuthState('expired', 'http://uri', Date.now() - 1000);
    assert.equal(await service.getRedirectUriForState('expired'), null);
});
