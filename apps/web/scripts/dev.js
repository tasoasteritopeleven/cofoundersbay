'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ensureSupportedNode } = require('../../../scripts/ensure-supported-node.cjs');
const { ensureStrictLocalPort } = require('../../../scripts/strict-local-port.cjs');

// Node 17+ returns DNS results in resolver order rather than IPv4-first, so on
// Windows `localhost` resolves to ::1 before 127.0.0.1. Nothing in this stack
// listens on ::1, so every such connection stalls until it falls back to IPv4 —
// measured at ~210ms per request against ~1ms for a direct IPv4 connect. The
// dev proxy makes one upstream call per API request, so that tax lands on every
// data fetch the app performs.
require('node:dns').setDefaultResultOrder('ipv4first');

const WEB_PORT = 3000;
// Bind dual-stack, not 127.0.0.1 only.
//
// setDefaultResultOrder above fixes the ::1 stall for connections *this process*
// makes. It cannot fix the browser, which resolves `localhost` itself and still
// tries ::1 first. While nothing listened there, every request from the browser
// paid the fallback: measured on this machine at connect 202ms vs 1ms, and
// 666ms vs 442ms end to end for the same document. App Router fetches an RSC
// payload per navigation, so that was ~200ms added to every page transition.
//
// Listening on '::' accepts both ::1 and 127.0.0.1 (Node leaves ipv6Only off),
// so the first address the browser tries now answers immediately. The advertised
// origin stays `localhost` — see WEB_ORIGIN_HOST — so cookie scope and OAuth
// redirect URIs are untouched.
const WEB_HOST = '::';
// A host without IPv6 (many Linux containers and CI runners) refuses '::' with
// EAFNOSUPPORT and the server never starts. Probe once and fall back to the
// IPv4 wildcard there; where IPv6 exists nothing changes.
const IPV4_WILDCARD = '0.0.0.0';
// Advertised origin: stays `localhost` because OAuth providers whitelist it and
// cookies are scoped to it. Only the proxy's upstream target changes below.
const WEB_ORIGIN_HOST = 'localhost';
// Proxy upstream. The API binds 127.0.0.1 only, so naming it explicitly skips
// the ::1 attempt entirely instead of relying on the fallback.
const API_ORIGIN = 'http://127.0.0.1:3001';

ensureSupportedNode('web-dev');

const webDir = path.resolve(__dirname, '..');
const nextDir = path.join(webDir, '.next');
const runtimeMetaPath = path.join(nextDir, 'dev-runtime.json');
const nextPackageJsonPath = require.resolve('next/package.json', { paths: [webDir] });
const nextVersion = require(nextPackageJsonPath).version;
const forceClean = process.argv.includes('--clean');

function stripStrictDevArgs(args) {
  const stripped = [];
  const ignored = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--clean') {
      continue;
    }

    if (arg === '-p' || arg === '--port' || arg === '-H' || arg === '--hostname') {
      ignored.push(arg, args[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=') || arg.startsWith('--hostname=')) {
      ignored.push(arg);
      continue;
    }

    stripped.push(arg);
  }

  if (ignored.length > 0) {
    console.log(`Ignoring custom host/port args for strict local dev: ${ignored.filter(Boolean).join(' ')}`);
  }

  return stripped;
}

const forwardedArgs = stripStrictDevArgs(process.argv.slice(2));

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
    return fs.existsSync(nextDir);
  }

  return (
    existing.node !== process.version ||
    existing.next !== nextVersion ||
    existing.platform !== process.platform
  );
}

function hasMissingManifestFiles(manifestPath, fileKeys) {
  const manifest = readJson(manifestPath);
  if (!manifest) {
    return false;
  }

  for (const key of fileKeys) {
    const entries = manifest[key];
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const relativeFile of entries) {
      const absoluteFile = path.join(webDir, '.next', relativeFile);
      if (!fs.existsSync(absoluteFile)) {
        return true;
      }
    }
  }

  return false;
}

function hasCorruptNextOutput() {
  if (!fs.existsSync(nextDir)) {
    return false;
  }

  const buildManifestPath = path.join(nextDir, 'build-manifest.json');
  if (hasMissingManifestFiles(buildManifestPath, ['rootMainFiles', 'devFiles', 'lowPriorityFiles'])) {
    return true;
  }

  const appBuildManifest = readJson(path.join(nextDir, 'app-build-manifest.json'));
  if (!appBuildManifest) {
    return false;
  }

  const appDir = path.join(webDir, 'src', 'app');
  const hasAppDirectory = fs.existsSync(appDir);
  const appPages = appBuildManifest.pages;
  return hasAppDirectory && appPages && typeof appPages === 'object' && Object.keys(appPages).length === 0;
}

const shouldClean =
  forceClean ||
  runtimeChanged() ||
  hasCorruptNextOutput();

if (shouldClean) {
  console.log('Cleaning stale .next output before starting Next.js dev...');
  fs.rmSync(nextDir, { recursive: true, force: true });
}

fs.mkdirSync(nextDir, { recursive: true });
fs.writeFileSync(
  runtimeMetaPath,
  JSON.stringify(
    {
      node: process.version,
      next: nextVersion,
      platform: process.platform,
    },
    null,
    2,
  ),
);

function canListenOnIpv6() {
  return new Promise((resolve) => {
    const probe = require('net').createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(0, '::');
  });
}

async function main() {
  const webHost = (await canListenOnIpv6()) ? WEB_HOST : IPV4_WILDCARD;
  if (webHost !== WEB_HOST) {
    console.log('IPv6 is unavailable on this host; binding 0.0.0.0 instead of ::.');
  }

  await ensureStrictLocalPort({
    port: WEB_PORT,
    host: '127.0.0.1',
    label: 'Web dev server',
    origin: `http://${WEB_ORIGIN_HOST}:${WEB_PORT}`,
  });

  console.log(`Starting web dev server on http://${WEB_ORIGIN_HOST}:${WEB_PORT}`);

  const nextBin = require.resolve('next/dist/bin/next', { paths: [webDir] });

  // Turbopack is the default dev compiler (stable in Next 15.5). It compiles routes
  // incrementally and is dramatically faster than the webpack dev compiler on this
  // large app (per-route recompiles drop from ~0.7-2.6s to ~50-200ms). Opt out with
  // CFB_DISABLE_TURBOPACK=1 if a dependency ever proves incompatible.
  const useTurbopack = process.env.CFB_DISABLE_TURBOPACK !== '1';
  const devArgs = [nextBin, 'dev', '-H', webHost, '-p', String(WEB_PORT)];
  if (useTurbopack) devArgs.push('--turbopack');
  devArgs.push(...forwardedArgs);

  if (useTurbopack) {
    console.log('Using Turbopack dev compiler (set CFB_DISABLE_TURBOPACK=1 to fall back to webpack).');
  }

  const devEnv = { ...process.env };
  // .env.local often sets NEXT_PUBLIC_API_URL=http://localhost:3001 which bypasses
  // the dev proxy and causes ERR_CONNECTION_REFUSED when only web is running.
  delete devEnv.NEXT_PUBLIC_API_URL;
  delete devEnv.NEXT_PUBLIC_WS_URL;

  const child = spawn(
    process.execPath,
    devArgs,
    {
      cwd: webDir,
      env: {
        ...devEnv,
        PORT: String(WEB_PORT),
        HOSTNAME: webHost,
        NEXT_PUBLIC_API_USE_PROXY: '1',
        API_PROXY_TARGET: API_ORIGIN,
        // OAuth / SSR use getAbsoluteApiOrigin() → API_PROXY_TARGET.
      },
      stdio: 'inherit',
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`Failed to start Next.js dev server: ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
