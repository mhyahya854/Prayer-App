import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import extract from 'extract-zip';

import { packSourceArchive } from './pack-source.mjs';
import { sourceStageDirName } from './source-artifact-config.mjs';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmCommand = process.env.npm_execpath ? process.execPath : npmExecutable;
const npmCommandPrefixArgs = process.env.npm_execpath ? [process.env.npm_execpath] : [];

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}.`));
    });
    child.on('error', reject);
  });
}

async function verifyFreshArchive() {
  const { sourceArchivePath } = await packSourceArchive();
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'prayer-app-source-proof-'));
  let shouldCleanup = true;

  try {
    await extract(sourceArchivePath, {
      dir: temporaryRoot,
    });

    const extractedWorkspaceRoot = path.join(temporaryRoot, sourceStageDirName);
    const commands = [
      ['ci'],
      ['run', 'typecheck'],
      ['run', 'test:core'],
      ['run', 'test:api'],
      ['run', 'test:android'],
      ['run', 'test:ios'],
      ['run', 'test:web'],
    ];

    for (const args of commands) {
      await runCommand(npmCommand, [...npmCommandPrefixArgs, ...args], extractedWorkspaceRoot);
    }

    return {
      extractedWorkspaceRoot,
      sourceArchivePath,
    };
  } catch (error) {
    shouldCleanup = false;
    console.error(`Fresh verification failed. Preserved extracted workspace at: ${temporaryRoot}`);
    throw error;
  } finally {
    if (shouldCleanup) {
      await rm(temporaryRoot, {
        force: true,
        recursive: true,
      });
    }
  }
}

async function main() {
  const result = await verifyFreshArchive();

  console.log(`Fresh verification passed from source archive: ${result.sourceArchivePath}`);
}

await main();
