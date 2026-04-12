# Release Status

Date: 2026-03-26

## Commands Run

- `npm audit --json`
- `npm install`
- `npm run pack:source`
- `npm run typecheck`
- `npm run test:core`
- `npm run test:api`
- `npm run test:android`
- `npm run test:ios`
- `npm run test:web`
- `npm run verify:fresh`

## Results

- `npm run typecheck`: PASS
- `npm run test:core`: PASS
- `npm run test:api`: PASS
- `npm run test:android`: PASS
- `npm run test:ios`: PASS
- `npm run test:web`: PASS
- `npm run verify:fresh`: PASS
- `npm run pack:source`: PASS

## Canonical Artifact

- `C:\Users\mhyah\OneDrive\Desktop\Coding\Prayer App\artifacts\prayer-app-source.zip`

## What Was Verified

- README and handoff documentation match the current app state, including notifications.
- Fresh install dependency audit is clean after the final lockfile update. The previous `fastify` moderate advisory and transitive `picomatch` high/moderate advisories no longer appear in `npm install` or `npm run verify:fresh`.
- The remaining fresh-install deprecation warnings were traced to exact dependency paths:
  - `inflight@1.0.6 <- glob@7.2.3 <- react-native@0.83.2`
  - `rimraf@3.0.2 <- chromium-edge-launcher@0.2.0 <- @react-native/dev-middleware@0.83.2`
  - `glob@10.5.0 <- archiver-utils@5.0.2 <- archiver@7.0.1`
- The deprecation-warning investigation found no safe minimal fix inside the current Expo 55 / React Native 0.83 line:
  - `react-native@0.83.4` still depends on `glob@^7.1.1`
  - `@react-native/dev-middleware@0.83.4` still depends on `chromium-edge-launcher@^0.2.0`
  - `chromium-edge-launcher@0.3.0` removes `rimraf`, but using it here would require an unsupported transitive framework override
  - `archiver@7.0.1` is already latest, so the `glob@10.5.0` warning is not removable with a normal package bump
- Mobile notification scheduling covers permission changes, toggle changes, pre-reminder changes, location changes, calculation-method changes, duplicate prevention, and midnight rollover.
- Web push sync, refresh, disable, and invalid API payload handling are covered by API tests.
- Prayer date and timezone handling now has explicit coverage for saved timezone mismatch, midnight boundaries, device-to-manual location switching, manual timezone override, and the next-prayer edge around Fajr/Isha.
- The clean source artifact installs and passes validation through `npm run verify:fresh`.

## Remaining Issues

- Real web push delivery still needs deployment-time values for `DATABASE_URL`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, and `EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY`.
- Production browser access still needs `ALLOWED_ORIGINS` set correctly on the API, or the web client cannot call notification sync endpoints under production CORS.
- Real browser/device notification smoke is still pending because this machine does not have the required deployment env values, device/emulator access, or browser automation available.
- Fresh install still emits non-blocking transitive deprecation warnings for `inflight`, `rimraf@3`, and older `glob` ranges even though the vulnerability count is now zero. These warnings are being accepted for this release line because removing them requires a broader Expo/React Native/tooling change.
- Final approved/licensed launch audio is still missing. The bundled `athan.wav` and `reminder.wav` remain starter placeholders, so the project is not yet polished public-launch-ready.
- Google auth, Calendar sync, Drive backup, and broader production operations work remain out of scope for this release-prep pass.

## Final Review Readiness

The project is ready for final review and engineering handoff.

That means the source artifact, validation path, and current feature/test surface are in a reviewable state.
It does not mean the app is 100% public-launch-ready. The project is still `99% public-launch-ready` because final approved/licensed launch audio is still pending and real production/device notification smoke has not been completed on this machine.
