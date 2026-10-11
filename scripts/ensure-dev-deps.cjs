'use strict';

/**
 * Ensures local infra (PostgreSQL, Redis) is reachable before starting the API.
 * If docker-compose.yml exists and Docker is available, starts postgres + redis.
 */

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const composeFile = path.join(rootDir, 'docker-compose.yml');

const SERVICES = [
  { port: 5432, label: 'PostgreSQL', composeService: 'postgres' },
  { port: 6379, label: 'Redis', composeService: 'redis' },
];

function canConnect(port, host = '127.0.0.1', timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function runDockerCompose(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '-f', composeFile, ...args], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function dockerAvailable() {
  return new Promise((resolve) => {
    const child = spawn('docker', ['info'], { stdio: 'ignore', shell: false });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function waitForPort(port, label, maxWaitMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    if (await canConnect(port)) return;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`${label} did not become reachable on port ${port} within ${maxWaitMs / 1000}s.`);
}

async function ensureDevDeps() {
  const missing = [];
  for (const svc of SERVICES) {
    if (!(await canConnect(svc.port))) missing.push(svc);
  }
  if (missing.length === 0) return;

  const names = missing.map((s) => s.label).join(', ');
  console.log(`[dev-deps] ${names} not reachable — attempting to start via Docker…`);

  if (!fs.existsSync(composeFile)) {
    throw new Error(
      [
        `Required services are down: ${names}.`,
        'Start PostgreSQL (port 5432) and Redis (port 6379), then run pnpm dev:stack again.',
        'Example: docker compose up -d postgres redis',
      ].join('\n'),
    );
  }

  if (!(await dockerAvailable())) {
    throw new Error(
      [
        `Required services are down: ${names}.`,
        'Docker is not running. Start Docker Desktop, then:',
        '  docker compose up -d postgres redis',
        'Or start PostgreSQL/Redis manually on localhost.',
      ].join('\n'),
    );
  }

  const toStart = [...new Set(missing.map((s) => s.composeService))];
  await runDockerCompose(['up', '-d', ...toStart]);

  for (const svc of missing) {
    console.log(`[dev-deps] Waiting for ${svc.label} on :${svc.port}…`);
    await waitForPort(svc.port, svc.label);
    console.log(`[dev-deps] ${svc.label} is ready.`);
  }
}

module.exports = { ensureDevDeps, canConnect };

if (require.main === module) {
  ensureDevDeps()
    .then(() => {
      console.log('[dev-deps] All dependencies ready.');
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
