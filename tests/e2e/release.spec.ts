import { expect, test } from '@playwright/test';

import { expectNoMojibake, gotoWithReadyState, seedAppState } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedAppState(page, { timeFormat: '12h' });
});

test('home uses the saved prayer timezone instead of the browser timezone', async ({ page }) => {
  await gotoWithReadyState(page, '/');

  await expect(page.getByText('Assalam o Alykum, Welcome back').first()).toBeVisible();
  await expect(page.getByText('March 25, 2026').first()).toBeVisible();
  await expect(page.getByText('AM now').first()).toBeVisible();
});

test('settings time-format changes persist across reload', async ({ page }) => {
  await gotoWithReadyState(page, '/settings');

  await expect(page.getByText('Settings').first()).toBeVisible();
  await page.getByRole('switch', { name: 'Toggle 12-hour time' }).click();
  await page.waitForFunction(() => {
    const rawValue = window.localStorage.getItem('prayer-app.prayer-preferences');
    return typeof rawValue === 'string' && rawValue.includes('"timeFormat":"24h"');
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const rawValue = window.localStorage.getItem('prayer-app.prayer-preferences');
    return typeof rawValue === 'string' && rawValue.includes('"timeFormat":"24h"');
  });

  await gotoWithReadyState(page, '/');
  await expect(page.getByText('local time')).toBeVisible();
  await expect(page.getByText('AM now')).toHaveCount(0);
});

test('core routes render without mojibake', async ({ page }) => {
  test.setTimeout(120_000);
  const routes = [
    { path: '/quran', heading: 'Quran' },
    { path: '/hadith', heading: 'Hadith' },
    { path: '/progress', heading: 'Progress' },
    { path: '/qibla', heading: 'Qibla Finder' },
  ];

  for (const route of routes) {
    await gotoWithReadyState(page, route.path);
    await expect(page.getByText(route.heading).first()).toBeVisible();
    await expectNoMojibake(page);
  }
});

test('diagnostics is blocked outside true local development', async ({ page }) => {
  await gotoWithReadyState(page, '/diagnostics');

  await expect(page.getByText('Developer Diagnostics')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('mosque finder uses the app API and handles success, degraded, and unavailable states', async ({ page }) => {
  let requestCount = 0;
  let mosqueMode: 'degraded' | 'success' | 'unavailable' = 'success';
  const unexpectedThirdPartyRequests: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('maps.googleapis.com') || url.includes('overpass-api.de')) {
      unexpectedThirdPartyRequests.push(url);
    }
  });

  await page.route('https://api.prayer-app.example/api/mosques/nearby**', async (route) => {
    requestCount += 1;

    if (mosqueMode === 'success') {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          providerStatus: {
            google: 'ok',
            osm: 'ok',
          },
          results: [
            {
              address: 'Jalan Ampang, Kuala Lumpur',
              distanceKm: 1.4,
              id: 'mosque-1',
              latitude: 3.1579,
              longitude: 101.7117,
              name: 'Masjid As-Syakirin',
              source: 'google',
            },
          ],
        }),
      });
      return;
    }

    if (mosqueMode === 'degraded') {
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          providerStatus: {
            google: 'error',
            osm: 'ok',
          },
          results: [
            {
              address: 'Bukit Bintang, Kuala Lumpur',
              distanceKm: 2.1,
              id: 'mosque-2',
              latitude: 3.1456,
              longitude: 101.7133,
              name: 'Masjid Al-Bukhary',
              source: 'osm',
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      status: 502,
      body: JSON.stringify({
        error: {
          code: 'mosque_search_unavailable',
          message: 'Mosque search is temporarily unavailable. Please try again shortly.',
        },
      }),
    });
  });

  await gotoWithReadyState(page, '/mosques');
  await page.locator('[data-testid="find-mosques-button"]').click();
  await expect(page.getByText('Masjid As-Syakirin')).toBeVisible();
  await expect(page.getByText('Google Places')).toBeVisible();

  mosqueMode = 'degraded';
  await page.locator('[data-testid="find-mosques-button"]').click();
  await expect(page.getByText('Masjid Al-Bukhary')).toBeVisible();
  await expect(
    page.getByText('Google Places are temporarily unavailable. Showing partial results.'),
  ).toBeVisible();

  mosqueMode = 'unavailable';
  await page.locator('[data-testid="find-mosques-button"]').click();
  await expect(
    page.getByText('Mosque search is temporarily unavailable. Please try again shortly.'),
  ).toBeVisible();

  expect(requestCount).toBeGreaterThanOrEqual(3);
  expect(unexpectedThirdPartyRequests).toEqual([]);
});

test('qibla falls back safely when compass support is unavailable', async ({ page }) => {
  await gotoWithReadyState(page, '/qibla');

  await expect(
    page.getByText('Compass heading is not supported on this browser/device.'),
  ).toBeVisible();
  await expect(page.getByText('Qibla bearing:')).toBeVisible();
});
