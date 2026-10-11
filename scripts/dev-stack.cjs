'use strict';

/**
 * Starts API (3001) then web (3000) for local full-stack development.
 * Run: pnpm dev:stack
 *
 * If API is already running on :3001 (e.g. leftover terminal), reuses it instead
 * of spawning a second instance that would fail on EADDRINUSE.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { ensureSupportedNode } = require('./ensure-supported-node.cjs');
const { isPortInUse } = require('./strict-local-port.cjs');
const { ensureDevDeps } = require('./ensure-dev-deps.cjs');

const rootDir = path.resolve(__dirname, '..');
const API_PORT = 3001;
const WEB_PORT = 3000;
const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/health/liveness`;
const WAIT_TIMEOUT_MS = 120_000;
const POLL_MS = 750;

ensureSupportedNode('workspace-dev');

function probeApiHealth() {
  return new Promise((resolve) => {
    const req = http.get(API_HEALTH_URL, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForApi() {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      void probeApiHealth().then((healthy) => {
        if (healthy) {
          resolve();
          return;
        }
        schedule();
      });
    };

    const schedule = () => {
      if (Date.now() - started > WAIT_TIMEOUT_MS) {
        reject(
          new Error(
            [
              'API did not become ready in time.',
              `Expected ${API_HEALTH_URL} to respond.`,
              '',
              'Common causes:',
              '  • PostgreSQL not running (Prisma P1001 on localhost:5432)',
              '  • Redis not running (port 6379)',
              '',
              'Fix:',
              '  docker compose up -d postgres redis',
              '  pnpm dev:stack',
              '',
              'Or run: pnpm dev:deps',
            ].join('\n'),
          ),
        );
        return;
      }
      setTimeout(attempt, POLL_MS);
    };

    attempt();
  });
}

function spawnLogged(label, command, args, options = {}) {
  console.log(`[dev-stack] Starting ${label}…`);
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  child.on('error', (error) => {
    console.error(`[dev-stack] Failed to start ${label}: ${error.message}`);
    process.exit(1);
  });

  return child;
}

async function resolveApiStartup() {
  const portBusy = await isPortInUse(API_PORT);

  if (portBusy) {
    const healthy = await probeApiHealth();
    if (healthy) {
      console.log(
        `[dev-stack] Port ${API_PORT} is in use and health check passed — reusing existing API.`,
      );
      console.log(
        '[dev-stack] Tip: stop the other API terminal with Ctrl+C if you need a fresh API process.',
      );
      return { api: null, managed: false };
    }

    throw new Error(
      [
        `Port ${API_PORT} is already in use but ${API_HEALTH_URL} is not healthy.`,
        'Kill the stale process, then run pnpm dev:stack again:',
        `  PowerShell:  netstat -ano | findstr :${API_PORT}`,
        '               taskkill /F /PID <PID>',
      ].join('\n'),
    );
  }

  const api = spawnLogged('API', process.execPath, [path.join(rootDir, 'scripts', 'dev-api.cjs')]);
  console.log('[dev-stack] Waiting for API health…');
  await waitForApi();
  console.log('[dev-stack] API is ready.');
  return { api, managed: true };
}

async function main() {
  console.log(`[dev-stack] CoFounderBay full stack (API :${API_PORT} + Web :${WEB_PORT})`);
  console.log('[dev-stack] Tip: use a single terminal — Ctrl+C stops managed processes.');

  try {
    await ensureDevDeps();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  let api;
  let apiManaged = false;

  try {
    ({ api, managed: apiManaged } = await resolveApiStartup());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const webPortBusy = await isPortInUse(WEB_PORT);
  if (webPortBusy) {
    console.error(
      [
        `[dev-stack] Port ${WEB_PORT} is already in use (another Next.js dev server?).`,
        'Stop it with Ctrl+C in that terminal, or:',
        `  PowerShell:  netstat -ano | findstr :${WEB_PORT}`,
        '               taskkill /F /PID <PID>',
      ].join('\n'),
    );
    if (apiManaged && api) api.kill('SIGTERM');
    process.exit(1);
  }

  const web = spawnLogged('Web', process.execPath, [path.join(rootDir, 'apps', 'web', 'scripts', 'dev.js')], {
    env: {
      ...process.env,
      CFB_DEV_STACK: '1',
    },
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[dev-stack] Shutting down (${signal})…`);
    web.kill(signal);
    if (apiManaged && api) {
      api.kill(signal);
    } else {
      console.log('[dev-stack] Left existing API on :3001 running (not started by dev-stack).');
    }
    setTimeout(() => process.exit(0), 1_500).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  web.on('exit', (code) => {
    if (!shuttingDown) {
      shuttingDown = true;
      if (apiManaged && api) api.kill('SIGTERM');
      process.exit(code ?? 0);
    }
  });

  if (apiManaged && api) {
    api.on('exit', (code) => {
      if (!shuttingDown) {
        shuttingDown = true;
        console.error(`[dev-stack] API exited (${code ?? 'signal'}). Stopping web.`);
        web.kill('SIGTERM');
        process.exit(code ?? 1);
      }
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
