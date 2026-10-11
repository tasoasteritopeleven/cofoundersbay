import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const ENDPOINT_WARN_MS = 200;
const ENDPOINT_SEVERE_MS = 500;
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Endpoint timing interceptor — measures total request duration,
 * Prisma query count, and cumulative DB time per request.
 *
 * Only active in development. Logs:
 * - [PERF] for every request with timing summary
 * - [SLOW ENDPOINT] for requests exceeding 200ms
 * - [SEVERE ENDPOINT] for requests exceeding 500ms
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('PerformanceInterceptor');

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!isDev) return next.handle();

    const req = context.switchToHttp().getRequest();
    const method = req?.method ?? 'WS';
    const url = req?.url ?? context.getHandler()?.name ?? 'unknown';
    const controller = context.getClass()?.name ?? '';
    const handler = context.getHandler()?.name ?? '';

    // Reset per-request Prisma metrics
    this.prisma.resetReqMetrics();
    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => this.logTiming(method, url, controller, handler, start, 'ok'),
        error: () => this.logTiming(method, url, controller, handler, start, 'error'),
      }),
    );
  }

  private logTiming(
    method: string,
    url: string,
    controller: string,
    handler: string,
    start: number,
    status: string,
  ) {
    const totalMs = Math.round(performance.now() - start);
    const queries = this.prisma.reqQueryCount;
    const dbMs = Math.round(this.prisma.reqDbTimeMs);

    const tag = `${method} ${url}`;
    const detail = `${totalMs}ms total | ${dbMs}ms DB (${queries} queries) | ${controller}.${handler} [${status}]`;

    if (totalMs >= ENDPOINT_SEVERE_MS) {
      this.logger.error(`[SEVERE ENDPOINT] ${tag} — ${detail}`);
    } else if (totalMs >= ENDPOINT_WARN_MS) {
      this.logger.warn(`[SLOW ENDPOINT] ${tag} — ${detail}`);
    } else if (queries > 5) {
      // Flag endpoints with many queries even if total time is acceptable
      this.logger.warn(`[HIGH QUERY COUNT] ${tag} — ${detail}`);
    } else {
      this.logger.verbose(`[PERF] ${tag} — ${detail}`);
    }
  }
}
