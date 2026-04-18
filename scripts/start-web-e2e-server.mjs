import { spawn } from 'node:child_process';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const localHostApiUrl = 'http://localhost:4000';
const releaseApiUrl = 'https://api.prayer-app.example';

function createServerEnvironment(mode, port) {
  const baseEnv = {
    ...process.env,
    APP_STAGE: mode === 'development' ? 'development' : 'production',
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_API_URL: mode === 'development' ? '' : releaseApiUrl,
    EXPO_PUBLIC_APP_STAGE: mode === 'development' ? 'development' : 'production',
    EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY: 'test-web-push-public-key',
    PORT: String(port),
  };

  if (mode === 'development') {
    return {
      ...baseEnv,
      GOOGLE_REDIRECT_URI: `${localHostApiUrl}/api/google/callback`,
    };
  }

  return {
    ...baseEnv,
    GOOGLE_REDIRECT_URI: `${releaseApiUrl}/api/google/callback`,
  };
}

async function main(argv = process.argv.slice(2)) {
  const [mode = 'release', rawPort = '19106'] = argv;
  const resolvedMode = mode === 'development' ? 'development' : 'release';
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isFinite(port) || port <= 0) {
    console.error(`Invalid port "${rawPort}" passed to start-web-e2e-server.`);
    process.exit(1);
  }

  const webArgs = [
    'run',
    'web',
    '--workspace',
    '@prayer-app/web',
    '--',
    '--host',
    'localhost',
    '--port',
    String(port),
  ];
  const child = spawn(
    process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : npmExecutable,
    process.platform === 'win32' ? ['/d', '/s', '/c', `${npmExecutable} ${webArgs.join(' ')}`] : webArgs,
    {
      cwd: process.cwd(),
      env: createServerEnvironment(resolvedMode, port),
      stdio: 'inherit',
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error('Unable to start the Expo web server for Playwright.', error);
    process.exit(1);
  });
}

await main();
