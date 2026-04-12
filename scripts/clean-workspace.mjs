import { rm } from 'node:fs/promises';
import path from 'node:path';

import { cleanupPaths, workspaceRoot } from './source-artifact-config.mjs';

for (const relativePath of cleanupPaths) {
  const targetPath = path.join(workspaceRoot, relativePath);

  await rm(targetPath, {
    force: true,
    recursive: true,
  });
}

console.log(`Removed ${cleanupPaths.length} generated paths from ${workspaceRoot}.`);
