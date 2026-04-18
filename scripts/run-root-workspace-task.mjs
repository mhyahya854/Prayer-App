import { spawn } from 'node:child_process';

import {
  createMissingWorkspaceMessage,
  resolveWorkspacePresence,
  selectTypecheckWorkspaceKeys,
  workspaceDefinitions,
} from './workspace-manifest.mjs';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function spawnCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : npmExecutable,
      process.platform === 'win32' ? ['/d', '/s', '/c', `${npmExecutable} ${args.join(' ')}`] : args,
      {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      },
    );

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${npmExecutable} ${args.join(' ')}`));
    });
  });
}

async function runWorkspaceScript(workspaceKey, scriptName) {
  const presence = await resolveWorkspacePresence([workspaceKey]);

  if (!presence[workspaceKey]) {
    throw new Error(createMissingWorkspaceMessage(workspaceKey, scriptName));
  }

  await spawnCommand(['run', scriptName, '--workspace', workspaceDefinitions[workspaceKey].packageName]);
}

async function runTypecheck() {
  const presence = await resolveWorkspacePresence();
  const workspaceKeys = selectTypecheckWorkspaceKeys(presence);

  await spawnCommand(['run', 'build', '--workspace', workspaceDefinitions.core.packageName]);

  for (const workspaceKey of workspaceKeys) {
    await spawnCommand(['run', 'typecheck', '--workspace', workspaceDefinitions[workspaceKey].packageName]);
  }
}

async function main(argv = process.argv.slice(2)) {
  const [command, workspaceKey, scriptName] = argv;

  try {
    if (command === 'typecheck') {
      await runTypecheck();
      return;
    }

    if (command === 'workspace-script' && workspaceKey && scriptName) {
      await runWorkspaceScript(workspaceKey, scriptName);
      return;
    }

    throw new Error('Usage: node scripts/run-root-workspace-task.mjs <typecheck|workspace-script> [...args]');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown workspace task failure.');
    process.exit(1);
  }
}

await main();
