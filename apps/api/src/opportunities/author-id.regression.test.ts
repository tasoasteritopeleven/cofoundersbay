import 'reflect-metadata';
import { ExecutionContext, INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { MarketplaceController } from '../marketplace/marketplace.controller';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { LearningController } from '../learning/learning.controller';
import { LearningService } from '../learning/learning.service';

/**
 * The signed-in user is `req.user.id`: `JwtStrategy.validate` returns
 * `{ id, email, role }`. These three controllers read `req.user.userId`,
 * which is always undefined, so posting an opportunity, a service or a
 * learning resource wrote a row with no author (and failed), and the author
 * could never edit or delete their own. The services are mocked; the
 * assertion is the author id each route hands them.
 */

const opportunities = { create: vi.fn(async () => ({ id: 'o1' })), update: vi.fn(async () => ({ id: 'o1' })), delete: vi.fn(async () => ({ ok: true })) };
const marketplace = { create: vi.fn(async () => ({ id: 'm1' })), update: vi.fn(async () => ({ id: 'm1' })), delete: vi.fn(async () => ({ ok: true })) };
const learning = { create: vi.fn(async () => ({ id: 'l1' })), update: vi.fn(async () => ({ id: 'l1' })), delete: vi.fn(async () => ({ ok: true })) };

const authGuard = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-test-user'];
    if (!userId) throw new UnauthorizedException();
    request.user = { id: userId, email: 'a@b.test', role: 'founder' };
    return true;
  },
};

@Module({
  controllers: [OpportunitiesController, MarketplaceController, LearningController],
  providers: [
    { provide: OpportunitiesService, useValue: opportunities },
    { provide: MarketplaceService, useValue: marketplace },
    { provide: LearningService, useValue: learning },
  ],
})
class AuthorTestModule {}

describe('author id on create, update and delete', () => {
  let app: INestApplication;
  let baseUrl: string;

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-test-user': 'u-author' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  beforeAll(async () => {
    app = await NestFactory.create(AuthorTestModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementation(async (context) => authGuard.canActivate(context));
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['opportunities', opportunities],
    ['marketplace', marketplace],
    ['learning', learning],
  ])('/%s hands the signed-in user to the service', async (root, service) => {
    await call('POST', `/${root}`, { title: 'x' });
    await call('PATCH', `/${root}/r1`, { title: 'y' });
    await call('DELETE', `/${root}/r1`);
    expect(service.create).toHaveBeenCalledWith('u-author', expect.anything());
    expect(service.update).toHaveBeenCalledWith('r1', 'u-author', expect.anything(), false);
    expect(service.delete).toHaveBeenCalledWith('r1', 'u-author', false);
  });
});
