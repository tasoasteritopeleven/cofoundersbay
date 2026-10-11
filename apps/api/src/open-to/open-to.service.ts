import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  OPEN_TO_PROBLEM_COPY,
  openToActive,
  openToExpiry,
  openToShownTo,
  readOpenTo,
  type OpenToKind,
  type OpenToSignal,
  type OpenToVisibility,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';

/**
 * "Open to": a person's quiet signal that they would co-found, advise, invest
 * as an angel or mentor (rules in `@cofounderbay/shared` open-to).
 *
 * It feeds matching first. Who else sees it is the person's choice — nobody,
 * verified members, or every signed-in member — and `forViewer` is the only
 * read that answers another person, so the rule is applied in one place.
 */

type Row = { userId: string; kinds: string[]; visibility: OpenToVisibility; note: string | null; expiresAt: Date };

function shape(row: Row): OpenToSignal {
  return { kinds: row.kinds as OpenToKind[], visibility: row.visibility, note: row.note, expiresAt: row.expiresAt.toISOString() };
}

@Injectable()
export class OpenToService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VerificationService) private readonly verification: Pick<VerificationService, 'isVerified'>,
  ) {}

  async mine(userId: string, now = Date.now()) {
    const row = await this.prisma.openToSignal.findUnique({ where: { userId } });
    const signal = row ? shape(row as Row) : null;
    return { signal, active: openToActive(signal, now) };
  }

  /** Saves the signal and starts its 90 days again. */
  async set(userId: string, body: unknown, now = Date.now()) {
    const read = readOpenTo(body);
    if (!read.ok) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: read.problems.map((p) => OPEN_TO_PROBLEM_COPY[p].en).join(' '),
          details: { reason: 'open_to_invalid', problems: read.problems, messageEl: read.problems.map((p) => OPEN_TO_PROBLEM_COPY[p].el).join(' ') },
        },
      });
    }
    const expiresAt = new Date(openToExpiry(now));
    const row = await this.prisma.openToSignal.upsert({
      where: { userId },
      create: { userId, ...read.value, expiresAt },
      update: { ...read.value, expiresAt },
    });
    return { signal: shape(row as Row), active: true };
  }

  async clear(userId: string) {
    await this.prisma.openToSignal.deleteMany({ where: { userId } });
    return { signal: null, active: false };
  }

  /** What `viewerId` may see of `userId`'s signal: the kinds, or an empty list. */
  async forViewer(viewerId: string, userId: string, now = Date.now()) {
    const row = await this.prisma.openToSignal.findUnique({ where: { userId } });
    if (!row) return { kinds: [] as OpenToKind[] };
    const signal = shape(row as Row);
    const isOwner = viewerId === userId;
    const verified = !isOwner && signal.visibility === 'verified' ? await this.verification.isVerified(viewerId) : false;
    return { kinds: openToShownTo(signal, { isOwner, verified }, now) };
  }

  /** Active signals for a set of people, for ranking. Lapsed ones are left out. */
  async activeSignals(userIds: readonly string[], now = Date.now()): Promise<Map<string, OpenToSignal>> {
    if (!userIds.length) return new Map();
    const rows = await this.prisma.openToSignal.findMany({ where: { userId: { in: [...userIds] }, expiresAt: { gt: new Date(now) } } });
    return new Map(rows.map((r) => [r.userId, shape(r as Row)]));
  }

  isVerified(userId: string) {
    return this.verification.isVerified(userId);
  }
}
