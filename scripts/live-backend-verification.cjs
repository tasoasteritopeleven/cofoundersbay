#!/usr/bin/env node
'use strict';

// Deliberately independent of dev-api/dev-stack, dotenv, and workspace DB settings.
// Run from any directory: node scripts/live-backend-verification.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const api = path.join(root, 'apps/api');
const dep = createRequire(path.join(api, 'package.json'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-live-'));
fs.chmodSync(temp, 0o700);
const stage = path.join(temp, 'stage/apps/api');
const socket = path.join(temp, 'socket');
const pgdata = path.join(temp, 'pgdata');
const dbname = 'cfb_disposable';
const findings = [];
const browserHold = process.argv.includes('--browser-hold');
let holding = false;
let child, pgStarted = false, smtp, closed = false;
// PATH is the only inherited setting; no env dump, secret access, or .env reads.
const env = { PATH: process.env.PATH, HOME: temp, TMPDIR: temp, LANG: 'C.UTF-8',
  NODE_ENV: 'test', CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' };
const record = (name, passed, detail = '') => {
  findings.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
};
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, cwd: stage, encoding: 'utf8',
    timeout: 120000, maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    // Children only receive synthetic env; nevertheless do not print arbitrary output.
    const error = new Error(`${path.basename(command)} failed (exit ${result.status}; ${result.error?.code || 'child error'})`);
    error.childOutput = (result.stderr || result.stdout || '').slice(-12000);
    throw error;
  }
  return result.stdout.trim();
}
function assertTarget() {
  const url = new URL(env.DATABASE_URL);
  if (url.hostname !== 'localhost' || url.pathname !== `/${dbname}` ||
      url.searchParams.get('host') !== socket || url.port !== env.PGPORT ||
      !socket.startsWith(temp + '/') || !fs.existsSync(path.join(pgdata, 'PG_VERSION')))
    throw new Error('Fail-closed database identity assertion');
}
function sql(query) {
  assertTarget();
  return run('psql', ['-X', '-h', socket, '-p', env.PGPORT, '-U', 'cfb_test',
    '-d', dbname, '-v', 'ON_ERROR_STOP=1', '-At', '-c', query]);
}
function stageTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const from = path.join(src, ent.name), to = path.join(dest, ent.name);
    if (ent.isDirectory()) stageTree(from, to);
    else if (ent.name.endsWith('.ts') || ent.name.endsWith('.json')) fs.copyFileSync(from, to);
  }
}
function compileProject(project, overrides, label) {
  const ts = dep('typescript');
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(project, 'tsconfig.build.json'),
    { incremental: false, ...overrides }, {
      ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => { throw new Error(`${label} compiler config invalid`); },
    });
  if (!parsed || parsed.errors.length) throw new Error(`${label} compiler config parse failed`);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics()];
  if (diagnostics.length) throw new Error(`${label} compiler syntax/options diagnostics: ${diagnostics.map(x => x.code).join(',')}`);
  // Real project type checker resolves type-only decorator parameters. Unlike
  // transpileModule this does not invent runtime imports for Express interfaces.
  const semantic = program.getSemanticDiagnostics();
  const emitted = program.emit(undefined, (fileName, contents) => {
    const destination = path.resolve(fileName);
    if (!destination.startsWith(temp + path.sep)) throw new Error('Compiler attempted emission outside private staging');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
  });
  if (emitted.emitSkipped) throw new Error(`${label} project compiler skipped emission`);
  record(`${label} project compiler emission`, true,
    `TypeScript createProgram; semantic diagnostics ${semantic.length}; codes ${[...new Set(semantic.map(x => x.code))].join(',') || 'none'}; noEmitOnError=${!!parsed.options.noEmitOnError}`);
  if (label === 'API') {
    if (parsed.options.module !== ts.ModuleKind.CommonJS || !parsed.options.emitDecoratorMetadata ||
        !parsed.options.experimentalDecorators || !!parsed.options.esModuleInterop)
      throw new Error('Unexpected original API compiler interop/decorator configuration');
    const auth = fs.readFileSync(path.join(project, 'dist/auth/auth.controller.js'), 'utf8');
    if (/require\(["']express["']\)/.test(auth)) throw new Error('Express type-only import unexpectedly emitted');
    record('API emitted configuration verified', true, 'CommonJS; decorator metadata enabled; original esModuleInterop=false; auth controller has no runtime express import');
  }
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function cleanup() {
  if (closed) return;
  closed = true;
  if (child && child.exitCode === null) child.kill('SIGKILL');
  if (pgStarted) {
    const stopped = spawnSync('pg_ctl', ['-D', pgdata, '-m', 'immediate', '-w', 'stop'],
      { env, encoding: 'utf8', timeout: 15000 });
    if (stopped.status !== 0) {
      console.error('Own PostgreSQL cleanup failed; private directory retained:', temp);
      return;
    }
  }
  smtp?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
function writeReport() {
  const text = `# Live backend verification\n\nRun timestamp: ${new Date().toISOString()}\n\n` +
    `Command: \`node scripts/live-backend-verification.cjs\` from \`source/cofoundersbay\`.\n\n` +
    `Original Nest main/AppModule, real Passport JWT/Argon2/Prisma; no auth or DB mocks. ` +
    `Fresh private mkdtemp PostgreSQL cluster, Unix socket only, explicit disposable DB identity checks before SQL/push. ` +
    `Schema pushed only here (never migrations or broad seed). Schema-generated client and transpiled source stay in staging. ` +
    `Explicit child environment; no inherited secrets or dotenv files. The app's built-in automation rule seeder runs against this disposable DB. ` +
    `Automation timers run normally; Redis queues disabled by absent REDIS_URL; cache/search/Ollama traffic blocked; ` +
    `SMTP is unconfigured (mailer disabled); OAuth/Stripe/S3/AI keys absent. No provider integration certification. ` +
    `Configured-email startup is a separate known issue and is not tested here; no mail provider was enabled or repaired.\n\n` +
    `Temporary API: ${env.PORT ? `http://127.0.0.1:${env.PORT}/api` : 'not started'}. ` +
    `${holding ? 'Browser hold active; private fixture file available until SIGINT/SIGTERM or timeout. ' : 'Runner tears down its own API/DB after this run. '}` +
    `HTTP re-fetch/new login tests are not a rendered-browser reload test. Production Secure-cookie behavior is not covered in NODE_ENV=test.\n\n` +
    `| Check | Result | Sanitized evidence |\n|---|---|---|\n` +
    findings.map(x => `| ${x.name} | ${x.passed ? 'PASS' : 'FAIL'} | ${x.detail.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`).join('\n') +
    `\n\nScope exclusions: exhaustive 22-persona/tenant membership matrix, OAuth/SSO, payment, upload, AI, queues, browser accessibility. ` +
    `Failures are findings; this runner does not repair application behavior.\n\n` +
    `## Outcome and interpretation limits\n\n` +
    `${findings.filter(x => x.passed).length} passing and ${findings.filter(x => !x.passed).length} failing assertion rows; rows are not independent user journeys. ` +
    `A failed shortlist HTTP status, shape, pagination, role/skills, private-note or session assertion produces a FAIL row and nonzero runner exit code. ` +
    `The shortlist checks cover two owners and three synthetic accounts: empty and populated HTTP reads, User.role projection, nullable profile/note, skills, two-page cursor traversal, private notes, cross-owner isolation, and fresh-login HTTP read-after-write. ` +
    `The prior Profile.role selection failure is not reproduced by this run. Fixture rows are removed with the disposable cluster.\n\n` +
    `Research persistence here means HTTP read-after-write, not database restart or browser reload. ` +
    `Tenant checks exercise organization membership on tenant-linked resources, not every tenant guard or mixed-membership combination. ` +
    `Refresh expiry is tested by backdating the disposable token row; access expiry uses a correctly signed already-expired JWT, not natural waiting. ` +
    `Logout proves cookie clearing and refresh revocation, not immediate revocation of copied access JWTs. ` +
    `Any browser results are recorded separately in LIVE_BROWSER_VERIFICATION.md. Cleanup below is runner policy, not independently asserted by this report.\n`;
  fs.writeFileSync(path.join(root, 'docs/LIVE_BACKEND_VERIFICATION.md'), text);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  const wasHolding = holding;
  holding = false;
  record(wasHolding ? 'Browser hold ended' : 'Run interrupted', wasHolding, signal);
  writeReport(); cleanup(); process.exit(wasHolding ? (findings.some(x => !x.passed) ? 1 : 0) : 130);
});
process.on('exit', cleanup);

async function main() {
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(socket, { mode: 0o700 });
  // Stage source only; never recursively copy workspace files or dotenv.
  stageTree(path.join(api, 'src'), path.join(stage, 'src'));
  const shared = path.join(temp, 'stage/packages/shared');
  stageTree(path.join(root, 'packages/shared/src'), path.join(shared, 'src'));
  for (const [from, to] of [[api, stage], [path.join(root, 'packages/shared'), shared]]) {
    for (const name of ['tsconfig.json', 'tsconfig.build.json'])
      fs.copyFileSync(path.join(from, name), path.join(to, name));
  }
  fs.symlinkSync(path.join(api, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
  fs.symlinkSync(path.join(root, 'packages/shared/node_modules'), path.join(shared, 'node_modules'), 'dir');
  // All four ConfigModule env candidates must be absent, including /tmp/.env.
  for (const base of [stage, path.dirname(stage), path.resolve(stage, '../..'), path.resolve(stage, '../../..')]) {
    if (fs.existsSync(path.join(base, '.env'))) throw new Error('Unexpected dotenv candidate: refusing launch');
  }
  env.PGPORT = String(await freePort());
  run('initdb', ['-D', pgdata, '-U', 'cfb_test', '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8']);
  pgStarted = true; // Also attempt cleanup if pg_ctl times out after spawning postgres.
  run('pg_ctl', ['-D', pgdata, '-l', path.join(temp, 'postgres.log'), '-o',
    `-k ${socket} -p ${env.PGPORT} -c listen_addresses='' -c unix_socket_permissions=0700`, '-w', 'start']);
  run('createdb', ['-h', socket, '-p', env.PGPORT, '-U', 'cfb_test', dbname]);
  env.DATABASE_URL = `postgresql://cfb_test@localhost:${env.PGPORT}/${dbname}?host=${encodeURIComponent(socket)}`;
  assertTarget();
  const identity = sql(`SELECT current_database() || ':' || current_user || ':' || current_setting('data_directory')`);
  if (identity !== `${dbname}:cfb_test:${pgdata}`) throw new Error('Database identity mismatch');
  record('Disposable database identity', true, `${dbname}; fresh cluster; private Unix socket; TCP disabled`);
  const schemaPath = path.join(stage, 'schema.prisma');
  const generated = path.join(stage, 'generated');
  fs.writeFileSync(schemaPath, fs.readFileSync(path.join(api, 'prisma/schema.prisma'), 'utf8')
    .replace('provider = "prisma-client-js"', `provider = "prisma-client-js"\n  output = "${generated}"`));
  const prismaCli = dep.resolve('prisma/build/index.js');
  assertTarget();
  run(process.execPath, [prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate']);
  run(process.execPath, [prismaCli, 'generate', '--schema', schemaPath]);
  compileProject(shared, {}, 'Shared');
  compileProject(stage, { paths: {
    '@shared/*': ['../../packages/shared/src/*'],
    '@cofounderbay/shared': ['../../packages/shared/dist/index.d.ts'],
    '@cofounderbay/shared/*': ['../../packages/shared/dist/*'],
    '@prisma/client': ['./generated/index.d.ts'],
  } }, 'API');
  record('Schema-only tables exist', sql(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('SavedProfile','AIUsageLog','AIConversation','AuditLog')`) === '4', 'Direct SQL expects all four tables');
  smtp = net.createServer(conn => {
    conn.setEncoding('utf8'); conn.write('220 localhost test sink\r\n');
    let data = false, buffer = '';
    conn.on('data', text => {
      buffer += text;
      while (buffer.includes('\r\n')) {
        const at = buffer.indexOf('\r\n'), line = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        if (data) { if (line === '.') { data = false; conn.write('250 discarded\r\n'); } }
        else if (/^DATA/i.test(line)) { data = true; conn.write('354 end with dot\r\n'); }
        else if (/^QUIT/i.test(line)) conn.end('221 bye\r\n');
        else conn.write('250 localhost\r\n');
      }
    });
    conn.on('error', () => {});
  });
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
  Object.assign(env, { PORT: String(await freePort()),
    EMAIL_FROM: 'test@example.invalid', STORAGE_PROVIDER: 'local', MONITORING_ENABLED: 'false',
    JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
    JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d', LOG_LEVEL: 'error',
    CORS_ORIGIN: 'http://127.0.0.1:3000', MEILISEARCH_HOST: 'http://127.0.0.1:1',
    OLLAMA_BASE_URL: 'http://127.0.0.1:1', REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' });
  const preload = path.join(stage, 'isolation.cjs');
  fs.writeFileSync(preload, `
const Module = require('node:module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  if (name === '@prisma/client') return ${JSON.stringify(path.join(generated, 'index.js'))};
  if (name === '@cofounderbay/shared') return ${JSON.stringify(path.join(shared, 'dist/index.js'))};
  return originalResolve.call(this, name, ...args);
};
// Prevent dotenv reads even if future modules add a new envFilePath.
const fs = require('node:fs');
const read = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  if (typeof file === 'string' && /(^|\\/)\\.env(?:\\.|$)/.test(file))
    throw Object.assign(new Error('dotenv blocked by isolated runner'), { code: 'ENOENT' });
  return read.call(this, file, ...args);
};
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const a = Array.isArray(args[0]) ? args[0][0] : args[0];
  const port = typeof a === 'object' ? a.port : a;
  const host = typeof a === 'object' ? a.host : args[1];
  if (String(port) !== ${JSON.stringify(env.SMTP_PORT)} || host !== '127.0.0.1') {
    process.nextTick(() => this.destroy(Object.assign(new Error('External/service networking blocked'), { code: 'ECONNREFUSED' })));
    return this;
  }
  return connect.apply(this, args);
};
global.fetch = async () => { throw new Error('Provider fetch disabled by isolated runner'); };
require('reflect-metadata');
`);
  // Child logs retained only in private temp directory and never dumped as evidence.
  const log = fs.openSync(path.join(temp, 'api.log'), 'w', 0o600);
  child = spawn(process.execPath, ['--require', preload, path.join(stage, 'dist/main.js')],
    { cwd: stage, env, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  const base = `http://127.0.0.1:${env.PORT}/api`;
  let reachable = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Original Nest startup exited ${child.exitCode}; inspect private staged api.log before cleanup if debugging`);
    try { const r = await fetch(base + '/auth/me', { signal: AbortSignal.timeout(1000) }); if (r.status === 401) { reachable = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!reachable) throw new Error('Original Nest did not become reachable within 30 seconds');
  record('Original Nest reachable', true, `${base}/auth/me returned 401`);
  const fixtures = await require('./live-backend-probes.cjs')({ base, sql, record, secret: env.JWT_ACCESS_SECRET });
  if (browserHold) {
    const fixturePath = path.join(temp, 'browser-fixtures.json');
    fs.writeFileSync(fixturePath, JSON.stringify({
      apiBaseUrl: base, runnerPid: process.pid, apiPid: child.pid,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ...fixtures,
    }, null, 2), { mode: 0o600, flag: 'wx' });
    holding = true;
    writeReport();
    console.log(`Browser hold ready. Private fixture file: ${fixturePath}`);
    console.log('Hold expires in 30 minutes; send SIGTERM to this runner for cleanup. No credentials are printed.');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 30 * 60 * 1000);
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Held API exited unexpectedly')); });
    });
    holding = false;
    record('Browser hold ended', true, '30-minute timeout');
  }
}

main().catch(error => {
  record('Harness or boot blocker', false, error.message);
  // Extract only safe compiler/module diagnostic labels, never raw runtime logs.
  const privateLog = path.join(temp, 'api.log');
  const output = error.childOutput || (fs.existsSync(privateLog) ? fs.readFileSync(privateLog, 'utf8') : '');
   const labels = output.match(/(?:Cannot find (?:module|package) ['"][^'"]+['"]|Nest can't resolve dependencies[^\n]*)/g)
     || output.match(/Error: [A-Za-z][A-Za-z0-9 .:_()/-]{0,220}/g);
  if (labels) record('Sanitized blocker diagnostic', false, [...new Set(labels)].slice(0, 5).join('; '));
  const stack = output.split('\n').filter(line => /^\s+at /.test(line) && /\/dist\/.*:\d+:\d+/.test(line));
  if (stack.length) record('Application stack location', false, stack.slice(0, 4).map(line =>
    line.replaceAll(temp, '[private-temp]').trim()).join('; '));
  process.exitCode = 1;
}).finally(() => {
  writeReport();
  cleanup();
  if (findings.some(x => !x.passed)) process.exitCode = 1;
});