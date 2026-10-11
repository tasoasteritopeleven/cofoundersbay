import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { RolesService } from '../roles/roles.service';
import { ConnectionsService } from '../connections/connections.service';
import { MessagingService } from '../messaging/messaging.service';
import { DashboardService } from '../dashboard/dashboard.service';

export type GraphMeResponse = {
  me: {
    id: string;
    displayName: string;
    headline: string | null;
    role: string;
    location: string | null;
    avatarUrl: string | null;
    primaryRole: string | null;
    organizations: Array<{ id: string; name: string; type: string; role: string }>;
    tenants: Array<{ id: string; name: string; slug: string; role: string }>;
  };
  unreadMessages: number;
  pendingConnections: number;
  pendingIntros: number;
  unreadNotifications: number;
  readiness:
    | (Record<string, unknown> & {
        overall: number;
        lowestLabel?: string;
        lowestHref?: string;
        dimensions?: unknown[];
        lowestDimension?: { label: string; href: string } | null;
      })
    | null;
  nextAction: { id: string; label: string; href: string } | null;
};

/**
 * Thin read-only aggregation over existing domain services — the "single
 * source of truth" summary described in docs/AI_PLATFORM_UPGRADE_PLAN.md §4.
 * No new business logic: every field here is produced by a service method
 * that already backs an existing REST endpoint (roles/dashboard-context,
 * me/profile, connections, messages/conversations, dashboard/venture-readiness,
 * notifications/unread-count). This exists so a single call — the `get_graph`
 * tool in §5.1 — can answer "what does this user see right now" instead of
 * requiring N separate round-trips, and so the AI, the dashboards, and the
 * sidebar badges all read the same computation rather than three slightly
 * different ones.
 */
@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
    private readonly rolesService: RolesService,
    private readonly connectionsService: ConnectionsService,
    private readonly messagingService: MessagingService,
    private readonly dashboard: DashboardService,
  ) {}

  async getMyGraph(userId: string): Promise<GraphMeResponse> {
    const [profile, dashboardContext, pendingConnectionsResult, conversations, readiness, unreadNotifications] =
      await Promise.all([
        this.profileService.getOwnProfile(userId),
        this.rolesService.getUserDashboardContext(userId),
        this.connectionsService.listConnections(userId, 'received', 50),
        this.messagingService.listConversations(userId),
        this.dashboard.computeVentureReadiness(userId).catch((err) => {
          this.logger.debug(`Readiness unavailable for graph: ${String(err)}`);
          return null;
        }),
        this.prisma.notification.count({ where: { userId, readAt: null } }),
      ]);

    const unreadMessages = conversations.reduce(
      (sum, c) => sum + ((c as { unreadCount?: number }).unreadCount ?? 0),
      0,
    );
    const pendingConnections = pendingConnectionsResult.connections.length;
    const pendingIntros = pendingConnections;

    const nextAction =
      pendingIntros > 0
        ? { id: 'review-intros', label: 'Review pending intros', href: '/connections' }
        : unreadMessages > 0
          ? { id: 'read-messages', label: 'Catch up on unread messages', href: '/messages' }
          : unreadNotifications > 0
            ? { id: 'read-notifications', label: 'Open notifications', href: '/notifications' }
            : { id: 'review-matches', label: 'Review your matches', href: '/matches' };

    return {
      me: {
        id: userId,
        displayName: profile?.displayName ?? 'You',
        headline: profile?.headline ?? null,
        role: String(profile?.role ?? dashboardContext.primaryRole),
        location: profile?.location ?? null,
        avatarUrl: (profile as { avatarUrl?: string | null } | null)?.avatarUrl ?? null,
        primaryRole: dashboardContext.primaryRole,
        organizations: dashboardContext.organizations,
        tenants: dashboardContext.tenants,
      },
      unreadMessages,
      pendingConnections,
      pendingIntros,
      unreadNotifications,
      readiness: readiness
        ? {
            ...readiness,
            overall: readiness.overall,
            lowestLabel: readiness.lowestDimension?.label,
            lowestHref: readiness.lowestDimension?.href,
          }
        : null,
      nextAction,
    };
  }
}
