import 'reflect-metadata';
import { ExecutionContext, INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AIActionAuditService } from './ai-action-audit.service';
import { AIConversationService } from './ai-conversation.service';
import { AIJobQueueService } from './ai-job-queue.service';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AIRateLimitGuard } from './guards/ai-rate-limit.guard';
import { OllamaService } from './ollama.service';

/**
 * Covers the assistant's action trail over real decorated routes with a mocked
 * Prisma, so the validation pipe, the guard and the DTO all participate.
 *
 * It does not prove database persistence, and it is not evidence the trail is
 * complete: the executors run in the web app, so a client that never posts here
 * still performs its action. See the note on AIActionAuditService.
 */

type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadataJson: unknown;
  createdAt: Date;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

let rows: AuditRow[] = [];
let failNextCreate = false;

const prisma = {
  auditLog: {
    create: vi.fn(async ({ data }: { data: Omit<AuditRow, 'id' | 'createdAt'> }) => {
      if (failNextCreate) {
        failNextCreate = false;
        throw new Error('database unavailable');
      }
      const row: AuditRow = { id: `row-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where, take }: { where: { actorId: string; action?: { startsWith?: string } }; take: number }) =>
      rows
        .filter((row) => row.actorId === where.actorId)
        .filter((row) => !where.action?.startsWith || row.action.startsWith(where.action.startsWith))
        .slice(0, take),
    ),
  },
};

const authGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-test-user'];
    if (!userId) throw new UnauthorizedException();
    request.user = { id: userId };
    return true;
  },
};

@Module({
  controllers: [AIController],
  providers: [
    { provide: AIService, useValue: {} },
    { provide: OllamaService, useValue: { getDefaultModel: () => 'test-model' } },
    { provide: AIConversationService, useValue: {} },
    { provide: AIJobQueueService, useValue: {} },
    AIActionAuditService,
    { provide: PrismaService, useValue: prisma },
    { provide: JwtAuthGuard, useValue: authGuard },
    { provide: AIRateLimitGuard, useValue: { canActivate: () => true } },
  ],
})
class AuditTestModule {}

describe('AI action audit over decorated HTTP routes', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AuditTestModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    // Providing JwtAuthGuard by token is not enough: the real guard extends
    // passport's AuthGuard('jwt'), and with no strategy registered it answers
    // 500 instead of 401. The jobs suite spies the prototype for the same
    // reason, and `restoreMocks` means it has to be reinstalled every test.
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (context) =>
      authGuard.canActivate(context),
    );
    rows = [];
    failNextCreate = false;
    prisma.auditLog.create.mockClear();
  });

  const post = (body: unknown, user = 'user-1') =>
    fetch(`${baseUrl}/ai/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user': user },
      body: JSON.stringify(body),
    });

  const list = (user = 'user-1', query = '') =>
    fetch(`${baseUrl}/ai/actions${query}`, { headers: { 'x-test-user': user } });

  it('requires authentication to record or read', async () => {
    const anonPost = await fetch(`${baseUrl}/ai/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 'u2' } }),
    });
    expect(anonPost.status).toBe(401);

    const anonGet = await fetch(`${baseUrl}/ai/actions`);
    expect(anonGet.status).toBe(401);
  });

  it('records a confirmed action against the subject its arguments name', async () => {
    const res = await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 'u2' } });
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ recorded: true });

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('ai.shortlist_add.applied');
    expect(rows[0].actorId).toBe('user-1');
    expect(rows[0].entityType).toBe('user');
    expect(rows[0].entityId).toBe('u2');

    const meta = rows[0].metadataJson as Record<string, unknown>;
    expect(meta.source).toBe('ai_copilot');
    expect(meta.args).toEqual({ userId: 'u2' });
    expect(meta.writes).toBe(true);
    expect(meta.reversalKind).toBe('full');
  });

  it('carries the declared irreversibility onto the entry', async () => {
    // A sent message is read the moment it lands and a direct conversation
    // cannot be deleted, so this one stays honestly irreversible.
    await post({ actionId: 'start_or_send_message', outcome: 'applied', args: { userId: 'u9' } });
    const meta = rows[0].metadataJson as Record<string, unknown>;
    expect(meta.reversalKind).toBe('none');
    expect(meta.writes).toBe(true);
  });

  it('records an intro as partly reversible, now that the sender can withdraw it', async () => {
    // `DELETE /connections/:id` takes back a request nobody has answered. It
    // is partial rather than full because the notification already fired.
    await post({ actionId: 'send_connection', outcome: 'applied', args: { receiverId: 'u9' } });
    const meta = rows[0].metadataJson as Record<string, unknown>;
    expect(meta.reversalKind).toBe('partial');
    expect(meta.writes).toBe(true);
  });

  it('records a route rather than a user for navigation', async () => {
    await post({ actionId: 'navigate', outcome: 'applied', args: { href: '/matches' } });
    expect(rows[0].entityType).toBe('route');
    expect(rows[0].entityId).toBe('/matches');
    expect((rows[0].metadataJson as Record<string, unknown>).writes).toBe(false);
  });

  it('files a page capability against what it actually acted on', async () => {
    // The subject heuristic reads the first required argument and calls it a
    // user. For a readiness tick that argument is a dimension, so without the
    // declaration saying otherwise every one of these rows would name "team"
    // as a user id.
    await post({
      actionId: 'readiness_tick_criterion',
      outcome: 'applied',
      args: { dimension: 'team', criterionId: 'c1', completed: true },
    });
    await post({ actionId: 'analytics_set_period', outcome: 'applied', args: { period: '30d' } });
    await post({ actionId: 'workspace_create', outcome: 'applied', args: { name: 'Helios' } });

    expect(rows.map((row) => [row.entityType, row.entityId])).toEqual([
      ['readiness_criterion', 'c1'],
      ['analytics_window', '30d'],
      ['workspace', 'Helios'],
    ]);
  });

  it('records an undo distinctly from the action it reverses', async () => {
    await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 'u2' } });
    await post({ actionId: 'shortlist_add', outcome: 'undone', args: { userId: 'u2' } });

    expect(rows.map((r) => r.action)).toEqual([
      'ai.shortlist_add.applied',
      'ai.shortlist_add.undone',
    ]);
  });

  it('refuses a capability nobody declared, without writing a row', async () => {
    const res = await post({ actionId: 'delete_account', outcome: 'applied', args: {} });
    // 200-family with a reason: the action it claims has already happened, so a
    // failed status would misreport it.
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      recorded: false,
      reason: '"delete_account" is not a declared capability',
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses arguments that do not satisfy the declaration', async () => {
    const missing = await post({ actionId: 'send_connection', outcome: 'applied', args: {} });
    await expect(missing.json()).resolves.toEqual({
      recorded: false,
      reason: 'missing required argument "receiverId"',
    });

    const wrongType = await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 7 } });
    await expect(wrongType.json()).resolves.toEqual({
      recorded: false,
      reason: 'argument "userId" must be string, got number',
    });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('drops arguments the declaration does not define instead of storing them', async () => {
    await post({
      actionId: 'shortlist_add',
      outcome: 'applied',
      args: { userId: 'u2', isAdmin: true },
    });

    const meta = rows[0].metadataJson as Record<string, unknown>;
    expect(meta.args).toEqual({ userId: 'u2' });
    expect(meta.droppedArgs).toEqual(['isAdmin']);
  });

  it('rejects an unknown outcome at the DTO boundary', async () => {
    const res = await post({ actionId: 'shortlist_add', outcome: 'deleted', args: { userId: 'u2' } });
    expect(res.status).toBe(400);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed action id before it reaches a log line', async () => {
    for (const actionId of ['', 'Shortlist-Add', '../../etc', 'a'.repeat(101)]) {
      const res = await post({ actionId, outcome: 'applied', args: {} });
      expect(res.status).toBe(400);
    }
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('reports a failed database write without raising an error status', async () => {
    // The action already happened; a 500 here would tell the user it did not.
    failNextCreate = true;
    const res = await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 'u2' } });
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ recorded: false, reason: 'not recorded' });
  });

  it('returns only the caller’s own trail', async () => {
    await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 'mine' } }, 'user-1');
    await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: 'theirs' } }, 'user-2');

    const mine = await (await list('user-1')).json();
    expect(mine.entries).toHaveLength(1);
    expect(mine.entries[0].entityId).toBe('mine');

    const theirs = await (await list('user-2')).json();
    expect(theirs.entries).toHaveLength(1);
    expect(theirs.entries[0].entityId).toBe('theirs');
  });

  it('splits the stored action back into capability and outcome', async () => {
    await post({ actionId: 'start_or_send_message', outcome: 'applied', args: { userId: 'u3' } });
    const body = await (await list()).json();

    expect(body.entries[0]).toMatchObject({
      actionId: 'start_or_send_message',
      outcome: 'applied',
      entityType: 'user',
      entityId: 'u3',
      writes: true,
      reversalKind: 'none',
    });
  });

  it('clamps the requested limit instead of trusting it', async () => {
    for (let i = 0; i < 5; i += 1) {
      await post({ actionId: 'shortlist_add', outcome: 'applied', args: { userId: `u${i}` } });
    }

    const capped = await (await list('user-1', '?limit=2')).json();
    expect(capped.entries).toHaveLength(2);

    // Out-of-range and non-numeric values fall back rather than reaching Prisma.
    for (const query of ['?limit=0', '?limit=-5', '?limit=99999', '?limit=abc']) {
      const res = await list('user-1', query);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries.length).toBeGreaterThan(0);
      expect(body.entries.length).toBeLessThanOrEqual(200);
    }
  });
});
