'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ensureSupportedNode } = require('../../../scripts/ensure-supported-node.cjs');
const { ensureStrictLocalPort } = require('../../../scripts/strict-local-port.cjs');

const API_PORT = 3001;
const FRONTEND_ORIGIN = 'http://localhost:3000';

ensureSupportedNode(process.argv.includes('--debug') ? 'api-debug' : 'api-dev');

const apiDir = path.resolve(__dirname, '..');
const distDir = path.join(apiDir, 'dist');
const runtimeMetaPath = path.join(distDir, 'dev-runtime.json');
const tsBuildInfoPath = path.join(apiDir, 'tsconfig.build.tsbuildinfo');
const nestPackageJsonPath = require.resolve('@nestjs/core/package.json', { paths: [apiDir] });
const nestVersion = require(nestPackageJsonPath).version;
const tscBin = require.resolve('typescript/bin/tsc', { paths: [apiDir] });
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--clean');
const forceClean = process.argv.includes('--clean');
const debugEnabled = forwardedArgs.includes('--debug');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function runtimeChanged() {
  const existing = readJson(runtimeMetaPath);
  if (!existing) {
    return fs.existsSync(distDir) || fs.existsSync(tsBuildInfoPath);
  }

  return (
    existing.node !== process.version ||
    existing.nest !== nestVersion ||
    existing.platform !== process.platform
  );
}

if (forceClean || runtimeChanged()) {
  console.log('Cleaning stale API build output before starting API watch...');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.rmSync(tsBuildInfoPath, { force: true });
}

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  runtimeMetaPath,
  JSON.stringify(
    {
      node: process.version,
      nest: nestVersion,
      platform: process.platform,
    },
    null,
    2,
  ),
);

async function main() {
  await ensureStrictLocalPort({
    port: API_PORT,
    host: '127.0.0.1',
    label: 'API dev server',
    origin: `http://localhost:${API_PORT}`,
  });

  const sharedEnv = {
    ...process.env,
    PORT: String(API_PORT),
    FRONTEND_URL: FRONTEND_ORIGIN,
    WEB_BASE_URL: FRONTEND_ORIGIN,
    CORS_ORIGIN: FRONTEND_ORIGIN,
  };

  let serverProcess = null;
  let compilerOutputBuffer = '';
  let stoppingServer = false;
  let restartChain = Promise.resolve();
  let isShuttingDown = false;
  let crashRestartCount = 0;
  let lastCrashRestartAt = 0;
  const MAX_CRASH_RESTARTS = 5;
  const CRASH_RESTART_WINDOW_MS = 60_000; // Reset counter if >60s since last crash

  const entryCandidates = [
    path.join(distDir, 'main.js'),
    path.join(distDir, 'src', 'main.js'),
  ];

  function resolveEntryPath() {
    return entryCandidates.find((candidate) => fs.existsSync(candidate)) ?? entryCandidates[0];
  }

  function stopServer() {
    if (!serverProcess) {
      return Promise.resolve();
    }

    const child = serverProcess;
    serverProcess = null;
    stoppingServer = true;

    return new Promise((resolve) => {
      child.once('exit', () => {
        stoppingServer = false;
        resolve();
      });

      child.kill();

      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 2_000).unref();
    });
  }

  async function waitForEntryFile(timeoutMs = 5_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const entryPath = resolveEntryPath();
      if (fs.existsSync(entryPath)) {
        return entryPath;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('TypeScript watch reported success, but no compiled API entry file was emitted.');
  }

  async function restartServer() {
    const entryPath = await waitForEntryFile();
    await stopServer();

    if (isShuttingDown) {
      return;
    }

    const args = ['--enable-source-maps'];
    if (debugEnabled) {
      args.push('--inspect');
    }
    args.push(entryPath);

    serverProcess = spawn(process.execPath, args, {
      cwd: apiDir,
      env: sharedEnv,
      stdio: 'inherit',
    });

    serverProcess.on('exit', (code, signal) => {
      if (stoppingServer || isShuttingDown) {
        return;
      }

      if (signal) {
        // Intentional signal (e.g. SIGTERM from compiler restart) — no auto-restart needed.
        console.error(`API process exited via signal ${signal}`);
        return;
      }

      // Runtime crash — attempt automatic restart so the developer doesn't need to
      // manually restart the process after every unhandled exception.
      const now = Date.now();
      if (now - lastCrashRestartAt > CRASH_RESTART_WINDOW_MS) {
        crashRestartCount = 0; // Enough time has passed — reset the crash counter
      }
      lastCrashRestartAt = now;
      crashRestartCount += 1;

      if ((code ?? 0) !== 0) {
        console.error(`[dev] API process crashed with exit code ${code}.`);
      } else {
        console.warn(`[dev] API process exited unexpectedly with code 0.`);
      }

      if (crashRestartCount > MAX_CRASH_RESTARTS) {
        console.error(
          `[dev] API crashed ${crashRestartCount} times in ${CRASH_RESTART_WINDOW_MS / 1000}s — stopping auto-restart to avoid a loop.\n` +
          `      Fix the runtime error above and save a file to trigger a manual restart.`,
        );
        return;
      }

      const delayMs = Math.min(1_000 * crashRestartCount, 5_000); // 1s, 2s, 3s, 4s, 5s cap
      console.log(`[dev] Auto-restarting API in ${delayMs / 1000}s (attempt ${crashRestartCount}/${MAX_CRASH_RESTARTS})...`);
      setTimeout(() => {
        if (!isShuttingDown) {
          scheduleRestart();
        }
      }, delayMs);
    });

    serverProcess.on('error', (error) => {
      console.error(`Failed to start compiled API server: ${error.message}`);
    });
  }

  function scheduleRestart() {
    restartChain = restartChain
      .then(() => restartServer())
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
      });
  }

  function handleCompilerLine(line) {
    const match = line.match(/Found (\d+) errors?/);
    if (!match) {
      return;
    }

    if (match[1] === '0') {
      // Successful compile → intentional restart. Reset the runtime crash counter
      // so crash tracking is scoped to the current compiled binary only.
      crashRestartCount = 0;
      scheduleRestart();
      return;
    }

    console.log('TypeScript watcher found errors; keeping the current API process running.');
  }

  const compiler = spawn(process.execPath, [tscBin, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
    cwd: apiDir,
    env: sharedEnv,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const flushCompilerOutput = (chunk, target) => {
    const text = chunk.toString();
    target.write(text);
    compilerOutputBuffer += text;

    const lines = compilerOutputBuffer.split(/\r?\n/);
    compilerOutputBuffer = lines.pop() ?? '';
    for (const line of lines) {
      handleCompilerLine(line);
    }
  };

  compiler.stdout.on('data', (chunk) => flushCompilerOutput(chunk, process.stdout));
  compiler.stderr.on('data', (chunk) => flushCompilerOutput(chunk, process.stderr));

  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    compiler.kill(signal);
    await stopServer();
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
  });

  compiler.on('exit', async (code, signal) => {
    await stopServer();

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  compiler.on('error', (error) => {
    console.error(`Failed to start TypeScript watch compiler: ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
