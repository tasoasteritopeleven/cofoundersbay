import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Tier limits — hourly AI request cap per plan
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10; // unauthenticated / free tier fallback
const UNLIMITED = Infinity;

const TIER_LIMITS: Record<string, number> = {
  free: DEFAULT_LIMIT,
  starter: DEFAULT_LIMIT,
  basic: DEFAULT_LIMIT,
  pro: 100,
  growth: 100,
  team: 500,
  business: 500,
  enterprise: UNLIMITED,
};

const WINDOW_MS = 60 * 60 * 1_000; // 1 hour sliding window

// ─────────────────────────────────────────────────────────────────────────────
// Guard
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AIRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AIRateLimitGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = req.user?.id;

    // JwtAuthGuard will reject if auth is missing — guard only checks rate
    if (!userId) return true;

    const limit = await this.getUserHourlyLimit(userId);
    if (limit === UNLIMITED) return true;

    const windowStart = new Date(Date.now() - WINDOW_MS);
    const count = await this.prisma.aIUsageLog.count({
      where: {
        userId,
        success: true,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= limit) {
      this.logger.warn(`Rate limit hit — userId=${userId} count=${count} limit=${limit}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `AI usage limit reached (${limit} requests/hour). Upgrade your plan for higher limits.`,
          limit,
          used: count,
          retryAfterSeconds: Math.ceil(WINDOW_MS / 1_000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async getUserHourlyLimit(userId: string): Promise<number> {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['active', 'trialing'] },
          currentPeriodEnd: { gte: new Date() },
        },
        select: { plan: { select: { planType: true } } },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) return DEFAULT_LIMIT;

      const planKey = subscription.plan.planType?.toString().toLowerCase() ?? 'free';
      return TIER_LIMITS[planKey] ?? DEFAULT_LIMIT;
    } catch (err) {
      this.logger.error(`Failed to resolve plan tier for userId=${userId}: ${String(err)}`);
      return DEFAULT_LIMIT; // safe default on any DB error
    }
  }
}
