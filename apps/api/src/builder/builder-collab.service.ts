import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BuilderCollabPolicy } from './builder-collab.policy';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateBranchDto,
  UpdateBranchDto,
  ListBranchesQueryDto,
  CreateProposalDto,
  UpdateProposalDto,
  ListProposalsQueryDto,
  RequestReviewDto,
  SubmitProposalReviewDto,
  CreateShareLinkDto,
  UpdateShareLinkDto,
  RestoreVersionDto,
} from './dto/builder-collab.dto';
import { randomBytes, createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Collaboration Service — Phase 1 + Phase 2
// Architecture report: COLLABORATION_ARCHITECTURE.md §2B, §3, §4
//
// Covers: branch CRUD, change proposal CRUD, review request/decision,
// share link CRUD, version restore, and activity logging for all of the above.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BuilderCollabService {
  private readonly logger = new Logger(BuilderCollabService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: BuilderCollabPolicy,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // A. BRANCH / DRAFT VARIANT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createBranch(userId: string, dto: CreateBranchDto) {
    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      dto.documentId,
      'branch.create',
    );

    // Fetch document + latest version
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: dto.documentId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const latestVersion = document.versions[0];
    const baseVersionId = latestVersion?.id ?? 'initial';
    const baseVersionNum = latestVersion?.version ?? document.version;
    const branchContent = latestVersion?.content ?? document.content;

    const branch = await this.prisma.artifactBranch.create({
      data: {
        documentId: dto.documentId,
        name: dto.name,
        description: dto.description,
        createdById: userId,
        baseVersionId,
        baseVersionNum,
        content: branchContent as any,
        status: 'open',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { proposals: true } },
      },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'branch.created',
      'branch',
      branch.id,
      { documentId: dto.documentId, branchName: dto.name, baseVersionNum },
    );

    this.logger.log(`Branch "${dto.name}" created on document ${dto.documentId} by ${userId}`);
    return this.formatBranchResponse(branch);
  }

  async getBranch(userId: string, branchId: string) {
    const branch = await this.prisma.artifactBranch.findUnique({
      where: { id: branchId },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { proposals: true } },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    await this.policy.authorizeForDocument(userId, branch.documentId, 'branch.read');
    return this.formatBranchResponse(branch);
  }

  async listBranches(userId: string, documentId: string, query: ListBranchesQueryDto) {
    await this.policy.authorizeForDocument(userId, documentId, 'branch.read');

    const where: any = { documentId };
    if (query.status) where.status = query.status;

    const branches = await this.prisma.artifactBranch.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { proposals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return branches.map((b) => this.formatBranchResponse(b));
  }

  async updateBranch(userId: string, branchId: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.artifactBranch.findUnique({
      where: { id: branchId },
      select: { id: true, documentId: true, status: true, createdById: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.status === 'merged' || branch.status === 'closed') {
      throw new BadRequestException(`Cannot update a ${branch.status} branch`);
    }

    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      branch.documentId,
      'branch.update',
    );

    const updated = await this.prisma.artifactBranch.update({
      where: { id: branchId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { proposals: true } },
      },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'branch.updated',
      'branch',
      branchId,
      { changes: dto },
    );

    return this.formatBranchResponse(updated);
  }

  async closeBranch(userId: string, branchId: string) {
    const branch = await this.prisma.artifactBranch.findUnique({
      where: { id: branchId },
      select: { id: true, documentId: true, status: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.status === 'merged') {
      throw new BadRequestException('Cannot close a merged branch');
    }

    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      branch.documentId,
      'branch.close',
    );

    const updated = await this.prisma.artifactBranch.update({
      where: { id: branchId },
      data: { status: 'closed' },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        _count: { select: { proposals: true } },
      },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'branch.closed',
      'branch',
      branchId,
      { documentId: branch.documentId },
    );

    return this.formatBranchResponse(updated);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // B. CHANGE PROPOSAL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createProposal(userId: string, dto: CreateProposalDto) {
    const branch = await this.prisma.artifactBranch.findUnique({
      where: { id: dto.branchId },
      select: { id: true, documentId: true, status: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.status !== 'open') {
      throw new BadRequestException(`Cannot create proposal on a ${branch.status} branch`);
    }

    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      branch.documentId,
      'proposal.create',
    );

    const proposal = await this.prisma.changeProposal.create({
      data: {
        branchId: dto.branchId,
        documentId: branch.documentId,
        title: dto.title,
        description: dto.description,
        createdById: userId,
        status: 'open',
        reviewerIds: dto.reviewerIds ?? [],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Move branch to review status
    await this.prisma.artifactBranch.update({
      where: { id: dto.branchId },
      data: { status: 'review' },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'proposal.created',
      'proposal',
      proposal.id,
      {
        branchId: dto.branchId,
        documentId: branch.documentId,
        title: dto.title,
        reviewerIds: dto.reviewerIds,
      },
    );

    this.logger.log(`Proposal "${dto.title}" created on branch ${dto.branchId} by ${userId}`);

    // Notify workspace owner + editors about the new proposal
    void this.notifyProposalCreated(documentWorkspaceId, userId, proposal);

    return this.formatProposalResponse(proposal);
  }

  async getProposal(userId: string, proposalId: string) {
    const proposal = await this.prisma.changeProposal.findUnique({
      where: { id: proposalId },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        branch: {
          select: { id: true, name: true, status: true, baseVersionNum: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    await this.policy.authorizeForDocument(userId, proposal.documentId, 'proposal.read');
    return this.formatProposalResponse(proposal);
  }

  async listProposals(userId: string, documentId: string, query: ListProposalsQueryDto) {
    await this.policy.authorizeForDocument(userId, documentId, 'proposal.read');

    const where: any = { documentId };
    if (query.status) where.status = query.status;

    const proposals = await this.prisma.changeProposal.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
        branch: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((p) => this.formatProposalResponse(p));
  }

  async updateProposal(userId: string, proposalId: string, dto: UpdateProposalDto) {
    const proposal = await this.prisma.changeProposal.findUnique({
      where: { id: proposalId },
      select: { id: true, documentId: true, status: true, createdById: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status === 'merged' || proposal.status === 'closed') {
      throw new BadRequestException(`Cannot update a ${proposal.status} proposal`);
    }

    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      proposal.documentId,
      'proposal.update',
    );

    const updated = await this.prisma.changeProposal.update({
      where: { id: proposalId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.reviewerIds !== undefined && { reviewerIds: dto.reviewerIds }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'proposal.updated',
      'proposal',
      proposalId,
      { changes: dto },
    );

    return this.formatProposalResponse(updated);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C. REVIEW REQUEST / REVIEW DECISION
  // ═══════════════════════════════════════════════════════════════════════════

  async requestReview(userId: string, dto: RequestReviewDto) {
    const proposal = await this.prisma.changeProposal.findUnique({
      where: { id: dto.proposalId },
      select: { id: true, documentId: true, branchId: true, status: true, reviewerIds: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      proposal.documentId,
      'review.request',
    );

    // Merge new reviewers with existing, deduplicated
    const existingIds = (proposal.reviewerIds ?? []) as string[];
    const mergedIds = [...new Set([...existingIds, ...dto.reviewerIds])];

    const updated = await this.prisma.changeProposal.update({
      where: { id: dto.proposalId },
      data: {
        reviewerIds: mergedIds,
        status: 'open', // Reset to open if changes were requested
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'review.requested',
      'proposal',
      dto.proposalId,
      {
        reviewerIds: dto.reviewerIds,
        message: dto.message,
        documentId: proposal.documentId,
        branchId: proposal.branchId,
      },
    );

    this.logger.log(
      `Review requested on proposal ${dto.proposalId} — reviewers: ${dto.reviewerIds.join(', ')}`,
    );

    // Notify each newly assigned reviewer
    void this.notifyReviewRequested(dto.proposalId, dto.reviewerIds, dto.message);

    return this.formatProposalResponse(updated);
  }

  async submitProposalReview(userId: string, proposalId: string, dto: SubmitProposalReviewDto) {
    const proposal = await this.prisma.changeProposal.findUnique({
      where: { id: proposalId },
      select: {
        id: true,
        documentId: true,
        branchId: true,
        status: true,
        reviewerIds: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check the user is actually an assigned reviewer OR has editor+ access
    const reviewerIds = (proposal.reviewerIds ?? []) as string[];
    const isAssignedReviewer = reviewerIds.includes(userId);

    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      proposal.documentId,
      'review.submit',
    );

    if (!isAssignedReviewer) {
      // If not assigned, need at least editor role (already checked above)
      await this.policy.authorizeForDocument(userId, proposal.documentId, 'proposal.update');
    }

    // Validate the decision
    const validDecisions = ['approved', 'changes_requested', 'closed'];
    if (!validDecisions.includes(dto.decision)) {
      throw new BadRequestException(
        `Invalid review decision: ${dto.decision}. Must be one of: ${validDecisions.join(', ')}`,
      );
    }

    const updated = await this.prisma.changeProposal.update({
      where: { id: proposalId },
      data: {
        status: dto.decision,
        ...(dto.decision === 'approved' && { mergedAt: null }), // Ready to merge
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Update branch status based on decision
    if (dto.decision === 'approved') {
      await this.prisma.artifactBranch.update({
        where: { id: proposal.branchId },
        data: { status: 'review' }, // Stays in review until explicitly merged
      });
    } else if (dto.decision === 'closed') {
      await this.prisma.artifactBranch.update({
        where: { id: proposal.branchId },
        data: { status: 'open' }, // Revert to open for rework
      });
    }

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      `review.${dto.decision}`,
      'proposal',
      proposalId,
      {
        decision: dto.decision,
        feedback: dto.feedback,
        rating: dto.rating,
        documentId: proposal.documentId,
        branchId: proposal.branchId,
      },
    );

    this.logger.log(`Review decision "${dto.decision}" submitted on proposal ${proposalId} by ${userId}`);

    // Notify proposal author of the review decision
    void this.notifyReviewDecision(proposalId, userId, dto.decision, dto.feedback);

    return this.formatProposalResponse(updated);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D. SHARE LINK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createShareLink(userId: string, dto: CreateShareLinkDto) {
    if (!dto.documentId && !dto.workspaceId) {
      throw new BadRequestException('Either documentId or workspaceId is required');
    }

    // Determine the workspace for permission check
    let workspaceId: string;
    if (dto.workspaceId) {
      workspaceId = dto.workspaceId;
    } else {
      workspaceId = await this.policy.resolveDocumentWorkspace(dto.documentId!);
    }

    await this.policy.authorize(userId, workspaceId, 'share.create');

    // Generate a secure URL-safe token
    const token = randomBytes(32).toString('base64url');

    // Hash password if provided
    const hashedPassword = dto.password
      ? createHash('sha256').update(dto.password).digest('hex')
      : undefined;

    const shareLink = await this.prisma.artifactShareLink.create({
      data: {
        documentId: dto.documentId,
        workspaceId: dto.workspaceId,
        versionId: dto.versionId,
        token,
        permissions: dto.permissions ?? 'view',
        password: hashedPassword,
        label: dto.label,
        recipientEmail: dto.recipientEmail,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        maxViews: dto.maxViews,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    this.logCollabActivity(
      workspaceId,
      userId,
      'share.created',
      'shareLink',
      shareLink.id,
      {
        documentId: dto.documentId,
        workspaceId: dto.workspaceId,
        permissions: dto.permissions ?? 'view',
        label: dto.label,
        recipientEmail: dto.recipientEmail,
      },
    );

    this.logger.log(`Share link created by ${userId} — token: ${token.substring(0, 8)}...`);
    return this.formatShareLinkResponse(shareLink);
  }

  async getShareLink(userId: string, shareLinkId: string) {
    const link = await this.prisma.artifactShareLink.findUnique({
      where: { id: shareLinkId },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const workspaceId = link.workspaceId ?? (await this.policy.resolveDocumentWorkspace(link.documentId!));
    await this.policy.authorize(userId, workspaceId, 'share.read');

    return this.formatShareLinkResponse(link);
  }

  async listShareLinks(userId: string, opts: { documentId?: string; workspaceId?: string }) {
    if (!opts.documentId && !opts.workspaceId) {
      throw new BadRequestException('Either documentId or workspaceId is required');
    }

    let workspaceId: string;
    if (opts.workspaceId) {
      workspaceId = opts.workspaceId;
    } else {
      workspaceId = await this.policy.resolveDocumentWorkspace(opts.documentId!);
    }

    await this.policy.authorize(userId, workspaceId, 'share.read');

    const where: any = {};
    if (opts.documentId) where.documentId = opts.documentId;
    if (opts.workspaceId) where.workspaceId = opts.workspaceId;

    const links = await this.prisma.artifactShareLink.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((l) => this.formatShareLinkResponse(l));
  }

  async updateShareLink(userId: string, shareLinkId: string, dto: UpdateShareLinkDto) {
    const link = await this.prisma.artifactShareLink.findUnique({
      where: { id: shareLinkId },
      select: { id: true, documentId: true, workspaceId: true },
    });

    if (!link) {
      throw new NotFoundException('Share link not found');
    }

    const workspaceId = link.workspaceId ?? (await this.policy.resolveDocumentWorkspace(link.documentId!));
    await this.policy.authorize(userId, workspaceId, 'share.revoke');

    const updated = await this.prisma.artifactShareLink.update({
      where: { id: shareLinkId },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.expiresAt !== undefined && { expiresAt: new Date(dto.expiresAt) }),
        ...(dto.maxViews !== undefined && { maxViews: dto.maxViews }),
        ...(dto.label !== undefined && { label: dto.label }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    this.logCollabActivity(
      workspaceId,
      userId,
      dto.isActive === false ? 'share.revoked' : 'share.updated',
      'shareLink',
      shareLinkId,
      { changes: dto },
    );

    return this.formatShareLinkResponse(updated);
  }

  async revokeShareLink(userId: string, shareLinkId: string) {
    return this.updateShareLink(userId, shareLinkId, { isActive: false });
  }

  /**
   * Full share access: validates token + returns document/workspace content.
   * No JWT auth required — token-based access only.
   */
  async accessShareToken(token: string, password?: string) {
    const access = await this.validateShareToken(token, password);

    let document: any = null;
    if (access.documentId) {
      document = await this.prisma.builderDocument.findUnique({
        where: { id: access.documentId },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          content: true,
          status: true,
          completionPercent: true,
          version: true,
          updatedAt: true,
          workspace: {
            select: {
              name: true,
              startupName: true,
              stage: true,
              industry: true,
              owner: {
                select: {
                  id: true,
                  profile: { select: { displayName: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      });
    }

    return {
      permissions: access.permissions,
      documentId: access.documentId,
      workspaceId: access.workspaceId,
      document: document
        ? {
            ...document,
            workspace: document.workspace
              ? {
                  name: document.workspace.name,
                  startupName: document.workspace.startupName,
                  stage: document.workspace.stage,
                  industry: document.workspace.industry,
                }
              : undefined,
            owner: document.workspace?.owner
              ? {
                  displayName: document.workspace.owner.profile?.displayName ?? 'Unknown',
                  avatarUrl: document.workspace.owner.profile?.avatarUrl,
                }
              : undefined,
          }
        : null,
    };
  }

  /**
   * Validate a share link token for external access.
   * Called by the external access endpoint — no user auth required.
   */
  async validateShareToken(token: string, password?: string) {
    const link = await this.prisma.artifactShareLink.findUnique({
      where: { token },
      select: {
        id: true,
        documentId: true,
        workspaceId: true,
        versionId: true,
        permissions: true,
        password: true,
        expiresAt: true,
        maxViews: true,
        viewCount: true,
        isActive: true,
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Share link not found or inactive');
    }

    // Check expiry
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException('Share link has expired');
    }

    // Check view limit
    if (link.maxViews !== null && link.viewCount >= link.maxViews) {
      throw new BadRequestException('Share link view limit reached');
    }

    // Check password
    if (link.password) {
      if (!password) {
        throw new BadRequestException('Password required');
      }
      const hashed = createHash('sha256').update(password).digest('hex');
      if (hashed !== link.password) {
        throw new BadRequestException('Invalid password');
      }
    }

    // Increment view count and update last accessed
    await this.prisma.artifactShareLink.update({
      where: { id: link.id },
      data: {
        viewCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    return {
      documentId: link.documentId,
      workspaceId: link.workspaceId,
      versionId: link.versionId,
      permissions: link.permissions,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // E. VERSION HISTORY + RESTORE
  // ═══════════════════════════════════════════════════════════════════════════

  async listDocumentVersions(userId: string, documentId: string) {
    await this.policy.authorizeForDocument(userId, documentId, 'version.read');

    const versions = await this.prisma.builderDocumentVersion.findMany({
      where: { documentId },
      select: {
        id: true,
        version: true,
        versionLabel: true,
        changesSummary: true,
        createdAt: true,
        changedById: true,
      },
      orderBy: { version: 'desc' },
    });

    // Batch-fetch author profiles
    const authorIds = [...new Set(versions.map(v => v.changedById).filter(Boolean) as string[])];
    const authors = authorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } },
        })
      : [];
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));

    return versions.map((v) => {
      const author = v.changedById ? authorMap[v.changedById] : null;
      return {
        id: v.id,
        version: v.version,
        versionLabel: v.versionLabel,
        changesSummary: v.changesSummary,
        createdAt: v.createdAt.toISOString(),
        changedById: v.changedById,
        changedBy: author
          ? {
              id: author.id,
              displayName: author.profile?.displayName ?? 'Unknown',
              avatarUrl: author.profile?.avatarUrl,
            }
          : null,
      };
    });
  }

  async restoreVersion(userId: string, dto: RestoreVersionDto) {
    const { documentWorkspaceId } = await this.policy.authorizeForDocument(
      userId,
      dto.documentId,
      'version.restore',
    );

    // Find target version
    const targetVersion = await this.prisma.builderDocumentVersion.findUnique({
      where: {
        documentId_version: {
          documentId: dto.documentId,
          version: dto.targetVersion,
        },
      },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Version ${dto.targetVersion} not found`);
    }

    // Get current document
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: dto.documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const newVersionNum = document.version + 1;

    // Create new version snapshot of current state (pre-restore backup)
    await this.prisma.builderDocumentVersion.create({
      data: {
        documentId: dto.documentId,
        version: newVersionNum,
        versionLabel: `Pre-restore backup (was v${document.version})`,
        content: document.content as any,
        changesSummary: `Backup before restoring to v${dto.targetVersion}`,
        changedById: userId,
      },
    });

    const restoredVersionNum = newVersionNum + 1;

    // Create restored version
    await this.prisma.builderDocumentVersion.create({
      data: {
        documentId: dto.documentId,
        version: restoredVersionNum,
        versionLabel: `Restored from v${dto.targetVersion}`,
        content: targetVersion.content as any,
        changesSummary: `Restored content from version ${dto.targetVersion}`,
        changedById: userId,
      },
    });

    // Update document with restored content
    await this.prisma.builderDocument.update({
      where: { id: dto.documentId },
      data: {
        content: targetVersion.content as any,
        version: restoredVersionNum,
        lastEditedById: userId,
      },
    });

    this.logCollabActivity(
      documentWorkspaceId,
      userId,
      'version.restored',
      'document',
      dto.documentId,
      {
        fromVersion: document.version,
        restoredVersion: dto.targetVersion,
        newVersion: restoredVersionNum,
      },
    );

    this.logger.log(
      `Document ${dto.documentId} restored to v${dto.targetVersion} (new v${restoredVersionNum}) by ${userId}`,
    );

    return {
      documentId: dto.documentId,
      previousVersion: document.version,
      restoredFromVersion: dto.targetVersion,
      newVersion: restoredVersionNum,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // G. NOTIFICATIONS (fire-and-forget)
  // ═══════════════════════════════════════════════════════════════════════════

  private async notifyProposalCreated(workspaceId: string, actorId: string, proposal: any) {
    if (!this.notifications) return;
    try {
      // Fetch workspace owner + collaborators with editor+ access
      const workspace = await this.prisma.builderWorkspace.findUnique({
        where: { id: workspaceId },
        select: {
          ownerId: true,
          name: true,
          collaborators: {
            where: { role: { in: ['owner', 'editor'] }, isActive: true },
            select: { userId: true },
          },
        },
      });
      if (!workspace) return;

      const recipientIds = new Set<string>([
        workspace.ownerId,
        ...workspace.collaborators.map((c: any) => c.userId),
      ]);
      recipientIds.delete(actorId); // Don't notify the actor

      await Promise.all(
        [...recipientIds].map((uid) =>
          this.notifications!.createNotification({
            userId: uid,
            type: 'workspace_review',
            title: `New change proposal: "${proposal.title}"`,
            body: `A change proposal was submitted in workspace "${workspace.name}".`,
            link: `/builder?workspace=${workspaceId}`,
            meta: { proposalId: proposal.id, workspaceId, actorId },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(`notifyProposalCreated failed: ${err}`);
    }
  }

  private async notifyReviewRequested(proposalId: string, reviewerIds: string[], message?: string) {
    if (!this.notifications) return;
    try {
      const proposal = await this.prisma.changeProposal.findUnique({
        where: { id: proposalId },
        select: { title: true, documentId: true },
      });
      if (!proposal) return;

      const doc = await this.prisma.builderDocument.findUnique({
        where: { id: proposal.documentId },
        select: { title: true, workspaceId: true },
      });

      await Promise.all(
        reviewerIds.map((uid) =>
          this.notifications!.createNotification({
            userId: uid,
            type: 'workspace_review',
            title: `Review requested: "${proposal.title}"`,
            body: message || `You have been asked to review a change proposal.`,
            link: doc ? `/builder?workspace=${doc.workspaceId}` : `/builder`,
            meta: { proposalId, documentId: proposal.documentId },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(`notifyReviewRequested failed: ${err}`);
    }
  }

  private async notifyReviewDecision(proposalId: string, reviewerId: string, decision: string, feedback?: string) {
    if (!this.notifications) return;
    try {
      const proposal = await this.prisma.changeProposal.findUnique({
        where: { id: proposalId },
        select: { title: true, createdById: true, documentId: true },
      });
      if (!proposal || proposal.createdById === reviewerId) return;

      const doc = await this.prisma.builderDocument.findUnique({
        where: { id: proposal.documentId },
        select: { workspaceId: true },
      });

      const decisionLabel = decision === 'approved'
        ? 'Approved ✓'
        : decision === 'changes_requested'
        ? 'Changes requested'
        : 'Closed';

      await this.notifications!.createNotification({
        userId: proposal.createdById,
        type: 'workspace_review',
        title: `Proposal "${proposal.title}": ${decisionLabel}`,
        body: feedback || `Your change proposal received a review decision.`,
        link: doc ? `/builder?workspace=${doc.workspaceId}` : `/builder`,
        meta: { proposalId, decision, reviewerId },
      });
    } catch (err) {
      this.logger.warn(`notifyReviewDecision failed: ${err}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // F. ACTIVITY LOG (reuses BuilderActivityLog)
  // ═══════════════════════════════════════════════════════════════════════════

  private logCollabActivity(
    workspaceId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: any,
  ) {
    // Fire-and-forget — never block the response waiting for activity log writes
    void this.prisma.builderActivityLog.create({
      data: {
        workspaceId,
        userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    }).catch((err) => {
      this.logger.warn(`Failed to log collab activity: ${err}`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMATTERS
  // ═══════════════════════════════════════════════════════════════════════════

  private formatBranchResponse(branch: any) {
    return {
      id: branch.id,
      documentId: branch.documentId,
      name: branch.name,
      description: branch.description,
      status: branch.status,
      baseVersionNum: branch.baseVersionNum,
      baseVersionId: branch.baseVersionId,
      mergedAt: branch.mergedAt,
      mergedById: branch.mergedById,
      mergeVersionId: branch.mergeVersionId,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
      createdBy: branch.createdBy
        ? {
            id: branch.createdBy.id,
            displayName: branch.createdBy.profile?.displayName || 'Unknown',
            avatarUrl: branch.createdBy.profile?.avatarUrl,
          }
        : undefined,
      proposalCount: branch._count?.proposals ?? 0,
    };
  }

  private formatProposalResponse(proposal: any) {
    return {
      id: proposal.id,
      branchId: proposal.branchId,
      documentId: proposal.documentId,
      title: proposal.title,
      description: proposal.description,
      status: proposal.status,
      changedSections: proposal.changedSections ?? [],
      diffSummary: proposal.diffSummary,
      reviewerIds: proposal.reviewerIds ?? [],
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      mergedAt: proposal.mergedAt,
      createdBy: proposal.createdBy
        ? {
            id: proposal.createdBy.id,
            displayName: proposal.createdBy.profile?.displayName || 'Unknown',
            avatarUrl: proposal.createdBy.profile?.avatarUrl,
          }
        : undefined,
      branch: proposal.branch,
    };
  }

  private formatShareLinkResponse(link: any) {
    return {
      id: link.id,
      documentId: link.documentId,
      workspaceId: link.workspaceId,
      versionId: link.versionId,
      token: link.token,
      permissions: link.permissions,
      label: link.label,
      recipientEmail: link.recipientEmail,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews,
      viewCount: link.viewCount,
      isActive: link.isActive,
      createdAt: link.createdAt,
      lastAccessedAt: link.lastAccessedAt,
      createdBy: link.createdBy
        ? {
            id: link.createdBy.id,
            displayName: link.createdBy.profile?.displayName || 'Unknown',
            avatarUrl: link.createdBy.profile?.avatarUrl,
          }
        : undefined,
    };
  }
}
