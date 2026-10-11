import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Collaboration Permission Policy
// Architecture report §3 — Access Resolution Order + Action Matrix
//
// Centralises permission checks for the new collaboration primitives
// (branches, proposals, share links, version restore) so that every
// service method delegates here instead of duplicating role logic.
// ─────────────────────────────────────────────────────────────────────────────

export type CollabAction =
  | 'branch.create'
  | 'branch.update'
  | 'branch.close'
  | 'branch.read'
  | 'proposal.create'
  | 'proposal.update'
  | 'proposal.read'
  | 'review.request'
  | 'review.submit'
  | 'review.read'
  | 'share.create'
  | 'share.revoke'
  | 'share.read'
  | 'version.restore'
  | 'version.read';

const ROLE_HIERARCHY = ['viewer', 'commenter', 'editor', 'owner'] as const;
type RoleName = (typeof ROLE_HIERARCHY)[number];

/** Minimum role required per action — report §3B action matrix */
const ACTION_MIN_ROLE: Record<CollabAction, RoleName> = {
  'branch.create':    'editor',
  'branch.update':    'editor',
  'branch.close':     'editor',
  'branch.read':      'viewer',
  'proposal.create':  'editor',
  'proposal.update':  'editor',
  'proposal.read':    'viewer',
  'review.request':   'editor',
  'review.submit':    'commenter',   // reviewers get at least commenter access
  'review.read':      'viewer',
  'share.create':     'owner',
  'share.revoke':     'owner',
  'share.read':       'owner',
  'version.restore':  'editor',
  'version.read':     'viewer',
};

export interface ResolvedAccess {
  userId: string;
  workspaceId: string;
  role: RoleName;
  isOwner: boolean;
}

@Injectable()
export class BuilderCollabPolicy {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Core resolver ──────────────────────────────────────

  /**
   * Resolve user's effective role in a workspace.
   * Returns the resolved access object or throws 403/404.
   *
   * Resolution order (report §3C):
   * 1. Platform admin → full access
   * 2. Workspace owner → full access (owner)
   * 3. Active BuilderCollaborator → use role
   * 4. Public workspace + viewer action → viewer
   * 5. Default → denied
   */
  async resolve(userId: string, workspaceId: string): Promise<ResolvedAccess> {
    const workspace = await this.prisma.builderWorkspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        collaborators: {
          where: { userId, isActive: true },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Owner always gets full access
    if (workspace.ownerId === userId) {
      return { userId, workspaceId, role: 'owner', isOwner: true };
    }

    // Check platform admin (User.role in ['admin', 'super_admin'])
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      return { userId, workspaceId, role: 'owner', isOwner: false };
    }

    // Active collaborator
    const collab = workspace.collaborators[0];
    if (collab) {
      return {
        userId,
        workspaceId,
        role: collab.role as RoleName,
        isOwner: false,
      };
    }

    // Public workspace → viewer
    if (workspace.visibility === 'public') {
      return { userId, workspaceId, role: 'viewer', isOwner: false };
    }

    throw new ForbiddenException('Access denied');
  }

  // ───────────────────── Action guard ───────────────────────────────────────

  /**
   * Ensure a user has sufficient role for a given collaboration action.
   * Throws ForbiddenException if not.
   */
  async authorize(
    userId: string,
    workspaceId: string,
    action: CollabAction,
  ): Promise<ResolvedAccess> {
    const access = await this.resolve(userId, workspaceId);
    const minRole = ACTION_MIN_ROLE[action];

    if (!this.meetsMinRole(access.role, minRole)) {
      throw new ForbiddenException(
        `Insufficient permissions for ${action} (requires ${minRole}, have ${access.role})`,
      );
    }
    return access;
  }

  // ───────────────────── Document → Workspace resolver ──────────────────────

  /**
   * Resolve workspace ID from a document ID, useful when the caller
   * only has the document reference.
   */
  async resolveDocumentWorkspace(documentId: string): Promise<string> {
    const doc = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
      select: { workspaceId: true },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc.workspaceId;
  }

  /**
   * Convenience: authorize an action on a document by looking up its workspace.
   */
  async authorizeForDocument(
    userId: string,
    documentId: string,
    action: CollabAction,
  ): Promise<ResolvedAccess & { documentWorkspaceId: string }> {
    const workspaceId = await this.resolveDocumentWorkspace(documentId);
    const access = await this.authorize(userId, workspaceId, action);
    return { ...access, documentWorkspaceId: workspaceId };
  }

  // ───────────────────── Helpers ────────────────────────────────────────────

  private meetsMinRole(actual: RoleName, required: RoleName): boolean {
    return ROLE_HIERARCHY.indexOf(actual) >= ROLE_HIERARCHY.indexOf(required);
  }
}
