import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = path.join(__dirname, '..');

export const workspaceDefinitions = {
  android: {
    dir: 'android',
    packageName: '@prayer-app/android',
  },
  api: {
    dir: 'api',
    packageName: '@prayer-app/api',
  },
  core: {
    dir: 'packages/core',
    packageName: '@prayer-app/core',
  },
  ios: {
    dir: 'ios',
    packageName: '@prayer-app/ios',
  },
  web: {
    dir: 'web',
    packageName: '@prayer-app/web',
  },
};

export const defaultTypecheckWorkspaceOrder = ['core', 'android', 'ios', 'web', 'api'];

export function selectTypecheckWorkspaceKeys(presenceByKey) {
  return defaultTypecheckWorkspaceOrder.filter((key) => key === 'core' || key === 'web' || key === 'api' || presenceByKey[key]);
}

export function selectPresentWorkspacePaths(presenceByKey, groupedPaths) {
  return Object.entries(groupedPaths).flatMap(([workspaceKey, paths]) =>
    presenceByKey[workspaceKey] ? paths : [],
  );
}

export function createMissingWorkspaceMessage(workspaceKey, scriptName) {
  const workspace = workspaceDefinitions[workspaceKey];

  if (!workspace) {
    throw new Error(`Unknown workspace key "${workspaceKey}".`);
  }

  return `Workspace ${workspace.packageName} is not available in this branch because ${workspace.dir}/ is missing. Restore that workspace before running "${scriptName}".`;
}

export async function workspaceExists(workspaceKey) {
  const workspace = workspaceDefinitions[workspaceKey];

  if (!workspace) {
    throw new Error(`Unknown workspace key "${workspaceKey}".`);
  }

  try {
    await access(path.join(workspaceRoot, workspace.dir, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

export async function resolveWorkspacePresence(workspaceKeys = Object.keys(workspaceDefinitions)) {
  const entries = await Promise.all(
    workspaceKeys.map(async (workspaceKey) => [workspaceKey, await workspaceExists(workspaceKey)]),
  );

  return Object.fromEntries(entries);
}
