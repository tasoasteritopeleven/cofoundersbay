'use strict';

// Build an immutable local review snapshot, without deployment or .env writes.
// Use supervisor for serving; this process only compiles and records the result.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const repo = path.join(root, 'cofoundersbay');
const web = path.join(repo, 'apps/web');
const dist = process.argv[2];
if (!dist || !/^\.next-preview-[a-z0-9-]+$/.test(dist)) {
  throw new Error('Supply a unique .next-preview-<name> directory.');
}
if (fs.existsSync(path.join(web, dist))) throw new Error('Do not overwrite a served build; choose a new directory.');
require(require.resolve('@next/env', { paths: [repo] })).loadEnvConfig(root);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next', { paths: [repo] }), 'build', web], {
  cwd: web,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NODE_OPTIONS: '--max-old-space-size=1408',
    EMERGENT_PREVIEW_DIST_DIR: dist,
    NEXT_PUBLIC_API_USE_PROXY: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  },
});
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code) => {
  fs.mkdirSync(path.join(root, 'audit-backups'), { recursive: true });
  fs.writeFileSync(path.join(root, 'audit-backups', `${dist}.exit`), `${code ?? 1}\n`);
  // Selecting/serving is an explicit step AFTER successful compilation.
  process.exitCode = code ?? 1;
});
