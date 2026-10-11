const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const source = readFileSync(path.join(__dirname, 'deploy.sh'), 'utf8');
const windowsBash = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe');
const bash = process.env.CFB_TEST_BASH || (process.platform === 'win32' ? windowsBash : 'bash');
const bashAvailable = process.platform !== 'win32' || existsSync(bash);

function extract(name) {
  const match = source.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));
  assert.ok(match, `Missing ${name} function`);
  return match[0];
}

function runFunction(name, overrides = {}) {
  const helpers = ['api_health_check', 'pm2_health_check'].filter((helper) => source.includes(`${helper}()`));
  const program = [
    'set -euo pipefail',
    'print_status() { :; }',
    'sleep() { :; }',
    'curl() { case "$*" in *3001*) printf "%s" "$API_JSON"; return "$API_EXIT" ;; *) return "$WEB_EXIT" ;; esac; }',
    'pm2() { if [ "$1" = jlist ]; then printf "%s" "$PM2_JSON"; else return 93; fi; }',
    'find() { return 91; }',
    'rm() { return 92; }',
    ...helpers.filter((helper) => helper !== name).map(extract),
    extract(name),
    name,
  ].join('\n');
  return spawnSync(bash, ['--noprofile', '--norc', '-c', program], {
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_DIR: '.',
      HEALTH_CHECK_TIMEOUT: '1',
      API_JSON: JSON.stringify({ success: true, data: { status: 'ready' } }),
      API_EXIT: '0',
      WEB_EXIT: '0',
      PM2_JSON: JSON.stringify([
        { name: 'cofounderbay-api', pm2_env: { status: 'online' } },
        { name: 'cofounderbay-web', pm2_env: { status: 'online' } },
      ]),
      ...overrides,
    },
  });
}

function expectExit(name, code, env) {
  const result = runFunction(name, env);
  assert.equal(result.status, code, result.stderr || result.stdout);
}

test('post-deploy cleanup cannot delete runtime dependencies or builds', () => {
  const cleanup = extract('cleanup');
  assert.doesNotMatch(cleanup, /^\s*(?:find|rm)\s/m);
  assert.doesNotMatch(cleanup, /pm2\s+restart\s+all/);
});

test('deployment uses frozen pnpm install and existing workspace builds', () => {
  assert.match(extract('install_dependencies'), /pnpm install --frozen-lockfile/);
  assert.doesNotMatch(extract('install_dependencies'), /npm ci/);
  assert.match(extract('build_applications'), /pnpm --filter @cofounderbay\/shared build/);
  assert.doesNotMatch(extract('build_applications'), /build:shared/);
});

test('code update refuses dirty worktrees and only fast-forwards', () => {
  assert.doesNotMatch(extract('update_code'), /git stash push/);
  assert.match(extract('update_code'), /git pull --ff-only/);
  assert.match(extract('update_code'), /cfb-previous-deploy/);
});

test('rollback uses the recorded deployment, never resets history or assumes HEAD~1', () => {
  assert.doesNotMatch(extract('rollback_deployment'), /git reset --hard|HEAD~1/);
  assert.match(extract('rollback_deployment'), /cfb-previous-deploy/);
  assert.match(extract('rollback_deployment'), /git switch --detach/);
});

test('health requires valid HTTP readiness, web success and both PM2 apps', { skip: !bashAvailable }, () => {
  expectExit('health_check', 0);
  expectExit('health_check', 0, { API_JSON: '{"status":"ready"}' });
  expectExit('health_check', 1, { API_EXIT: '22' });
  expectExit('health_check', 1, { WEB_EXIT: '22' });
  expectExit('health_check', 1, { API_JSON: '{"data":{"status":"not_ready"}}' });
  expectExit('health_check', 1, { API_JSON: '<html>unavailable</html>' });
  expectExit('health_check', 1, { PM2_JSON: '[]' });
  expectExit('health_check', 1, { PM2_JSON: '[{"name":"cofounderbay-api","pm2_env":{"status":"online"}}]' });
  expectExit('health_check', 1, { PM2_JSON: '[{"name":"cofounderbay-api","pm2_env":{"status":"online"}},{"name":"cofounderbay-api","pm2_env":{"status":"errored"}},{"name":"cofounderbay-web","pm2_env":{"status":"online"}}]' });
});

test('cleanup only verifies the application without running destructive commands', { skip: !bashAvailable }, () => {
  expectExit('cleanup', 0);
});
