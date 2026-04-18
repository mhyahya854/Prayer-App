import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMissingWorkspaceMessage,
  selectPresentWorkspacePaths,
  selectTypecheckWorkspaceKeys,
} from './workspace-manifest.mjs';

test('typecheck ordering keeps required workspaces and skips absent mobile workspaces', () => {
  assert.deepEqual(
    selectTypecheckWorkspaceKeys({
      android: false,
      api: true,
      core: true,
      ios: false,
      web: true,
    }),
    ['core', 'web', 'api'],
  );

  assert.deepEqual(
    selectTypecheckWorkspaceKeys({
      android: true,
      api: true,
      core: true,
      ios: true,
      web: true,
    }),
    ['core', 'android', 'ios', 'web', 'api'],
  );
});

test('present workspace paths include only available workspace requirements', () => {
  assert.deepEqual(
    selectPresentWorkspacePaths(
      {
        android: false,
        ios: false,
        web: true,
      },
      {
        android: ['android/assets/sounds/athan.wav'],
        ios: ['ios/assets/sounds/athan.wav'],
        web: ['web/assets/sounds/athan.wav'],
      },
    ),
    ['web/assets/sounds/athan.wav'],
  );
});

test('missing workspace messages explain why mobile commands cannot run', () => {
  assert.equal(
    createMissingWorkspaceMessage('android', 'test'),
    'Workspace @prayer-app/android is not available in this branch because android/ is missing. Restore that workspace before running "test".',
  );
});
