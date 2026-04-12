# Final Handoff

Date: 2026-03-26

Legacy note: this document was written before the app split. Old `apps/mobile/...` path references now map to the independent `apps/android`, `apps/ios`, and `apps/web` workspaces.

## Canonical Artifact

- `C:\Users\mhyah\OneDrive\Desktop\Coding\Prayer App\artifacts\prayer-app-source.zip`

## Latest Validation

- `npm run typecheck`: PASS
- `npm run test:core`: PASS
- `npm run test:api`: PASS
- `npm run test:android`: PASS
- `npm run test:ios`: PASS
- `npm run test:web`: PASS
- `npm run verify:fresh`: PASS
- `npm run pack:source`: PASS
- `npm run verify:fresh` currently shows deprecation warnings from older transitive packages, but the install ends with `found 0 vulnerabilities`.

Latest dependency remediation:

- Fixed the previous `fastify` moderate advisory (`GHSA-444r-cwp2-x5xf`) by updating the API dependency to `fastify@^5.8.4`.
- Fixed the previous vulnerable transitive `picomatch` paths (`GHSA-c2c7-rcm5-vvqj`, `GHSA-3v7f-55p6-f55p`) with targeted root overrides to `2.3.2`.
- `npm install` and `npm run verify:fresh` now report `0 vulnerabilities`.

## Dependency Warning Disposition

Remaining fresh-install deprecation warnings come from these exact transitive paths:

- `inflight@1.0.6 <- glob@7.2.3 <- react-native@0.83.2`
- `rimraf@3.0.2 <- chromium-edge-launcher@0.2.0 <- @react-native/dev-middleware@0.83.2 <- Expo CLI`
- `glob@10.5.0 <- archiver-utils@5.0.2 <- archiver@7.0.1`

Why they are being accepted in this release:

- `react-native@0.83.4` still depends on `glob@^7.1.1`
- `@react-native/dev-middleware@0.83.4` still depends on `chromium-edge-launcher@^0.2.0`
- `chromium-edge-launcher@0.3.0` drops `rimraf`, but forcing it here would require an unsupported transitive override across the framework toolchain
- `archiver@7.0.1` is already latest, so the `glob@10.5.0` warning is not removable by a normal package bump

Disposition:

- Accepted as install-time, non-runtime deprecation noise for the current supported framework/tooling line
- Not accepted as a security issue, because the current audit result is still `0 vulnerabilities`
- Removal deferred to a future Expo/React Native stack upgrade or a packaging-tool replacement

## Notification Deployment Checklist

| Variable | App | Used In | Required For | If Missing |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | API | `apps/api/src/config.ts`, `apps/api/src/notifications/store.ts` | Durable web push subscriptions, installation profiles, and queued jobs | API falls back to in-memory notification storage; subscriptions/jobs are lost on restart and are not multi-instance safe |
| `WEB_PUSH_PUBLIC_KEY` | API | `apps/api/src/config.ts`, `apps/api/src/notifications/service.ts` | Server-side VAPID identity for web push | Web push sender is not fully configured; server will not deliver browser push jobs |
| `WEB_PUSH_PRIVATE_KEY` | API | `apps/api/src/config.ts`, `apps/api/src/notifications/service.ts` | Server-side VAPID signing for web push | Web push sender is not fully configured; queued jobs cannot be delivered |
| `WEB_PUSH_SUBJECT` | API | `apps/api/src/config.ts`, `apps/api/src/notifications/service.ts` | Production contact identity for VAPID | API falls back to a local placeholder address; not suitable for real production delivery/contact metadata |
| `EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY` | Web app | `apps/mobile/src/config/app-config.ts`, `apps/mobile/src/notifications/notification-provider.tsx` | Browser push subscription creation | Web notification enablement throws before subscription sync; web push cannot be turned on |
| `ALLOWED_ORIGINS` | API | `apps/api/src/config.ts`, `apps/api/src/index.ts` | Production browser access to `/api/runtime` and `/api/notifications/web/*` | Browser requests are blocked by production CORS; web push sync/refresh/disable fails |

Notes:

- `EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY` must match the API `WEB_PUSH_PUBLIC_KEY`.
- Do not hardcode secrets in code or commit filled `.env` files.
- These six values are the notification-specific production requirement set for the current build.
- Google OAuth variables remain separate and are not required for the notification stack.

## Notification Release Behavior

- Permission denied before scheduling: native and web scheduling both resolve to zero jobs; existing native schedules are cleared, and existing web subscriptions are disabled/removed when applicable.
- Permission revoked after schedules exist: the app re-checks permission on foreground, clears existing local schedules, and disables web push sync until permission is granted again.
- Permission re-enabled: requesting permission restores the granted state, reuses or recreates the required platform subscription/channel setup, and reschedules from current preferences/location.
- Location, timezone, prayer method, prayer toggles, and pre-reminder changes: these all change the notification sync signature, which triggers a full reschedule.
- Duplicate prevention: native scheduling clears existing pending notifications before replacing the rolling window, and web jobs use installation-scoped dedupe keys and replace pending jobs atomically.
- Near midnight and after day rollover: the app checks the effective prayer day once per minute using the saved location timezone and rebuilds the rolling window when the date key changes.
- Web push refresh/disable: refresh reuses the stored browser subscription and regenerates pending jobs; disable removes the server-side subscription state and clears pending jobs.
- Silent mode and browser/background audio limits remain OS/browser controlled; the app does not claim silent-mode override or background custom athan playback on web push.

## Smoke-Test Checklist

Environment probe on this machine:

- `DATABASE_URL`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, `EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY`, and `ALLOWED_ORIGINS`: all missing from the live environment
- `adb`: missing
- Android emulator CLI: missing
- Browser CLI automation: missing

Smoke status:

| Scenario | Status | Evidence |
| --- | --- | --- |
| Mobile notification permission denied | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` covers denied permission producing zero jobs |
| Mobile notification permission allowed | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` covers granted scheduling windows and native request generation |
| Mobile notification permission revoked | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` covers clearing existing schedules after revocation |
| Mobile notification permission re-enabled | Blocked on device | Provider logic resyncs on permission changes, but no usable device/emulator is available on this machine |
| Web push enable | Verified by automated test | `apps/api/src/index.test.ts` and `apps/api/src/notifications/service.test.ts` cover sync and stored-job behavior |
| Web push disable | Verified by automated test | `apps/api/src/notifications/service.test.ts` covers pending-job clearing after disable |
| Web push refresh | Verified by automated test | `apps/api/src/notifications/service.test.ts` covers refresh preserving subscription and re-enqueueing jobs |
| Location change | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` covers regenerated schedules for a new city/timezone |
| Timezone change | Verified by automated test | `packages/core/src/prayer.test.ts` covers saved-timezone mismatch and manual timezone override behavior |
| Prayer method change | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` covers schedule regeneration on calculation-method change |
| Reminder toggle and pre-reminder change | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` covers per-prayer toggles and pre-reminder expansion |
| Near-midnight rollover | Verified by automated test | `apps/mobile/src/notifications/mobile-scheduler.test.ts` and `packages/core/src/prayer.test.ts` cover day rollover behavior |
| Next-prayer update after day rollover | Verified by automated test | `packages/core/src/prayer.test.ts` covers next-prayer rollover after Isha and before Fajr using saved-location day logic |
| Saved manual location flow | Verified by code inspection | `apps/mobile/src/prayer/prayer-provider.tsx` validates manual coordinates, optional manual timezone override, and geo-derived timezone fallback; no UI-level automated test exists yet |
| Device-location fallback behavior | Verified by code inspection | `apps/mobile/src/prayer/prayer-provider.tsx` stores `device-fallback` when geo timezone lookup fails and persists the resulting saved location; no device-level automated test exists yet |
| Local manual browser/device smoke | Blocked on environment | Required env values, browser automation, and device/emulator access are unavailable on this machine |

## Known Non-Blocking Issues

- Fresh install still emits transitive deprecation warnings for `inflight`, `rimraf@3`, and older `glob` ranges. These did not fail validation and did not reintroduce security findings, but they remain accepted technical debt in this framework line.
- Real production web push still depends on valid deployment-time VAPID keys, database connectivity, and production CORS origins.
- Google sign-in, Calendar sync, and Drive backup are still outside this handoff scope.

## Recommendation

Still `99% public-launch-ready`, not `100%`.

This project is in a clean final-review and engineering-handoff state: the canonical source artifact is defined, validation passes, and the notification stack is implemented and sanity-checked.

It is not at a true 100% public-launch-ready bar yet for exactly two reasons:

- the launch-standard audio requirement is a licensed recorded athan plus a licensed reminder tone, and those approved assets are not yet available in the repo
- real production/browser/device notification smoke has not been completed on this machine because the required deployment values and device/browser tooling are not available here
