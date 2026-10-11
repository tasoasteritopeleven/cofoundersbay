'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ensureSupportedNode } = require('./ensure-supported-node.cjs');
const { ensureStrictLocalPort } = require('./strict-local-port.cjs');

const rootDir = __dirname === '.' ? process.cwd() : path.resolve(__dirname, '..');
const schemaPath = path.join(rootDir, 'apps', 'api', 'prisma', 'schema.prisma');
const prismaStatePath = path.join(rootDir, 'apps', 'api', '.dev-prisma-state.json');
const generatedClientPath = path.join(rootDir, 'node_modules', '.prisma', 'client', 'index.js');
const isWindows = process.platform === 'win32';
const API_PORT = 3001;

ensureSupportedNode('workspace-dev');

function resolveNpmInvocation() {
  if (!isWindows) {
    return {
      command: 'npm',
      prefixArgs: [],
    };
  }

  const npmCliCandidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);

  for (const candidate of npmCliCandidates) {
    if (fs.existsSync(candidate)) {
      return {
        command: process.execPath,
        prefixArgs: [candidate],
      };
    }
  }

  throw new Error(
    [
      'Could not resolve npm CLI for Windows dev bootstrap.',
      'Expected `npm_execpath` or a local npm installation next to the active Node runtime.',
      `Node executable: ${process.execPath}`,
    ].join('\n'),
  );
}

const npmRunner = resolveNpmInvocation();

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const commandLine = `${command} ${args.join(' ')}`;
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        const error = new Error(`${commandLine} exited via signal ${signal}`);
        error.commandLine = commandLine;
        reject(error);
        return;
      }
      if (code !== 0) {
        const error = new Error(`${commandLine} exited with code ${code}`);
        error.commandLine = commandLine;
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function getSchemaState() {
  const schemaStat = fs.statSync(schemaPath);
  const saved = readJson(prismaStatePath);
  return {
    currentSchemaMtimeMs: schemaStat.mtimeMs,
    savedSchemaMtimeMs: saved?.schemaMtimeMs ?? null,
    clientExists: fs.existsSync(generatedClientPath),
  };
}

/** Build shared package without npm -w (breaks when root script delegates to turbo). */
async function buildSharedPackage() {
  const sharedDir = path.join(rootDir, 'packages', 'shared');
  const tscBin = require.resolve('typescript/bin/tsc', { paths: [sharedDir, rootDir] });
  console.log('Building @cofounderbay/shared...');
  await run(process.execPath, [tscBin, '-p', 'tsconfig.build.json'], { cwd: sharedDir });
}

/** Run an npm script inside a workspace package (cwd = package dir, no --prefix). */
function runPackageScript(relativeDir, script) {
  const pkgDir = path.join(rootDir, relativeDir);
  return run(npmRunner.command, [...npmRunner.prefixArgs, 'run', script], { cwd: pkgDir });
}

async function main() {
  const forceDb = process.argv.includes('--force-db');

  await ensureStrictLocalPort({
    port: API_PORT,
    host: '127.0.0.1',
    label: 'API dev server',
    origin: `http://localhost:${API_PORT}`,
  });

  await buildSharedPackage();

  const state = getSchemaState();
  const hasRecordedSchemaState = state.savedSchemaMtimeMs !== null;
  const schemaChanged =
    hasRecordedSchemaState && state.savedSchemaMtimeMs !== state.currentSchemaMtimeMs;
  const shouldGenerate = forceDb || schemaChanged || !state.clientExists;
  const shouldPush = forceDb || schemaChanged;

  if (shouldGenerate) {
    console.log('Running Prisma client generation...');
    await runPackageScript('apps/api', 'prisma:generate');
  } else {
    console.log('Skipping Prisma client generation; schema unchanged.');
  }

  if (shouldPush) {
    console.log('Running Prisma schema push...');
    await runPackageScript('apps/api', 'prisma:push');
  } else {
    console.log('Skipping Prisma schema push; schema unchanged.');
  }

  writeJson(prismaStatePath, {
    schemaMtimeMs: state.currentSchemaMtimeMs,
    updatedAt: new Date().toISOString(),
  });

  await runPackageScript('apps/api', 'start:dev');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);

  if (/prisma:generate/i.test(message)) {
    console.error(
      [
        'If the Prisma output above includes `EPERM` on `query_engine-windows.dll.node`, a running process is still locking the Prisma engine.',
        'Stop the existing API process on port 3001, then rerun `npm run dev:api`.',
        `PowerShell: netstat -ano | findstr :${API_PORT}`,
        '            taskkill /F /PID <PID>',
        'If you intentionally changed the schema and want to force regeneration after stopping the process, use `node scripts/dev-api.cjs --force-db`.',
      ].join('\n'),
    );
  }

  process.exit(1);
});
