import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  TRANSPARENCY_EVENT_KINDS,
  TRANSPARENCY_SURFACES,
  halfYearOf,
  parseHalfYear,
  type HalfYear,
  type TransparencyEventKind,
  type TransparencyReport,
  type TransparencySurface,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Records what the safety rules refused and reports it per half year
 * (`@cofounderbay/shared` transparency). A refusal is stored as its kind,
 * surface and time only. Recording never fails the request it describes:
 * a database without the table, or any error, is logged and ignored.
 */
@Injectable()
export class TransparencyService {
  private readonly logger = new Logger(TransparencyService.name);
  private readonly cache = new Map<string, { at: number; report: TransparencyReport }>();

  constructor(private readonly prisma: PrismaService) {}

  record(kind: TransparencyEventKind, surface: TransparencySurface): void {
    void this.prisma.transparencyEvent
      .create({ data: { kind, surface } })
      .catch((err: unknown) => this.logger.debug(`Transparency event not recorded: ${String(err)}`));
  }

  /** The report for `2026-H2`, or for the current half year when none is named. */
  async report(periodKey?: string, now = new Date()): Promise<TransparencyReport> {
    const current = halfYearOf(now);
    const period: HalfYear | null = periodKey ? parseHalfYear(periodKey) : current;
    if (!period) throw new BadRequestException('period must look like 2026-H2');
    if (Date.parse(period.from) > now.getTime()) throw new BadRequestException('That period has not started');
    const inProgress = period.key === current.key;
    const cached = this.cache.get(period.key);
    // A finished period does not change; a running one is recounted every ten minutes.
    if (cached && (!inProgress || now.getTime() - cached.at < CACHE_TTL_MS)) return cached.report;

    const range = { gte: new Date(period.from), lt: new Date(period.to) };
    const [events, received, resolved, dismissed, open, blocks] = await Promise.all([
      this.prisma.transparencyEvent
        .groupBy({ by: ['kind', 'surface'], where: { createdAt: range }, _count: { _all: true } })
        .catch(() => [] as Array<{ kind: string; surface: string; _count: { _all: number } }>),
      this.prisma.report.count({ where: { createdAt: range } }),
      this.prisma.report.count({ where: { status: 'resolved', resolvedAt: range } }),
      this.prisma.report.count({ where: { status: 'dismissed', resolvedAt: range } }),
      this.prisma.report.count({ where: { createdAt: { lt: range.lt }, status: { in: ['pending', 'reviewed'] } } }),
      this.prisma.userBlock.count({ where: { createdAt: range } }).catch(() => 0),
    ]);

    const refusals = Object.fromEntries(TRANSPARENCY_EVENT_KINDS.map((k) => [k, { total: 0, bySurface: {} }])) as TransparencyReport['refusals'];
    for (const row of events) {
      if (!(TRANSPARENCY_EVENT_KINDS as readonly string[]).includes(row.kind)) continue;
      if (!(TRANSPARENCY_SURFACES as readonly string[]).includes(row.surface)) continue;
      const bucket = refusals[row.kind as TransparencyEventKind];
      const n = row._count?._all ?? 0;
      bucket.total += n;
      bucket.bySurface[row.surface as TransparencySurface] = (bucket.bySurface[row.surface as TransparencySurface] ?? 0) + n;
    }

    const report: TransparencyReport = {
      period,
      inProgress,
      refusals,
      reports: { received, resolved, dismissed, open },
      blocks,
      generatedAt: now.toISOString(),
    };
    this.cache.set(period.key, { at: now.getTime(), report });
    return report;
  }
}
