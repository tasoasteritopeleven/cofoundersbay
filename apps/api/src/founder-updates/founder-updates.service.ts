import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional, Inject } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { FounderUpdate, Prisma } from '@prisma/client';
import { FOUNDER_UPDATE_PROBLEM_COPY, readFounderUpdate } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransparencyService } from '../transparency/transparency.service';

/**
 * Follow a founder, and the updates they send the people who do.
 *
 * `UserFollow` existed in the schema with no endpoint; this module is its
 * first use. An update goes to followers (notified, up to 500 at a time) or
 * is public, in which case it also gets an unguessable token for /u/[token]
 * — the page a founder shares on LinkedIn. The public shape names the author
 * (the product is not anonymous) but carries no ids.
 */

const personSelect = { id: true, profile: { select: { displayName: true, headline: true, avatarUrl: true } } } as const;
type PersonRow = { id: string; profile: { displayName: string | null; headline: string | null; avatarUrl: string | null } | null };

function person(p: PersonRow | null | undefined) {
  return { id: p?.id ?? '', displayName: p?.profile?.displayName ?? 'Member', headline: p?.profile?.headline ?? null, avatarUrl: p?.profile?.avatarUrl ?? null };
}

function metricsOf(row: FounderUpdate): Array<{ label: string; value: string }> {
  return Array.isArray(row.metrics) ? (row.metrics as Array<{ label: string; value: string }>) : [];
}

@Injectable()
export class FounderUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() @Inject(TransparencyService) private readonly transparency?: Pick<TransparencyService, 'record'>,
  ) {}

  // ── Follow ────────────────────────────────────────────────────────────────

  async followStatus(viewerId: string, targetId: string) {
    const [following, followers] = await Promise.all([
      this.prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } }),
      this.prisma.userFollow.count({ where: { followingId: targetId } }),
    ]);
    return { following: Boolean(following), followers };
  }

  async follow(viewerId: string, targetId: string) {
    if (viewerId === targetId) throw new BadRequestException('You cannot follow yourself');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw new NotFoundException('Person not found');
    const existing = await this.prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } });
    if (!existing) {
      await this.prisma.userFollow.create({ data: { followerId: viewerId, followingId: targetId } });
      await this.notifications
        .createNotification({ userId: targetId, type: 'follow_new', title: 'Someone new follows your updates', body: null, link: '/updates' })
        .catch(() => undefined);
    }
    return this.followStatus(viewerId, targetId);
  }

  async unfollow(viewerId: string, targetId: string) {
    await this.prisma.userFollow.deleteMany({ where: { followerId: viewerId, followingId: targetId } });
    return this.followStatus(viewerId, targetId);
  }

  async following(viewerId: string) {
    const rows = await this.prisma.userFollow.findMany({
      where: { followerId: viewerId },
      include: { following: { select: personSelect } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { people: rows.map((r) => person(r.following as PersonRow)) };
  }

  // ── Updates ───────────────────────────────────────────────────────────────

  private shape(row: FounderUpdate & { author?: PersonRow | null }, viewerId: string | null) {
    return {
      id: row.id,
      author: person(row.author),
      mine: viewerId !== null && row.authorId === viewerId,
      title: row.title,
      body: row.body,
      metrics: metricsOf(row),
      asks: row.asks,
      visibility: row.visibility,
      // Only the author is told the public token.
      publicToken: viewerId !== null && row.authorId === viewerId ? row.publicToken : null,
      milestoneId: row.milestoneId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(authorId: string, body: unknown) {
    const read = readFounderUpdate(body);
    if (!read.ok) {
      if (read.problems.includes('promise')) this.transparency?.record('promise_refused', 'founder_update');
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: read.problems.map((p) => FOUNDER_UPDATE_PROBLEM_COPY[p].en).join(' '),
          details: { reason: 'update_invalid', problems: read.problems, messageEl: read.problems.map((p) => FOUNDER_UPDATE_PROBLEM_COPY[p].el).join(' ') },
        },
      });
    }
    const v = read.value;
    const row = await this.prisma.founderUpdate.create({
      data: {
        authorId,
        title: v.title,
        body: v.body,
        metrics: v.metrics as unknown as Prisma.InputJsonValue,
        asks: v.asks,
        visibility: v.visibility,
        publicToken: v.visibility === 'public' ? randomBytes(12).toString('base64url') : null,
        milestoneId: v.milestoneId,
      },
      include: { author: { select: personSelect } },
    });
    const followers = await this.prisma.userFollow.findMany({ where: { followingId: authorId }, select: { followerId: true }, take: 500 });
    const name = (row.author as PersonRow | null)?.profile?.displayName ?? 'A founder you follow';
    for (const f of followers) {
      await this.notifications
        .createNotification({ userId: f.followerId, type: 'founder_update', title: `${name}: ${row.title}`, body: row.body.slice(0, 200), link: `/updates?update=${row.id}` })
        .catch(() => undefined);
    }
    return { update: this.shape(row, authorId), notified: followers.length };
  }

  async mine(authorId: string) {
    const rows = await this.prisma.founderUpdate.findMany({ where: { authorId }, include: { author: { select: personSelect } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { updates: rows.map((r) => this.shape(r, authorId)) };
  }

  /** Updates from the people the viewer follows, newest first. */
  async feed(viewerId: string) {
    const follows = await this.prisma.userFollow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    const ids = follows.map((f) => f.followingId);
    if (!ids.length) return { updates: [] };
    const rows = await this.prisma.founderUpdate.findMany({ where: { authorId: { in: ids } }, include: { author: { select: personSelect } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { updates: rows.map((r) => this.shape(r, viewerId)) };
  }

  /**
   * One person's updates as this viewer may read them, for the Activity
   * section of a profile: the author reads every one; a follower reads what
   * went to followers and what is public; anyone else reads the public ones.
   * `following` tells the page whether follower-only updates may exist.
   */
  async byAuthor(viewerId: string, authorId: string) {
    const own = viewerId === authorId;
    const follows = own
      ? null
      : await this.prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: authorId } } });
    const where: Prisma.FounderUpdateWhereInput = own || follows ? { authorId } : { authorId, visibility: 'public' };
    const rows = await this.prisma.founderUpdate.findMany({ where, include: { author: { select: personSelect } }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { updates: rows.map((r) => this.shape(r, viewerId)), following: own ? null : Boolean(follows) };
  }

  async get(viewerId: string, id: string) {
    const row = await this.prisma.founderUpdate.findUnique({ where: { id }, include: { author: { select: personSelect } } });
    if (!row) throw new NotFoundException('Update not found');
    if (row.authorId !== viewerId && row.visibility !== 'public') {
      const follows = await this.prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: row.authorId } } });
      if (!follows) throw new NotFoundException('Update not found');
    }
    return { update: this.shape(row, viewerId) };
  }

  /** No account needed; no ids in the answer. */
  async getPublic(token: string) {
    const row = await this.prisma.founderUpdate.findUnique({ where: { publicToken: token }, include: { author: { select: personSelect } } });
    if (!row || row.visibility !== 'public') throw new NotFoundException('This update is not public');
    const { id: _id, author, mine: _mine, publicToken: _t, milestoneId: _m, ...rest } = this.shape(row, null);
    return { update: { ...rest, author: { displayName: author.displayName, headline: author.headline, avatarUrl: author.avatarUrl } } };
  }

  async setVisibility(authorId: string, id: string, visibility: unknown) {
    const row = await this.prisma.founderUpdate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Update not found');
    if (row.authorId !== authorId) throw new ForbiddenException('Only the author can change this update');
    const next = visibility === 'public' ? 'public' : 'followers';
    const updated = await this.prisma.founderUpdate.update({
      where: { id },
      data: { visibility: next, publicToken: next === 'public' ? (row.publicToken ?? randomBytes(12).toString('base64url')) : null },
      include: { author: { select: personSelect } },
    });
    return { update: this.shape(updated, authorId) };
  }

  async remove(authorId: string, id: string) {
    const row = await this.prisma.founderUpdate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Update not found');
    if (row.authorId !== authorId) throw new ForbiddenException('Only the author can delete this update');
    await this.prisma.founderUpdate.delete({ where: { id } });
    return { ok: true };
  }
}
