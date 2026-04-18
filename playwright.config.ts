import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ./scripts/start-web-e2e-server.mjs release 19106',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      url: 'http://localhost:19106',
    },
    {
      command: 'node ./scripts/start-web-e2e-server.mjs development 19107',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      url: 'http://localhost:19107',
    },
  ],
  projects: [
    {
      name: 'release-web',
      testMatch: /release\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:19106',
        timezoneId: 'America/New_York',
      },
    },
    {
      name: 'dev-web',
      testMatch: /dev\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:19107',
        timezoneId: 'America/New_York',
      },
    },
  ],
});
