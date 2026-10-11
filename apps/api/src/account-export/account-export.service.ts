import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const EXPORT_SECTIONS = ['profile', 'messages', 'connections', 'activity', 'milestones', 'settings'] as const;
export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export type AccountExport = {
  format: 'cofounderbay-export-v1';
  exportedAt: string;
  userId: string;
  sections: ExportSection[];
  /** Parts that could not be read, named rather than silently left out. */
  unavailable: Array<{ section: ExportSection; part: string; reason: string }>;
  data: Partial<Record<ExportSection, unknown>>;
};

/** Caps keep one request bounded; each capped list says so in `truncated`. */
const LIMIT = 5000;

/**
 * The reader's own data, assembled when they ask for it.
 *
 * /settings/data-export promised a download, but its requests went to a
 * route that did not exist, so no export was ever produced. Exports are
 * built on request and never stored, which is why there is no job, no
 * status and no download link to expire: the response is the file.
 *
 * Only data the account owns or took part in is included. Credentials never
 * are: password hash, refresh and reset tokens, the 2FA secret and backup
 * codes. Messages are the ones the reader sent - other people's messages are
 * theirs. A table this database does not have (several models are
 * schema-only, see AGENTS.md) is reported in `unavailable` instead of
 * failing the whole export or quietly dropping the part.
 */
@Injectable()
export class AccountExportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, requested: readonly string[] | undefined): Promise<AccountExport> {
    const sections = normaliseSections(requested);
    const unavailable: AccountExport['unavailable'] = [];
    const data: AccountExport['data'] = {};

    const read = async <T>(section: ExportSection, part: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        unavailable.push({ section, part, reason: error instanceof Error ? error.message.split('\n')[0].slice(0, 200) : 'unreadable' });
        return null;
      }
    };
    const capped = <T>(rows: T[] | null) => (rows ? { items: rows, truncated: rows.length >= LIMIT } : null);

    if (sections.includes('profile')) {
      const user = await read('profile', 'account', () =>
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, slug: true, role: true, emailVerified: true, hasCompletedOnboarding: true, twoFactorEnabled: true, lastSeenAt: true, createdAt: true, updatedAt: true },
        }),
      );
      const profile = await read('profile', 'profile', () =>
        this.prisma.profile.findUnique({
          where: { userId },
          select: {
            displayName: true, headline: true, bio: true, location: true, timezone: true, languages: true, avatarUrl: true,
            rolePayload: true, tagline: true, website: true, mission: true, industry: true, focus: true, size: true, createdAt: true, updatedAt: true,
            skills: { select: { skill: { select: { name: true } } } },
          },
        }),
      );
      const { skills, ...profileFields } = (profile ?? {}) as { skills?: Array<{ skill?: { name?: string } | null }> } & Record<string, unknown>;
      data.profile = {
        account: user,
        profile: profile ? profileFields : null,
        skills: (skills ?? []).map((s) => s.skill?.name).filter(Boolean),
      };
    }

    if (sections.includes('messages')) {
      const sent = await read('messages', 'sent', () =>
        this.prisma.message.findMany({
          where: { senderId: userId, deletedAt: null },
          select: { id: true, conversationId: true, body: true, createdAt: true, editedAt: true, readAt: true },
          orderBy: { createdAt: 'asc' },
          take: LIMIT,
        }),
      );
      data.messages = { sent: capped(sent) };
    }

    if (sections.includes('connections')) {
      const rows = await read('connections', 'requests', () =>
        this.prisma.connectionRequest.findMany({
          where: { OR: [{ requesterId: userId }, { receiverId: userId }] },
          select: {
            id: true, requesterId: true, receiverId: true, message: true, status: true, respondedAt: true, createdAt: true,
            requester: { select: { profile: { select: { displayName: true } } } },
            receiver: { select: { profile: { select: { displayName: true } } } },
          },
          orderBy: { createdAt: 'asc' },
          take: LIMIT,
        }),
      );
      data.connections = capped(
        rows?.map((c) => {
          const sentByMe = c.requesterId === userId;
          return {
            id: c.id,
            direction: sentByMe ? 'sent' : 'received',
            otherUserId: sentByMe ? c.receiverId : c.requesterId,
            otherDisplayName: (sentByMe ? c.receiver : c.requester)?.profile?.displayName ?? null,
            status: c.status,
            message: c.message,
            createdAt: c.createdAt,
            respondedAt: c.respondedAt,
          };
        }) ?? null,
      );
    }

    if (sections.includes('activity')) {
      const [rsvps, groups, bookings, endorsementsGiven, endorsementsReceived, saved, notifications] = await Promise.all([
        read('activity', 'eventRsvps', () => this.prisma.eventRsvp.findMany({ where: { userId }, select: { eventId: true, status: true, createdAt: true, checkedInAt: true, event: { select: { title: true, startAt: true } } }, take: LIMIT })),
        read('activity', 'groupMemberships', () => this.prisma.groupMember.findMany({ where: { userId }, select: { groupId: true, role: true, joinedAt: true, group: { select: { name: true } } }, take: LIMIT })),
        read('activity', 'mentorBookings', () => this.prisma.mentorBooking.findMany({ where: { OR: [{ mentorId: userId }, { menteeId: userId }] }, select: { id: true, mentorId: true, menteeId: true, startAt: true, endAt: true, meetingType: true, notes: true, status: true, createdAt: true }, take: LIMIT })),
        read('activity', 'endorsementsGiven', () => this.prisma.endorsement.findMany({ where: { fromUserId: userId }, select: { id: true, toUserId: true, skill: true, content: true, relationship: true, isApproved: true, createdAt: true }, take: LIMIT })),
        read('activity', 'endorsementsReceived', () => this.prisma.endorsement.findMany({ where: { toUserId: userId }, select: { id: true, fromUserId: true, skill: true, content: true, relationship: true, isApproved: true, createdAt: true }, take: LIMIT })),
        read('activity', 'savedProfiles', () => this.prisma.savedProfile.findMany({ where: { savedById: userId }, select: { userId: true, note: true, createdAt: true }, take: LIMIT })),
        read('activity', 'notifications', () => this.prisma.notification.findMany({ where: { userId }, select: { type: true, title: true, body: true, link: true, createdAt: true, readAt: true }, orderBy: { createdAt: 'desc' }, take: LIMIT })),
      ]);
      // Commitments: the cards they wrote (never the share token, which is a
      // credential for the public link), the ladders they took part in from
      // either side, and only the messages and terms they wrote themselves.
      const [needCards, commitmentThreads, commitmentMessages, commitmentTerms] = await Promise.all([
        read('activity', 'needCards', () => this.prisma.commitmentCard.findMany({ where: { ownerId: userId }, select: { id: true, kind: true, title: true, exists: true, goal: true, missing: true, offerRole: true, offerEquity: true, offerHours: true, offerScope: true, category: true, place: true, isRemote: true, stage: true, commitment: true, projectRef: true, version: true, history: true, status: true, closedReason: true, settledAt: true, expiresAt: true, createdAt: true, updatedAt: true }, take: LIMIT })),
        read('activity', 'commitmentThreads', () => this.prisma.commitmentThread.findMany({ where: { OR: [{ candidateId: userId }, { card: { ownerId: userId } }] }, select: { id: true, cardId: true, candidateId: true, step: true, note: true, cardVersion: true, ownerConfirmedAt: true, candidateConfirmedAt: true, revisions: true, dealRoomActive: true, agreedAt: true, closedReason: true, closedAt: true, createdAt: true }, take: LIMIT })),
        read('activity', 'commitmentMessagesSent', () => this.prisma.commitmentMessage.findMany({ where: { authorId: userId }, select: { id: true, threadId: true, body: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: LIMIT })),
        read('activity', 'commitmentTermsProposed', () => this.prisma.commitmentTerms.findMany({ where: { proposedById: userId }, select: { threadId: true, version: true, role: true, equityPct: true, vestingMonths: true, cliffMonths: true, hoursPerWeek: true, scope: true, note: true, createdAt: true }, take: LIMIT })),
      ]);
      data.activity = {
        eventRsvps: capped(rsvps),
        groupMemberships: capped(groups),
        mentorBookings: capped(bookings),
        endorsementsGiven: capped(endorsementsGiven),
        endorsementsReceived: capped(endorsementsReceived),
        savedProfiles: capped(saved),
        notifications: capped(notifications),
        needCards: capped(needCards),
        commitmentThreads: capped(commitmentThreads),
        commitmentMessagesSent: capped(commitmentMessages),
        commitmentTermsProposed: capped(commitmentTerms),
      };
    }

    if (sections.includes('milestones')) {
      const rows = await read('milestones', 'milestones', () =>
        this.prisma.milestone.findMany({
          where: { OR: [{ ownerId: userId }, { collaboratorId: userId }] },
          select: { id: true, ownerId: true, collaboratorId: true, title: true, description: true, status: true, priority: true, category: true, dueDate: true, completedAt: true, progress: true, notes: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: LIMIT,
        }),
      );
      data.milestones = capped(rows);
    }

    if (sections.includes('settings')) {
      const profile = await read('settings', 'visibility', () =>
        this.prisma.profile.findUnique({ where: { userId }, select: { visibilityRules: true } }),
      );
      const user = await read('settings', 'security', () =>
        this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true, emailVerified: true, googleId: true, linkedinId: true } }),
      );
      data.settings = {
        visibilityRules: profile?.visibilityRules ?? null,
        twoFactorEnabled: user?.twoFactorEnabled ?? null,
        emailVerified: user?.emailVerified ?? null,
        // Whether a provider is linked, not its account id.
        linkedAccounts: user ? { google: Boolean(user.googleId), linkedin: Boolean(user.linkedinId) } : null,
      };
    }

    return { format: 'cofounderbay-export-v1', exportedAt: new Date().toISOString(), userId, sections, unavailable, data };
  }
}

/** Unknown names are dropped; none (or none left) means everything. */
export function normaliseSections(requested: readonly string[] | undefined): ExportSection[] {
  const wanted = (requested ?? []).map((s) => s.trim()).filter((s): s is ExportSection => (EXPORT_SECTIONS as readonly string[]).includes(s));
  return wanted.length ? EXPORT_SECTIONS.filter((s) => wanted.includes(s)) : [...EXPORT_SECTIONS];
}
