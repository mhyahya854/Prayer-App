import { Pool } from 'pg';

import type {
  AppPlatform,
  GoogleDriveAccount,
} from '@prayer-app/core';

export interface StoredGoogleAccount extends GoogleDriveAccount {
  refreshToken: string;
}

export interface StoredGoogleDriveSession {
  account: StoredGoogleAccount;
  installationId: string;
  platform: AppPlatform;
  sessionToken: string;
}

interface PendingStateRecord {
  expiresAt: string;
  installationId: string;
  platform: AppPlatform;
  redirectUri: string;
  state: string;
}

interface CompletedStateRecord extends PendingStateRecord {
  accountSubject: string;
  sessionToken: string;
}

export interface GoogleDriveAuthStore {
  claimCompletedState: (installationId: string, state: string) => Promise<StoredGoogleDriveSession | null>;
  createPendingState: (record: PendingStateRecord) => Promise<void>;
  deleteSession: (sessionToken: string) => Promise<void>;
  finalizeState: (input: {
    account: StoredGoogleAccount;
    sessionToken: string;
    state: string;
  }) => Promise<string | null>;
  getAccount: (subject: string) => Promise<StoredGoogleAccount | null>;
  getRedirectUriForState: (state: string) => Promise<string | null>;
  getSession: (sessionToken: string) => Promise<StoredGoogleDriveSession | null>;
}

class MemoryGoogleDriveAuthStore implements GoogleDriveAuthStore {
  private readonly accounts = new Map<string, StoredGoogleAccount>();
  private readonly completedStates = new Map<string, CompletedStateRecord>();
  private readonly pendingStates = new Map<string, PendingStateRecord>();
  private readonly sessions = new Map<string, StoredGoogleDriveSession>();

  async claimCompletedState(installationId: string, state: string) {
    const record = this.completedStates.get(state);
    if (!record || record.installationId !== installationId) {
      return null;
    }

    const session = this.sessions.get(record.sessionToken) ?? null;
    this.completedStates.delete(state);
    return session;
  }

  async createPendingState(record: PendingStateRecord) {
    this.pendingStates.set(record.state, record);
  }

  async deleteSession(sessionToken: string) {
    this.sessions.delete(sessionToken);
  }

  async finalizeState(input: {
    account: StoredGoogleAccount;
    sessionToken: string;
    state: string;
  }) {
    const record = this.pendingStates.get(input.state);
    if (!record || Date.parse(record.expiresAt) <= Date.now()) {
      return null;
    }

    this.accounts.set(input.account.subject, input.account);

    for (const [token, session] of this.sessions.entries()) {
      if (session.installationId === record.installationId) {
        this.sessions.delete(token);
      }
    }

    this.sessions.set(input.sessionToken, {
      account: input.account,
      installationId: record.installationId,
      platform: record.platform,
      sessionToken: input.sessionToken,
    });
    this.completedStates.set(input.state, {
      ...record,
      accountSubject: input.account.subject,
      sessionToken: input.sessionToken,
    });
    this.pendingStates.delete(input.state);

    return record.redirectUri;
  }

  async getAccount(subject: string) {
    return this.accounts.get(subject) ?? null;
  }

  async getRedirectUriForState(state: string) {
    return this.pendingStates.get(state)?.redirectUri ?? this.completedStates.get(state)?.redirectUri ?? null;
  }

  async getSession(sessionToken: string) {
    return this.sessions.get(sessionToken) ?? null;
  }
}

class PostgresGoogleDriveAuthStore implements GoogleDriveAuthStore {
  private readonly pool: Pool;
  private schemaReady = false;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    });
  }

  private async ensureSchema() {
    if (this.schemaReady) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS google_accounts (
        account_subject text PRIMARY KEY,
        email text NOT NULL,
        name text,
        picture_url text,
        refresh_token text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS google_drive_sessions (
        session_token text PRIMARY KEY,
        installation_id text NOT NULL,
        account_subject text NOT NULL REFERENCES google_accounts(account_subject) ON DELETE CASCADE,
        platform text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS google_auth_states (
        state text PRIMARY KEY,
        installation_id text NOT NULL,
        platform text NOT NULL,
        redirect_uri text NOT NULL,
        account_subject text,
        session_token text,
        status text NOT NULL DEFAULT 'pending',
        expires_at timestamptz NOT NULL,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    this.schemaReady = true;
  }

  async claimCompletedState(installationId: string, state: string) {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT
          sessions.session_token,
          sessions.installation_id,
          sessions.platform,
          accounts.account_subject,
          accounts.email,
          accounts.name,
          accounts.picture_url,
          accounts.refresh_token
        FROM google_auth_states states
        INNER JOIN google_drive_sessions sessions ON sessions.session_token = states.session_token
        INNER JOIN google_accounts accounts ON accounts.account_subject = sessions.account_subject
        WHERE states.state = $1 AND states.installation_id = $2 AND states.status = 'complete'
        LIMIT 1
      `,
      [state, installationId],
    );

    await this.pool.query(`DELETE FROM google_auth_states WHERE state = $1`, [state]);

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      account: {
        email: row.email,
        name: row.name ?? null,
        pictureUrl: row.picture_url ?? null,
        refreshToken: row.refresh_token,
        subject: row.account_subject,
      },
      installationId: row.installation_id,
      platform: row.platform as AppPlatform,
      sessionToken: row.session_token,
    };
  }

  async createPendingState(record: PendingStateRecord) {
    await this.ensureSchema();

    await this.pool.query(
      `
        INSERT INTO google_auth_states (state, installation_id, platform, redirect_uri, expires_at, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        ON CONFLICT (state) DO UPDATE
        SET installation_id = EXCLUDED.installation_id,
            platform = EXCLUDED.platform,
            redirect_uri = EXCLUDED.redirect_uri,
            expires_at = EXCLUDED.expires_at,
            status = 'pending',
            account_subject = NULL,
            session_token = NULL,
            completed_at = NULL
      `,
      [record.state, record.installationId, record.platform, record.redirectUri, record.expiresAt],
    );
  }

  async deleteSession(sessionToken: string) {
    await this.ensureSchema();
    await this.pool.query(`DELETE FROM google_drive_sessions WHERE session_token = $1`, [sessionToken]);
  }

  async finalizeState(input: {
    account: StoredGoogleAccount;
    sessionToken: string;
    state: string;
  }) {
    await this.ensureSchema();

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const pendingStateResult = await client.query(
        `
          SELECT installation_id, platform, redirect_uri, expires_at
          FROM google_auth_states
          WHERE state = $1 AND status = 'pending'
          LIMIT 1
        `,
        [input.state],
      );
      const pendingState = pendingStateResult.rows[0];

      if (!pendingState || Date.parse(pendingState.expires_at) <= Date.now()) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `
          INSERT INTO google_accounts (account_subject, email, name, picture_url, refresh_token)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (account_subject) DO UPDATE
          SET email = EXCLUDED.email,
              name = EXCLUDED.name,
              picture_url = EXCLUDED.picture_url,
              refresh_token = EXCLUDED.refresh_token,
              updated_at = now()
        `,
        [
          input.account.subject,
          input.account.email,
          input.account.name,
          input.account.pictureUrl,
          input.account.refreshToken,
        ],
      );

      await client.query(`DELETE FROM google_drive_sessions WHERE installation_id = $1`, [
        pendingState.installation_id,
      ]);

      await client.query(
        `
          INSERT INTO google_drive_sessions (session_token, installation_id, account_subject, platform)
          VALUES ($1, $2, $3, $4)
        `,
        [input.sessionToken, pendingState.installation_id, input.account.subject, pendingState.platform],
      );

      await client.query(
        `
          UPDATE google_auth_states
          SET account_subject = $2,
              completed_at = now(),
              session_token = $3,
              status = 'complete'
          WHERE state = $1
        `,
        [input.state, input.account.subject, input.sessionToken],
      );

      await client.query('COMMIT');
      return pendingState.redirect_uri as string;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAccount(subject: string) {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT account_subject, email, name, picture_url, refresh_token
        FROM google_accounts
        WHERE account_subject = $1
        LIMIT 1
      `,
      [subject],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      email: row.email,
      name: row.name ?? null,
      pictureUrl: row.picture_url ?? null,
      refreshToken: row.refresh_token,
      subject: row.account_subject,
    };
  }

  async getRedirectUriForState(state: string) {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT redirect_uri
        FROM google_auth_states
        WHERE state = $1
        LIMIT 1
      `,
      [state],
    );

    return (result.rows[0]?.redirect_uri as string | undefined) ?? null;
  }

  async getSession(sessionToken: string) {
    await this.ensureSchema();

    const result = await this.pool.query(
      `
        SELECT
          sessions.session_token,
          sessions.installation_id,
          sessions.platform,
          accounts.account_subject,
          accounts.email,
          accounts.name,
          accounts.picture_url,
          accounts.refresh_token
        FROM google_drive_sessions sessions
        INNER JOIN google_accounts accounts ON accounts.account_subject = sessions.account_subject
        WHERE sessions.session_token = $1
        LIMIT 1
      `,
      [sessionToken],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      account: {
        email: row.email,
        name: row.name ?? null,
        pictureUrl: row.picture_url ?? null,
        refreshToken: row.refresh_token,
        subject: row.account_subject,
      },
      installationId: row.installation_id,
      platform: row.platform as AppPlatform,
      sessionToken: row.session_token,
    };
  }
}

export function createGoogleDriveAuthStore(databaseUrl?: string): GoogleDriveAuthStore {
  if (!databaseUrl) {
    return new MemoryGoogleDriveAuthStore();
  }

  return new PostgresGoogleDriveAuthStore(databaseUrl);
}
