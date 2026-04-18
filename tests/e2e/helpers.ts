import type { Page } from '@playwright/test';

const fixedNowIso = '2026-03-25T00:30:00.000Z';
const prayerStorageVersion = 3;
const notificationStorageVersion = 3;
const themeStorageVersion = 1;
const mojibakeFragments = [
  'Searching\u00e2\u20ac\u00a6',
  'Loading your history\u00e2\u20ac\u00a6',
  '\u00c2\u00b7',
  '\u00e2\u20ac\u201d',
  '\u00c2\u00b0',
];

interface SeedAppStateOptions {
  timeFormat?: '12h' | '24h';
}

export async function seedAppState(page: Page, options: SeedAppStateOptions = {}) {
  const timeFormat = options.timeFormat ?? '12h';

  await page.addInitScript(
    ({ fixedIsoTime, notificationVersion, prayerVersion, themeVersion, selectedTimeFormat }) => {
      if (window.sessionStorage.getItem('__prayer_e2e_seeded') === 'true') {
        return;
      }

      const fixedNow = new Date(fixedIsoTime);
      const RealDate = Date;

      class FixedDate extends RealDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) {
            super(fixedNow.getTime());
            return;
          }

          super(...args);
        }

        static now() {
          return fixedNow.getTime();
        }
      }

      Object.setPrototypeOf(FixedDate, RealDate);
      // @ts-expect-error test environment override
      globalThis.Date = FixedDate;

      // Force the unsupported path to keep Qibla deterministic in CI.
      // @ts-expect-error test environment override
      window.DeviceOrientationEvent = undefined;

      const makeVersionedValue = (value: unknown, updatedAt = fixedIsoTime) =>
        JSON.stringify({
          data: {
            updatedAt,
            value,
          },
          version: prayerVersion,
        });

      const makeNotificationValue = (value: unknown, updatedAt = fixedIsoTime) =>
        JSON.stringify({
          data: {
            updatedAt,
            value,
          },
          version: notificationVersion,
        });

      const makeThemeValue = (value: unknown, updatedAt = fixedIsoTime) =>
        JSON.stringify({
          data: {
            updatedAt,
            value,
          },
          version: themeVersion,
        });

      window.localStorage.clear();
      window.localStorage.setItem(
        'prayer-app.prayer-preferences',
        makeVersionedValue({
          adjustments: {
            asr: 0,
            dhuhr: 0,
            fajr: 0,
            isha: 0,
            maghrib: 0,
            sunrise: 0,
          },
          autoRefreshLocation: false,
          calculationMethod: 'singapore',
          calculationMode: 'manual',
          madhab: 'shafi',
          timeFormat: selectedTimeFormat,
        }),
      );
      window.localStorage.setItem(
        'prayer-app.prayer-logs',
        makeVersionedValue({
          '2026-03-25': {
            dateKey: '2026-03-25',
            prayers: {
              Asr: false,
              Dhuhr: true,
              Fajr: true,
              Isha: false,
              Maghrib: false,
            },
          },
        }),
      );
      window.localStorage.setItem(
        'prayer-app.saved-location',
        makeVersionedValue({
          coordinates: {
            latitude: 3.139,
            longitude: 101.6869,
          },
          label: 'Kuala Lumpur',
          source: 'manual',
          timeZone: 'Asia/Kuala_Lumpur',
          timeZoneSource: 'manual',
          updatedAt: fixedIsoTime,
        }),
      );
      window.localStorage.setItem(
        'prayer-app.notification-preferences',
        makeNotificationValue({
          enabledPrayers: {
            Asr: false,
            Dhuhr: false,
            Fajr: false,
            Isha: false,
            Maghrib: false,
            Sunrise: false,
          },
          preReminderMinutes: null,
        }),
      );
      window.localStorage.setItem(
        'prayer-app.notification-installation',
        makeNotificationValue('install_test_web'),
      );
      window.localStorage.setItem('prayer-app.theme-preference', makeThemeValue('light'));
      window.localStorage.setItem('prayer-app.theme-accent', makeThemeValue('default'));
      window.localStorage.removeItem('prayer-app.google-drive-session');
      window.sessionStorage.setItem('__prayer_e2e_seeded', 'true');
    },
    {
      fixedIsoTime: fixedNowIso,
      notificationVersion: notificationStorageVersion,
      prayerVersion: prayerStorageVersion,
      selectedTimeFormat: timeFormat,
      themeVersion: themeStorageVersion,
    },
  );
}

export async function expectNoMojibake(page: Page) {
  const bodyText = await page.locator('body').textContent();
  for (const fragment of mojibakeFragments) {
    if (bodyText?.includes(fragment)) {
      throw new Error(`Unexpected mojibake fragment rendered: ${fragment}`);
    }
  }
}

export async function getSwitchState(page: Page, testId: string) {
  const toggle = page.locator(`[data-testid="${testId}"]`);
  const ariaChecked = await toggle.getAttribute('aria-checked');
  return ariaChecked === 'true';
}

export async function getSwitchStateByIndex(page: Page, index: number) {
  const toggle = page.getByRole('switch').nth(index);
  const ariaChecked = await toggle.getAttribute('aria-checked');
  return ariaChecked === 'true';
}

export async function gotoWithReadyState(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
