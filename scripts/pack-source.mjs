import { createWriteStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import archiver from 'archiver';

import {
  artifactsDir,
  shouldExcludeRelativePath,
  sourceArchivePath,
  sourceStageDir,
  sourceStageDirName,
  workspaceRoot,
} from './source-artifact-config.mjs';

async function copyWorkspaceEntry(sourcePath, destinationPath) {
  const stats = await lstat(sourcePath);

  if (stats.isSymbolicLink()) {
    throw new Error(`Source artifact packaging does not support symbolic links: ${sourcePath}`);
  }

  if (stats.isDirectory()) {
    await mkdir(destinationPath, { recursive: true });
    const entries = await readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      const sourceEntryPath = path.join(sourcePath, entry.name);
      const relativeEntryPath = path.relative(workspaceRoot, sourceEntryPath);

      if (shouldExcludeRelativePath(relativeEntryPath)) {
        continue;
      }

      await copyWorkspaceEntry(sourceEntryPath, path.join(destinationPath, entry.name));
    }

    return;
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

async function stageWorkspaceSource() {
  await rm(sourceStageDir, {
    force: true,
    recursive: true,
  });
  await mkdir(sourceStageDir, { recursive: true });

  const rootEntries = await readdir(workspaceRoot, { withFileTypes: true });

  for (const entry of rootEntries) {
    const sourceEntryPath = path.join(workspaceRoot, entry.name);
    const relativeEntryPath = path.relative(workspaceRoot, sourceEntryPath);

    if (shouldExcludeRelativePath(relativeEntryPath)) {
      continue;
    }

    await copyWorkspaceEntry(sourceEntryPath, path.join(sourceStageDir, entry.name));
  }
}

async function collectExcludedMatches(directoryPath) {
  const matches = [];
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    const relativePath = path.relative(sourceStageDir, fullPath);

    if (shouldExcludeRelativePath(relativePath)) {
      matches.push(relativePath);
      continue;
    }

    if (entry.isDirectory()) {
      matches.push(...(await collectExcludedMatches(fullPath)));
    }
  }

  return matches;
}

async function assertStageIsSourceOnly() {
  const forbiddenPaths = await collectExcludedMatches(sourceStageDir);

  if (forbiddenPaths.length > 0) {
    throw new Error(
      `Source stage still contains excluded paths:\n${forbiddenPaths.map((entry) => `- ${entry}`).join('\n')}`,
    );
  }
}

async function createArchive() {
  await rm(sourceArchivePath, {
    force: true,
  });
  await mkdir(artifactsDir, { recursive: true });

  const output = createWriteStream(sourceArchivePath);
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const completion = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);
  archive.directory(sourceStageDir, sourceStageDirName);
  await archive.finalize();
  await completion;
}

export async function packSourceArchive() {
  await stageWorkspaceSource();
  await assertStageIsSourceOnly();
  await createArchive();

  return {
    sourceArchivePath,
    sourceStageDir,
  };
}

async function main() {
  const { sourceArchivePath: archivePath, sourceStageDir: stagePath } = await packSourceArchive();

  console.log(`Packed source-only archive: ${archivePath}`);
  console.log(`Staged clean source tree: ${stagePath}`);
}

const entryFile = process.argv[1];
const isMain = entryFile ? import.meta.url === pathToFileURL(entryFile).href : false;

if (isMain) {
  await main();
}
