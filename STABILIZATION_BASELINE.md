# Stabilization Baseline

- Date: 2026-04-20

## Typecheck
- Root typecheck: failed (see details below)
- Failure location: `@prayer-app/api` — `src/content/service.ts` imports non-existent `DuaBookshelfResponse` from `@prayer-app/core`.

## Lint
- Not run in this session.

## Unit tests
- API: 26 passed / 0 failed (ran `npm run test:api`).
- Core: not run in this session (existing CI covers core tests).
- Web/mobile: not run in this session.

## E2E tests
- Playwright E2E not executed in this session.

## Bundle sizes
- Not captured in this session.

## Known high-risk areas (quick scan)
- Google Drive sync: potential for blind overwrites — implemented snapshot-before-upsert guard.
- Sessions: no TTL in original store — implemented TTL enforcement and tests.
- Notifications: no limits on queued jobs or payload size — implemented caps in store.
- Content pipeline: no sanitization step — added basic sanitization to `scripts/build_hadith_bundle.py`.

## Immediate actions taken (Phase 0)
- Added `Fastify` `bodyLimit` (1 MiB) in `api/src/index.ts`.
- Enforced session TTL checks in `api/src/google-drive/store.ts` (memory+postgres).
- Snapshot existing Drive backup before upsert in `api/src/google-drive/service.ts` (copy file in Drive).
- Added notification pending-jobs and payload-size caps in `api/src/notifications/store.ts`.
- Sanitized hadith bundle fields in `scripts/build_hadith_bundle.py`.
- Added lightweight `npm audit` step to CI (`.github/workflows/ci.yml`).
- Added tests: `api/src/google-drive/guardrails.test.ts` covering TTL and snapshot-failure behavior.

## Next recommended steps
1. Fix `@prayer-app/api` type error: remove or replace `DuaBookshelfResponse` import in `src/content/service.ts`.
2. Create audit branches (`audit/api-hardening`, `audit/core-hardening`, `audit/web-hardening`).
3. Implement secure client token storage migration plan for mobile (use secure store / Keychain).
4. Add CI gates to fail on high-severity `npm audit` results and enable Dependabot.
5. Expand unit tests around core prayer calculation edge cases (DST/polar).

