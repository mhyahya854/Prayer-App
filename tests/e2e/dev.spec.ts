import { expect, test } from '@playwright/test';

import { gotoWithReadyState, seedAppState } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedAppState(page, { timeFormat: '12h' });
});

test('diagnostics is available in true local development only', async ({ page }) => {
  await page.route('http://localhost:4000/health', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        service: 'prayer-app-api',
        status: 'ok',
      }),
    });
  });

  await page.route('http://localhost:4000/api/runtime', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        authFlowImplemented: true,
        calendarSyncImplemented: false,
        driveBackupImplemented: true,
        googleServerCredentialsConfigured: true,
        notificationWorkerEnabled: false,
        stage: 'development',
      }),
    });
  });

  await gotoWithReadyState(page, '/diagnostics');

  await expect(page.getByText('Developer Diagnostics').first()).toBeVisible();
  await expect(page.getByText('API health').first()).toBeVisible();
  await expect(page.getByText('present').first()).toBeVisible();
  await expect(page.getByText('live').first()).toBeVisible();
});
