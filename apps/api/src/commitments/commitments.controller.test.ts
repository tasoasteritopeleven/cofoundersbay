import 'reflect-metadata';
import { ExecutionContext, INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { CommitmentsController } from './commitments.controller';
import { CommitmentsService } from './commitments.service';
import { VerificationService } from '../verification/verification.service';
import { createFakePrisma } from './fake-prisma';

/**
 * The commitments routes over HTTP, with the app's own exception filter and
 * response envelope, an in-memory database and a mocked sign-in.
 *
 * What this adds to the service test: every route but the public card is
 * guarded; the public card answers without an account; and a refusal's
 * `details` (the kinds found, the Greek message) survive the filter, which
 * is what lets the browser say *why* a message was not sent.
 */

const fake = createFakePrisma();
fake.addUser('u-elena', 'Elena Papadopoulos');
fake.addUser('u-marcus', 'Marcus Chen');

const authGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-test-user'];
    if (!userId) throw new UnauthorizedException();
    request.user = { id: userId, role: 'founder' };
    return true;
  },
};

@Module({
  controllers: [CommitmentsController],
  providers: [
    CommitmentsService,
    { provide: PrismaService, useValue: fake.prisma },
    { provide: NotificationsService, useValue: fake.notifications },
    { provide: VerificationService, useValue: { isVerified: async () => true, publicMethods: async () => [], roleCleared: async () => true } },
  ],
})
class CommitmentsTestModule {}

const CARD = {
  kind: 'cofounder',
  title: 'Technical co-founder for Harbor',
  exists: 'A working founder workspace with $375K of a $750K seed committed.',
  goal: 'Ship the workspace to the first twenty paying teams this year.',
  missing: 'A technical co-founder who has taken a real-time product to production.',
  offerRole: 'CTO and co-founder',
  offerEquity: '10–15%',
  offerHours: 40,
  offerScope: 'Own the platform and hire the first two engineers.',
  category: 'B2B SaaS',
  place: 'Athens, Greece',
  isRemote: false,
  stage: 'building',
  commitment: 'full_time',
};

describe('commitments HTTP routes', () => {
  let app: INestApplication;
  let baseUrl: string;

  const call = async (method: string, path: string, user?: string, body?: unknown) => {
    const res = await fetch(`${baseUrl}/commitments${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  beforeAll(async () => {
    app = await NestFactory.create(CommitmentsTestModule, { logger: false });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (context) => authGuard.canActivate(context));
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires sign-in for every route except the public card', async () => {
    expect((await call('GET', '/cards')).status).toBe(401);
    expect((await call('POST', '/cards', undefined, CARD)).status).toBe(401);
    expect((await call('GET', '/threads')).status).toBe(401);
    expect((await call('GET', '/public/not-a-real-token')).status).toBe(404);
  });

  it('walks a card from publishing to a protected conversation', async () => {
    const created = await call('POST', '/cards', 'u-elena', CARD);
    expect(created.status).toBe(201);
    const cardId = created.body.data.card.id;

    const share = await call('POST', `/cards/${cardId}/share`, 'u-elena');
    const open = await call('GET', `/public/${share.body.data.token}`);
    expect(open.status).toBe(200);
    expect(open.body.data.card.owner.displayName).toBe('Elena Papadopoulos');

    const interest = await call('POST', `/cards/${cardId}/interest`, 'u-marcus', { note: 'Shipped real-time systems for six years.' });
    const threadId = interest.body.data.thread.id;
    expect((await call('POST', `/threads/${threadId}/accept`, 'u-marcus')).status).toBe(403);
    expect((await call('POST', `/threads/${threadId}/accept`, 'u-elena')).status).toBe(201);

    const refused = await call('POST', `/threads/${threadId}/messages`, 'u-marcus', { body: 'Text me: 6912345678' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.details).toMatchObject({ reason: 'contact_details', kinds: ['phone', 'messenger'] });
    expect(refused.body.error.details.messageEl).toContain('αριθμό τηλεφώνου');

    const sent = await call('POST', `/threads/${threadId}/messages`, 'u-marcus', { body: 'Happy to walk you through the platform here.' });
    expect(sent.status).toBe(201);
    const thread = await call('GET', `/threads/${threadId}`, 'u-elena');
    expect(thread.body.data.thread.messages).toHaveLength(1);
  });

  it('parses the terms version as a number and refuses a stale one', async () => {
    const created = await call('POST', '/cards', 'u-elena', { ...CARD, title: 'Second card for Harbor' });
    const cardId = created.body.data.card.id;
    const interest = await call('POST', `/cards/${cardId}/interest`, 'u-marcus', {});
    const threadId = interest.body.data.thread.id;
    await call('POST', `/threads/${threadId}/accept`, 'u-elena');
    await call('POST', `/threads/${threadId}/confirm`, 'u-elena');
    await call('POST', `/threads/${threadId}/confirm`, 'u-marcus');
    await call('POST', `/threads/${threadId}/terms`, 'u-elena', { role: 'CTO', equityPct: 10, vestingMonths: 48, cliffMonths: 12, hoursPerWeek: 40, scope: 'Platform' });
    expect((await call('POST', `/threads/${threadId}/terms/abc/accept`, 'u-marcus')).status).toBe(400);
    expect((await call('POST', `/threads/${threadId}/terms/2/accept`, 'u-marcus')).status).toBe(409);
    const agreed = await call('POST', `/threads/${threadId}/terms/1/accept`, 'u-marcus');
    expect(agreed.body.data).toEqual({ ok: true, agreed: true, step: 'agreed' });
  });
});
