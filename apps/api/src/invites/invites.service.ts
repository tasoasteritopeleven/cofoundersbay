import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../mailer/email-queue.service';
import { ConfigService } from '@nestjs/config';
import { isActiveReferral, referralPoints, type ReferralActivity } from '@cofounderbay/shared';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
  ) {}

  private webBaseUrl(): string {
    return this.config.get<string>('WEB_BASE_URL') ?? 'http://localhost:3000';
  }

  async getUserInvites(userId: string, options: { limit?: number; status?: string }) {
    const where: any = { senderId: userId };
    if (options.status) {
      where.status = options.status;
    }

    const invites = await this.prisma.invite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      select: {
        id: true,
        email: true,
        message: true,
        status: true,
        acceptedAt: true,
        expiresAt: true,
        createdAt: true,
        acceptedBy: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return { invites };
  }

  private readonly MONTHLY_INVITE_LIMIT = 10;

  async getInviteStats(userId: string) {
    // Calculate start of current month for quota
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalInvites, acceptedInvites, pendingInvites, thisMonthInvites] = await Promise.all([
      this.prisma.invite.count({ where: { senderId: userId } }),
      this.prisma.invite.count({ where: { senderId: userId, status: 'accepted' } }),
      this.prisma.invite.count({ where: { senderId: userId, status: 'pending' } }),
      this.prisma.invite.count({
        where: {
          senderId: userId,
          createdAt: { gte: monthStart },
          status: { in: ['pending', 'accepted'] }, // Don't count cancelled toward limit
        },
      }),
    ]);

    const remaining = Math.max(0, this.MONTHLY_INVITE_LIMIT - thisMonthInvites);
    const conversionRate = totalInvites > 0 ? (acceptedInvites / totalInvites) * 100 : 0;
    // Rewards follow confirmed activity, never a sign-up alone (shared `isActiveReferral`).
    const active = await this.activeReferrals(userId);
    const rewards = referralPoints(active);

    return {
      stats: {
        total: totalInvites,
        pending: pendingInvites,
        accepted: acceptedInvites,
        active,
        remaining,
      },
      // Legacy fields for backwards compatibility
      totalInvites,
      acceptedInvites,
      pendingInvites,
      rewards,
      conversionRate,
    };
  }

  /**
   * How many people who accepted this member's invitations have verified
   * their email and taken a first real step. Each source is read on its own
   * so a table this database lacks counts as no activity, not an error.
   */
  async activeReferrals(userId: string): Promise<number> {
    const accepted = await this.prisma.invite.findMany({
      where: { senderId: userId, status: 'accepted', acceptedById: { not: null } },
      select: { acceptedBy: { select: { id: true, emailVerified: true } } },
      take: 500,
    });
    const invitees = accepted.map((a) => a.acceptedBy).filter((u): u is { id: string; emailVerified: boolean } => !!u);
    const verified = invitees.filter((u) => u.emailVerified).map((u) => u.id);
    if (!verified.length) return 0;
    const activity = new Map<string, ReferralActivity[]>(verified.map((id) => [id, []]));
    const mark = (ids: Array<string | null | undefined>, kind: ReferralActivity) => {
      for (const id of ids) if (id && activity.has(id)) activity.get(id)!.push(kind);
    };
    const attempt = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch {
        // A source this database does not have is no activity.
      }
    };
    await Promise.all([
      attempt(async () => {
        const rows = await this.prisma.connectionRequest.findMany({
          where: { status: 'accepted', OR: [{ requesterId: { in: verified } }, { receiverId: { in: verified } }] },
          select: { requesterId: true, receiverId: true },
          take: 2000,
        });
        mark(rows.flatMap((r) => [r.requesterId, r.receiverId]), 'connection');
      }),
      attempt(async () => {
        const rows = await this.prisma.commitmentCard.findMany({ where: { ownerId: { in: verified } }, select: { ownerId: true }, take: 2000 });
        mark(rows.map((r) => r.ownerId), 'need_card');
      }),
      attempt(async () => {
        const rows = await this.prisma.milestone.findMany({ where: { ownerId: { in: verified }, status: 'completed' }, select: { ownerId: true }, take: 2000 });
        mark(rows.map((r) => r.ownerId), 'milestone');
      }),
      attempt(async () => {
        const rows = await this.prisma.commitmentThread.findMany({ where: { candidateId: { in: verified } }, select: { candidateId: true }, take: 2000 });
        mark(rows.map((r) => r.candidateId), 'interest');
      }),
    ]);
    return invitees.filter((u) => isActiveReferral({ emailVerified: u.emailVerified, activity: activity.get(u.id) ?? [] })).length;
  }

  async createInvite(userId: string, email: string, message?: string) {
    // Check if invite already exists and is pending
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        senderId: userId,
        email,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      throw new Error('An active invite for this email already exists');
    }

    // Create invite with 30-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invite = await this.prisma.invite.create({
      data: {
        senderId: userId,
        email,
        message,
        expiresAt,
      },
    });

    const inviteUrl = `${this.webBaseUrl()}/register?ref=${userId}&invite=${invite.id}`;

    await this.emailQueue.enqueueSendEmail({
      to: email,
      subject: `You've been invited to join CoFounderBay`,
      text: `You've been invited to join CoFounderBay!\n\nSign up here: ${inviteUrl}`,
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.6">
          <h2 style="margin: 0 0 12px 0; font-size: 18px;">You're Invited to CoFounderBay!</h2>
          <p style="margin: 0 0 16px 0; color: #333">
            You've been invited to join CoFounderBay,
            the premier platform for startup founders, mentors, and investors.
          </p>
          ${message ? `<p style="margin: 0 0 16px 0; color: #555; font-style: italic;">"${message}"</p>` : ''}
          <p style="margin: 0">
            <a href="${inviteUrl}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #fff; text-decoration: none; border-radius: 10px;">
              Accept Invitation
            </a>
          </p>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #999;">
            This invitation expires in 30 days.
          </p>
        </div>
      `.trim(),
    });

    return {
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        sentAt: invite.createdAt.toISOString(),
      },
    };
  }

  async cancelInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.senderId !== userId) {
      throw new Error('Invite not found or unauthorized');
    }

    if (invite.status !== 'pending') {
      throw new Error('Only pending invites can be cancelled');
    }

    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status: 'cancelled' },
    });

    return { ok: true };
  }

  async acceptInvite(inviteId: string, acceptedUserId: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.status !== 'pending') {
      throw new Error('Invite is not pending');
    }

    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.update({
        where: { id: inviteId },
        data: { status: 'expired' },
      });
      throw new Error('Invite has expired');
    }

    await this.prisma.invite.update({
      where: { id: inviteId },
      data: {
        status: 'accepted',
        acceptedById: acceptedUserId,
        acceptedAt: new Date(),
      },
    });

    return { ok: true };
  }
}
