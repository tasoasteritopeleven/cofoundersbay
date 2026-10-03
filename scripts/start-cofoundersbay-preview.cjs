'use strict';

// Preview-only adapter for the existing supervisor service. The imported
// repository, its package manager, and every protected .env value stay intact.
const path = require('node:path');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '../cofoundersbay');
const web = path.join(repo, 'apps/web');
const nextEnv = require.resolve('@next/env', { paths: [repo] });
require(nextEnv).loadEnvConfig(path.resolve(__dirname, '..'));
const previewOrigin = process.env.NEXT_PUBLIC_BASE_URL;
if (!previewOrigin) throw new Error('NEXT_PUBLIC_BASE_URL must be supplied by the preview environment.');
const previewHost = new URL(previewOrigin).hostname;
const { HOST, PORT } = process.env;
if (!HOST || !PORT) {
  throw new Error('The preview must run through supervisor with its existing HOST and PORT.');
}
const next = require.resolve('next/dist/bin/next', { paths: [repo] });
const child = spawn(process.execPath, [next, 'dev', web, '--turbopack', '--hostname', HOST, '--port', PORT], {
  cwd: web,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1024',
    PREVIEW_ALLOWED_DEV_ORIGINS: process.env.PREVIEW_ALLOWED_DEV_ORIGINS || [previewHost, '**.preview.emergentcf.cloud'].join(','),
    NEXT_PUBLIC_API_USE_PROXY: '1',
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
