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
const fs = require('node:fs');
const next = require.resolve('next/dist/bin/next', { paths: [repo] });
const activeBuildFile = path.resolve(__dirname, '../audit-backups/active-preview-dist');
const activeBuild = fs.existsSync(activeBuildFile) ? fs.readFileSync(activeBuildFile, 'utf8').trim() : '';
if (activeBuild && (!/^\.next-preview-[a-z0-9-]+$/.test(activeBuild) || !fs.existsSync(path.join(web, activeBuild, 'BUILD_ID')))) {
  throw new Error('The selected isolated preview build is not complete. Refusing to serve mismatched assets.');
}
// A completed isolated build has immutable CSS/assets, avoiding watcher caps
// and dev-memory restarts during measurements. No production deployment occurs.
const child = spawn(process.execPath, [next, activeBuild ? 'start' : 'dev', web, '--hostname', HOST, '--port', PORT], {
  cwd: web,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1024',
    PREVIEW_ALLOWED_DEV_ORIGINS: process.env.PREVIEW_ALLOWED_DEV_ORIGINS || [previewHost, '**.preview.emergentcf.cloud'].join(','),
    NEXT_PUBLIC_API_USE_PROXY: '1',
    WATCHPACK_POLLING: '1000',
    EMERGENT_PREVIEW_RUNTIME: '1',
    NEXT_PUBLIC_EMERGENT_PREVIEW: '1',
    // Host sources are HTTPS-only when this HTTPS preview is embedded. No
    // wildcard: other tenants and arbitrary websites cannot frame the app.
    PREVIEW_FRAME_ANCESTORS: process.env.PREVIEW_FRAME_ANCESTORS || 'app.emergent.sh emergent.sh app.emergentagent.com app.emergent.host',
    ...(activeBuild ? { NODE_ENV: 'production', EMERGENT_PREVIEW_DIST_DIR: activeBuild } : {}),
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
