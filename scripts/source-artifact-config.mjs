import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const workspaceRoot = path.join(__dirname, '..');
export const artifactsDir = path.join(workspaceRoot, 'artifacts');
export const sourceStageDirName = 'prayer-app-source';
export const sourceStageRoot = path.join(artifactsDir, 'source-stage');
export const sourceStageDir = path.join(sourceStageRoot, sourceStageDirName);
export const sourceArchivePath = path.join(artifactsDir, `${sourceStageDirName}.zip`);

export const cleanupPaths = [
  'artifacts',
  'coverage',
  'node_modules',
  'apps/api/node_modules',
  'apps/android/.expo',
  'apps/android/dist-web',
  'apps/android/node_modules',
  'apps/ios/.expo',
  'apps/ios/dist-web',
  'apps/ios/node_modules',
  'apps/web/.expo',
  'apps/web/dist-web',
  'apps/web/node_modules',
  'packages/core/dist',
];

export function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

export function shouldExcludeRelativePath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const segments = normalizedPath.split('/');
  const baseName = segments.at(-1) ?? '';

  if (!normalizedPath || normalizedPath === '.') {
    return false;
  }

  if (segments.includes('node_modules')) {
    return true;
  }

  if (segments.includes('.expo')) {
    return true;
  }

  if (segments.includes('coverage')) {
    return true;
  }

  if (segments[0] === 'artifacts') {
    return true;
  }

  if (normalizedPath === 'packages/core/dist' || normalizedPath.startsWith('packages/core/dist/')) {
    return true;
  }

  if (segments[0] === 'apps' && segments[2] === 'dist-web') {
    return true;
  }

  if (baseName.endsWith('.log') || baseName.endsWith('.tsbuildinfo')) {
    return true;
  }

  return false;
}
