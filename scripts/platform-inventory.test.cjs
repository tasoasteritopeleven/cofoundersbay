const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildInventory, routeFromFile } = require('./platform-inventory.cjs');

const sources = {
  'apps/web/src/app/(auth)/login/page.tsx': "import { Form } from '@/components/Form'; export default function Page() { return <Form />; }",
  'apps/web/src/app/research/[boardId]/page.tsx': 'export default function Board() { return <><Button onClick={save}>Save</Button><Dialog><form onSubmit={submit} /></Dialog></>; }',
  'apps/web/src/components/Form.tsx': 'export function Form() { return <form><Button type="submit">Save</Button><Button {...props}>Other</Button></form>; }',
  'apps/web/src/app/not-found.tsx': 'export default function Missing() { return <a href="/">Home</a>; }',
  'apps/web/src/app/login/loading.tsx': 'export default function Loading() { return null; }',
  'apps/web/src/components/Form.test.tsx': 'const sample = <Button>Test only</Button>;',
  'apps/api/src/ai/ai.controller.ts': "@Controller('ai') @UseGuards(JwtAuthGuard) export class AIController { @Get('jobs/:id') getJob() {} @Post('jobs') @UseGuards(AIRateLimitGuard) enqueue() {} }",
};

test('normalizes route groups without losing dynamic route parameters', () => {
  assert.equal(routeFromFile('apps/web/src/app/(auth)/login/page.tsx'), '/login');
  assert.equal(routeFromFile('apps/web/src/app/research/[boardId]/page.tsx'), '/research/[boardId]');
  assert.equal(routeFromFile('apps/web/src/app/page.tsx'), '/');
});

test('lists every page, boundary and shared interaction without marking runtime as verified', () => {
  const inventory = buildInventory(sources);
  assert.equal(inventory.routes.length, 2);
  assert.equal(inventory.boundaries.length, 2);
  assert.ok(inventory.surfaces.some((surface) => surface.kind === 'dialog'));
  assert.ok(inventory.surfaces.some((surface) => surface.kind === 'form'));
  assert.ok(inventory.surfaces.every((surface) => surface.status === 'not_tested'));
  assert.ok(inventory.routes.every((route) => route.status === 'not_tested'));
  assert.ok(inventory.surfaces.every((surface) => !surface.file.includes('.test.')));
});

test('links imported shared surfaces to consuming routes', () => {
  const inventory = buildInventory(sources);
  const login = inventory.routes.find((route) => route.route === '/login');
  const shared = inventory.surfaces.filter((surface) => surface.file.endsWith('/Form.tsx'));
  assert.equal(shared.length, 3);
  assert.ok(shared.every((surface) => login.surfaceIds.includes(surface.id)));
});

test('records static handlers and spreads as observations, not proof of functionality', () => {
  const { surfaces } = buildInventory(sources);
  assert.ok(surfaces.some((surface) => surface.handlers.includes('onClick')));
  const spread = surfaces.find((surface) => surface.hasSpread);
  assert.equal(spread.status, 'not_tested');
  assert.deepEqual(spread.evidence, []);
  assert.equal(spread.access, null);
  assert.equal(spread.data, null);
});

test('indexes API methods and class/method guard declarations without claiming ACL coverage', () => {
  const { endpoints } = buildInventory(sources);
  assert.equal(endpoints.length, 2);
  assert.deepEqual(endpoints.map(({ method, path }) => [method, path]), [['GET', '/ai/jobs/:id'], ['POST', '/ai/jobs']]);
  assert.deepEqual(endpoints[1].guards, ['JwtAuthGuard', 'AIRateLimitGuard']);
  assert.ok(endpoints.every((endpoint) => endpoint.status === 'not_tested'));
});

test('output ordering and identifiers are deterministic and unique', () => {
  const first = buildInventory(sources);
  const reversed = buildInventory(Object.fromEntries(Object.entries(sources).reverse()));
  assert.deepEqual(first, reversed);
  assert.equal(new Set(first.surfaces.map((surface) => surface.id)).size, first.surfaces.length);
});
