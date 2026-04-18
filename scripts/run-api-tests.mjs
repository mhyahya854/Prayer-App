import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const apiRoot = fileURLToPath(new URL('../api', import.meta.url));
const tsxCliPath = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));

const child = spawn(
  process.execPath,
  [
    tsxCliPath,
    '--test',
    'src/config.test.ts',
    'src/index.test.ts',
    'src/mosques/service.test.ts',
    'src/notifications/service.test.ts',
  ],
  {
    cwd: apiRoot,
    env: {
      ...process.env,
      APP_STAGE: 'development',
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Failed to run API tests from ${repoRoot}:`, error);
  process.exit(1);
});
