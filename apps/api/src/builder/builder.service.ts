import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  WorkspaceQueryDto,
  CreateDocumentDto,
  UpdateDocumentDto,
  UpdateDocumentSectionDto,
  AddCollaboratorDto,
  UpdateCollaboratorDto,
  CreateCommentDto,
  UpdateCommentDto,
  CreateReviewDto,
  SubmitReviewDto,
  GenerateContentDto,
  AssessReadinessDto,
  UpdateReadinessCriterionDto,
  CreateApplicationDto,
  UpdateApplicationDto,
  BuilderDocumentType,
  BuilderCollaboratorRole,
  BuilderCommentStatus,
  BuilderReviewStatus,
  ReadinessDimension,
} from './dto/builder.dto';
import { createHash } from 'crypto';
import { CacheService } from '../common/cache/cache.service';

// Short-lived in-memory cache for workspace access checks (avoids redundant DB hits)
const ACCESS_CACHE_TTL_MS = 5_000;
type AccessCacheEntry = { expiresAt: number };

// Redis cache TTLs (seconds)
const WORKSPACE_CACHE_TTL = 60;
const DOCUMENT_CACHE_TTL = 60;

@Injectable()
export class BuilderService {
  private readonly accessCache = new Map<string, AccessCacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Invalidate the shared workspace snapshot before a mutation is reported as complete. */
  private async invalidateWorkspaceCache(workspaceId: string) {
    await this.cache.del(`cofounderbay:builder:workspace:${workspaceId}`);
  }

  /** Invalidate the shared document snapshot before a mutation is reported as complete. */
  private async invalidateDocumentCache(documentId: string) {
    await this.cache.del(`cofounderbay:builder:document:${documentId}`);
  }

  /**
   * A cached allow must never outlive a collaborator or visibility mutation.
   * Denials are deliberately not cached, so clearing the matching allow entries is sufficient.
   */
  private invalidateWorkspaceAccessCache(workspaceId: string, userId?: string) {
    const exactPrefix = userId ? `${userId}:${workspaceId}:` : null;

    for (const key of this.accessCache.keys()) {
      if (exactPrefix ? key.startsWith(exactPrefix) : key.includes(`:${workspaceId}:`)) {
        this.accessCache.delete(key);
      }
    }
  }

  /** Purge expired access cache entries (runs lazily on each check) */
  private pruneAccessCache() {
    const now = Date.now();
    for (const [key, entry] of this.accessCache) {
      if (entry.expiresAt <= now) this.accessCache.delete(key);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workspace Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    const slug = this.generateSlug(dto.name);

    // Check for slug uniqueness
    const existing = await this.prisma.builderWorkspace.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('A workspace with this name already exists');
    }

    const workspace = await this.prisma.builderWorkspace.create({
      data: {
        ownerId: userId,
        name: dto.name,
        slug,
        description: dto.description,
        startupName: dto.startupName,
        industry: dto.industry,
        stage: dto.stage,
        targetMarket: dto.targetMarket,
        visibility: dto.visibility || 'private',
        settings: dto.settings || {},
      },
      include: {
        owner: {
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

    // Add owner as collaborator
    await this.prisma.builderCollaborator.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'owner',
        acceptedAt: new Date(),
      },
    });

    // Log activity
    this.logActivity(workspace.id, userId, 'workspace.created', 'workspace', workspace.id);

    return this.formatWorkspaceResponse(workspace);
  }

  async getWorkspaces(userId: string, query: WorkspaceQueryDto) {
    const { status, visibility, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: any = {
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
      ],
    };

    if (status) where.status = status;
    if (visibility) where.visibility = visibility;
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { startupName: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [workspaces, total] = await Promise.all([
      this.prisma.builderWorkspace.findMany({
        where,
        include: {
          owner: {
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
          _count: {
            select: {
              documents: true,
              collaborators: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.builderWorkspace.count({ where }),
    ]);

    return {
      data: workspaces.map((w) => this.formatWorkspaceResponse(w)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  async getWorkspace(userId: string, workspaceId: string) {
    const cacheKey = `builder:workspace:${workspaceId}`;
    const workspace = await this.cache.getOrSet(
      cacheKey,
      async () => {
        const ws = await this.prisma.builderWorkspace.findUnique({
          where: { id: workspaceId },
          include: {
            owner: {
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
            documents: {
              where: { isLatest: true },
              orderBy: { createdAt: 'desc' },
            },
            collaborators: {
              where: { isActive: true },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
            readinessScores: {
              orderBy: { assessedAt: 'desc' },
              take: 6,
            },
            _count: {
              select: {
                documents: true,
                collaborators: true,
              },
            },
          },
        });
        return ws;
      },
      { ttl: WORKSPACE_CACHE_TTL },
    );

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Inline access check — avoid redundant DB query from checkWorkspaceAccess()
    if (workspace.ownerId !== userId) {
      const collaborator = (workspace.collaborators as any[]).find((c: any) => c.userId === userId);
      if (!collaborator) {
        if (workspace.visibility !== 'public') {
          throw new ForbiddenException('Access denied');
        }
      }
    }

    // Update last access (fire-and-forget)
    void this.prisma.builderCollaborator.updateMany({
      where: { workspaceId, userId },
      data: { lastAccessAt: new Date() },
    }).catch(() => {});

    return this.formatWorkspaceResponse(workspace);
  }

  async updateWorkspace(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'editor');

    const workspace = await this.prisma.builderWorkspace.update({
      where: { id: workspaceId },
      data: {
        ...dto,
        foundingDate: dto.foundingDate ? new Date(dto.foundingDate) : undefined,
      },
      include: {
        owner: {
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

    this.invalidateWorkspaceAccessCache(workspaceId);
    await this.invalidateWorkspaceCache(workspaceId);
    this.logActivity(workspaceId, userId, 'workspace.updated', 'workspace', workspaceId, { changes: dto });

    return this.formatWorkspaceResponse(workspace);
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'owner');

    await this.prisma.builderWorkspace.delete({
      where: { id: workspaceId },
    });

    this.invalidateWorkspaceAccessCache(workspaceId);
    await this.invalidateWorkspaceCache(workspaceId);
    return { success: true };
  }

  async archiveWorkspace(userId: string, workspaceId: string) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'owner');

    const workspace = await this.prisma.builderWorkspace.update({
      where: { id: workspaceId },
      data: {
        status: 'archived',
        archivedAt: new Date(),
      },
    });

    this.invalidateWorkspaceAccessCache(workspaceId);
    await this.invalidateWorkspaceCache(workspaceId);
    this.logActivity(workspaceId, userId, 'workspace.archived', 'workspace', workspaceId);

    return this.formatWorkspaceResponse(workspace);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Document Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async createDocument(userId: string, dto: CreateDocumentDto) {
    await this.checkWorkspaceAccess(userId, dto.workspaceId, 'editor');

    // Get template content if provided
    let content = dto.content || this.getDefaultDocumentContent(dto.type);

    if (dto.templateId) {
      const template = await this.prisma.builderTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (template) {
        content = template.content as Record<string, any>;
        await this.prisma.builderTemplate.update({
          where: { id: dto.templateId },
          data: { usageCount: { increment: 1 } },
        });
      }
    }

    const document = await this.prisma.builderDocument.create({
      data: {
        workspaceId: dto.workspaceId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        content,
        contentSchema: '1.0',
        lastEditedById: userId,
      },
      include: {
        sections: true,
      },
    });

    // Create default sections based on document type
    await this.createDefaultSections(document.id, dto.type);

    await this.invalidateWorkspaceCache(dto.workspaceId);
    this.logActivity(dto.workspaceId, userId, 'document.created', 'document', document.id);

    return document;
  }

  async getDocument(userId: string, documentId: string) {
    // Slim query: core document + sections + counts only.
    // Comments and reviews are lazy-loaded via dedicated endpoints.
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
      include: {
        workspace: {
          select: {
            id: true,
            ownerId: true,
            name: true,
            slug: true,
            visibility: true,
          },
        },
        sections: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            comments: true,
            reviews: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'viewer');

    return document;
  }

  async updateDocument(userId: string, documentId: string, dto: UpdateDocumentDto) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'editor');

    // Create version snapshot before update
    if (dto.content) {
      await this.prisma.builderDocumentVersion.create({
        data: {
          documentId,
          version: document.version,
          content: document.content as any,
          changedById: userId,
        },
      });
    }

    const updated = await this.prisma.builderDocument.update({
      where: { id: documentId },
      data: {
        ...dto,
        version: dto.content ? { increment: 1 } : undefined,
        lastEditedById: userId,
      },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    await this.invalidateDocumentCache(documentId);
    await this.invalidateWorkspaceCache(document.workspaceId);
    this.logActivity(document.workspaceId, userId, 'document.updated', 'document', documentId, { changes: dto });

    return updated;
  }

  async updateDocumentSection(userId: string, documentId: string, sectionKey: string, dto: UpdateDocumentSectionDto) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'editor');

    const section = await this.prisma.builderDocumentSection.upsert({
      where: {
        documentId_sectionKey: {
          documentId,
          sectionKey,
        },
      },
      update: dto,
      create: {
        documentId,
        sectionKey,
        sectionTitle: dto.sectionTitle || sectionKey,
        content: dto.content || {},
        isComplete: dto.isComplete || false,
        confidence: dto.confidence,
      },
    });

    // Update document completion percentage
    await this.updateDocumentCompletion(documentId);

    await this.invalidateDocumentCache(documentId);
    this.logActivity(document.workspaceId, userId, 'section.updated', 'section', section.id);

    return section;
  }

  async deleteDocument(userId: string, documentId: string) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'editor');

    await this.prisma.builderDocument.delete({
      where: { id: documentId },
    });

    await this.invalidateDocumentCache(documentId);
    await this.invalidateWorkspaceCache(document.workspaceId);
    this.logActivity(document.workspaceId, userId, 'document.deleted', 'document', documentId);

    return { success: true };
  }

  async getDocumentVersions(userId: string, documentId: string) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'viewer');

    return this.prisma.builderDocumentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Collaborator Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async addCollaborator(userId: string, workspaceId: string, dto: AddCollaboratorDto) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'owner');

    // Check if already a collaborator
    const existing = await this.prisma.builderCollaborator.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: dto.userId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a collaborator');
    }

    const collaborator = await this.prisma.builderCollaborator.create({
      data: {
        workspaceId,
        userId: dto.userId,
        role: dto.role,
        invitedById: userId,
        notifyOnComments: dto.notifyOnComments ?? true,
        notifyOnChanges: dto.notifyOnChanges ?? false,
        notifyOnReviews: dto.notifyOnReviews ?? true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
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

    this.invalidateWorkspaceAccessCache(workspaceId, dto.userId);
    await this.invalidateWorkspaceCache(workspaceId);
    this.logActivity(workspaceId, userId, 'collaborator.added', 'collaborator', collaborator.id);

    return collaborator;
  }

  async updateCollaborator(userId: string, workspaceId: string, collaboratorId: string, dto: UpdateCollaboratorDto) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'owner');

    const existing = await this.prisma.builderCollaborator.findFirst({
      where: { id: collaboratorId, workspaceId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('Collaborator not found');
    }

    const collaborator = await this.prisma.builderCollaborator.update({
      where: { id: collaboratorId },
      data: dto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
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

    this.invalidateWorkspaceAccessCache(workspaceId, existing.userId);
    await this.invalidateWorkspaceCache(workspaceId);

    return collaborator;
  }

  async removeCollaborator(userId: string, workspaceId: string, collaboratorId: string) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'owner');

    const collaborator = await this.prisma.builderCollaborator.findFirst({
      where: { id: collaboratorId, workspaceId },
    });

    if (!collaborator) {
      throw new NotFoundException('Collaborator not found');
    }

    if (collaborator.role === 'owner') {
      throw new ForbiddenException('Cannot remove workspace owner');
    }

    await this.prisma.builderCollaborator.delete({
      where: { id: collaboratorId },
    });

    this.invalidateWorkspaceAccessCache(workspaceId, collaborator.userId);
    await this.invalidateWorkspaceCache(workspaceId);
    this.logActivity(workspaceId, userId, 'collaborator.removed', 'collaborator', collaboratorId);

    return { success: true };
  }

  async getCollaborators(userId: string, workspaceId: string) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'viewer');

    return this.prisma.builderCollaborator.findMany({
      where: { workspaceId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { invitedAt: 'asc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Comment Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async createComment(userId: string, dto: CreateCommentDto) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: dto.documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'commenter');

    const comment = await this.prisma.builderComment.create({
      data: {
        documentId: dto.documentId,
        authorId: userId,
        body: dto.body,
        sectionKey: dto.sectionKey,
        anchorText: dto.anchorText,
        anchorStart: dto.anchorStart,
        anchorEnd: dto.anchorEnd,
        parentId: dto.parentId,
      },
      include: {
        author: {
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

    this.logActivity(document.workspaceId, userId, 'comment.created', 'comment', comment.id);

    return comment;
  }

  async updateComment(userId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.builderComment.findUnique({
      where: { id: commentId },
      include: { document: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Only author can edit body, but editors can resolve
    if (dto.body && comment.authorId !== userId) {
      throw new ForbiddenException('Only comment author can edit');
    }

    if (dto.status) {
      await this.checkWorkspaceAccess(userId, comment.document.workspaceId, 'editor');
    }

    return this.prisma.builderComment.update({
      where: { id: commentId },
      data: {
        ...dto,
        resolvedById: dto.status === 'resolved' ? userId : undefined,
        resolvedAt: dto.status === 'resolved' ? new Date() : undefined,
      },
      include: {
        author: {
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
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.builderComment.findUnique({
      where: { id: commentId },
      include: { document: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      await this.checkWorkspaceAccess(userId, comment.document.workspaceId, 'owner');
    }

    await this.prisma.builderComment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }

  async getDocumentComments(userId: string, documentId: string) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'viewer');

    return this.prisma.builderComment.findMany({
      where: { documentId, parentId: null },
      include: {
        author: {
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
        replies: {
          include: {
            author: {
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
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Review Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async createReview(userId: string, dto: CreateReviewDto) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: dto.documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'editor');

    const review = await this.prisma.builderReview.create({
      data: {
        documentId: dto.documentId,
        requestedById: userId,
        reviewerId: dto.reviewerId,
        title: dto.title,
        instructions: dto.instructions,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        requestedBy: {
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
        reviewer: {
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

    this.logActivity(document.workspaceId, userId, 'review.requested', 'review', review.id);

    // TODO: Send notification to reviewer

    return review;
  }

  async submitReview(userId: string, reviewId: string, dto: SubmitReviewDto) {
    const review = await this.prisma.builderReview.findUnique({
      where: { id: reviewId },
      include: { document: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.reviewerId !== userId) {
      throw new ForbiddenException('Only assigned reviewer can submit review');
    }

    const updated = await this.prisma.builderReview.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        feedback: dto.feedback,
        rating: dto.rating,
        completedAt: new Date(),
      },
      include: {
        requestedBy: {
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
        reviewer: {
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

    this.logActivity(review.document.workspaceId, userId, 'review.submitted', 'review', reviewId);

    return updated;
  }

  async getDocumentReviews(userId: string, documentId: string) {
    const document = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.checkWorkspaceAccess(userId, document.workspaceId, 'viewer');

    return this.prisma.builderReview.findMany({
      where: { documentId },
      include: {
        requestedBy: {
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
        reviewer: {
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
      orderBy: { requestedAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Readiness Assessment
  // ─────────────────────────────────────────────────────────────────────────────

  async assessReadiness(userId: string, dto: AssessReadinessDto) {
    await this.checkWorkspaceAccess(userId, dto.workspaceId, 'viewer');

    const dimensions = [...new Set(dto.dimensions ?? Object.values(ReadinessDimension))];
    if (!dimensions.length || dimensions.some((dimension) => !Object.values(ReadinessDimension).includes(dimension))) {
      throw new BadRequestException('Select at least one valid readiness dimension');
    }
    const weights: Record<ReadinessDimension, { accelerator: number; investor: number }> = {
      team: { accelerator: 25, investor: 30 },
      market: { accelerator: 20, investor: 25 },
      product: { accelerator: 20, investor: 20 },
      business: { accelerator: 15, investor: 15 },
      funding: { accelerator: 10, investor: 5 },
      execution: { accelerator: 10, investor: 5 },
    };
    const results: any[] = [];
    let lastAssessedAt: Date | null = null;

    for (const dimension of dimensions) {
      // Get existing scores or create new assessment
      const existingScore = await this.prisma.builderReadinessScore.findFirst({
        where: { workspaceId: dto.workspaceId, dimension },
        orderBy: { version: 'desc' },
      });

      const criteria = Array.isArray(existingScore?.criteria)
        ? existingScore.criteria
        : this.getReadinessCriteria(dimension);
      const score = existingScore?.score ?? 0;
      const maxScore = existingScore && existingScore.maxScore > 0 ? existingScore.maxScore : 100;
      const status = this.getReadinessStatus((score / maxScore) * 100);
      const assessedAt = existingScore?.assessedAt ?? null;
      if (assessedAt && (!lastAssessedAt || assessedAt > lastAssessedAt)) {
        lastAssessedAt = assessedAt;
      }

      results.push({
        id: existingScore?.id ?? null,
        workspaceId: dto.workspaceId,
        dimension,
        score,
        maxScore,
        status,
        criteria,
        recommendations: this.generateRecommendations(dimension, criteria),
        assessedAt,
      });
    }

    const overallScore = Math.round(results.reduce((sum, r) => sum + (r.score / r.maxScore) * 100, 0) / results.length);
    const weightedScore = (audience: 'accelerator' | 'investor') => Math.round(
      results.reduce((sum, r) => sum + (r.score / r.maxScore) * weights[r.dimension as ReadinessDimension][audience], 0)
      / dimensions.reduce((sum, dimension) => sum + weights[dimension][audience], 0) * 100,
    );
    const overallStatus = this.getReadinessStatus(overallScore);
    const readinessLevel = this.getReadinessLevel(overallScore);
    const assessment = {
      overallScore,
      overallMax: 100,
      dimensions: results,
      lastAssessedAt,
      acceleratorReadiness: weightedScore('accelerator'),
      investorReadiness: weightedScore('investor'),
    };

    return {
      workspaceId: dto.workspaceId,
      overallScore,
      overallStatus,
      readinessLevel,
      dimensions: results,
      blockers: results.filter((r) => r.status === 'critical').map((r) => `${r.dimension} needs immediate attention`),
      nextMilestones: results.flatMap((r) => r.recommendations).slice(0, 5),
      assessedAt: new Date(),
      assessment,
    };
  }

  async updateReadinessCriterion(userId: string, workspaceId: string, dto: UpdateReadinessCriterionDto) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'editor');

    // Get current score
    let score = await this.prisma.builderReadinessScore.findFirst({
      where: { workspaceId, dimension: dto.dimension },
      orderBy: { version: 'desc' },
    });

    const criteria = Array.isArray(score?.criteria) ? score.criteria : this.getReadinessCriteria(dto.dimension);
    if (!criteria.some((criterion: any) => criterion.id === dto.criterionId)) {
      throw new BadRequestException('Readiness criterion not found');
    }
    
    // Update criterion
    const updatedCriteria = criteria.map((c: any) => {
      if (c.id === dto.criterionId) {
        return { ...c, completed: dto.completed, evidence: dto.evidence };
      }
      return c;
    });

    // Calculate new score
    const newScore = updatedCriteria.reduce((sum: number, c: any) => sum + (c.completed ? c.weight : 0), 0);
    const status = this.getReadinessStatus(newScore);

    if (score) {
      // Update existing
      score = await this.prisma.builderReadinessScore.update({
        where: { id: score.id },
        data: {
          criteria: updatedCriteria,
          score: newScore,
          status,
          assessedById: userId,
          assessedAt: new Date(),
        },
      });
    } else {
      // Create new
      score = await this.prisma.builderReadinessScore.create({
        data: {
          workspaceId,
          dimension: dto.dimension,
          criteria: updatedCriteria,
          score: newScore,
          status,
          assessedById: userId,
        },
      });
    }

    this.logActivity(workspaceId, userId, 'readiness.updated', 'readiness', score.id);

    return score;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Application Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async createApplication(userId: string, dto: CreateApplicationDto) {
    await this.checkWorkspaceAccess(userId, dto.workspaceId, 'editor');

    const application = await this.prisma.builderApplication.create({
      data: {
        workspaceId: dto.workspaceId,
        templateType: dto.templateType,
        templateName: dto.templateName,
        answers: {},
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });

    this.logActivity(dto.workspaceId, userId, 'application.created', 'application', application.id);

    return application;
  }

  async updateApplication(userId: string, applicationId: string, dto: UpdateApplicationDto) {
    const application = await this.prisma.builderApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.checkWorkspaceAccess(userId, application.workspaceId, 'editor');

    // Merge answers
    const currentAnswers = application.answers as Record<string, string>;
    const newAnswers = dto.answers ? { ...currentAnswers, ...dto.answers } : currentAnswers;

    // Calculate completion
    const template = await this.getApplicationTemplate(application.templateType);
    const requiredQuestions = template.questions.filter((q: any) => q.required);
    const answeredRequired = requiredQuestions.filter((q: any) => newAnswers[q.id]?.trim());
    const completionPercent = Math.round((answeredRequired.length / requiredQuestions.length) * 100);

    return this.prisma.builderApplication.update({
      where: { id: applicationId },
      data: {
        answers: newAnswers,
        status: dto.status,
        completionPercent,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        submissionUrl: dto.submissionUrl,
        submittedAt: dto.status === 'submitted' ? new Date() : undefined,
      },
    });
  }

  async getApplications(userId: string, workspaceId: string) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'viewer');

    return this.prisma.builderApplication.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplication(userId: string, applicationId: string) {
    const application = await this.prisma.builderApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    await this.checkWorkspaceAccess(userId, application.workspaceId, 'viewer');

    const template = await this.getApplicationTemplate(application.templateType);

    return {
      ...application,
      template,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Activity Log
  // ─────────────────────────────────────────────────────────────────────────────

  async getWorkspaceActivity(userId: string, workspaceId: string, limit = 50) {
    await this.checkWorkspaceAccess(userId, workspaceId, 'viewer');

    return this.prisma.builderActivityLog.findMany({
      where: { workspaceId },
      include: {
        user: {
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
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async checkWorkspaceAccess(userId: string, workspaceId: string, requiredRole: string) {
    // Check short-lived in-memory cache to avoid redundant DB queries
    this.pruneAccessCache();
    const cacheKey = `${userId}:${workspaceId}:${requiredRole}`;
    if (this.accessCache.has(cacheKey)) return;

    const workspace = await this.prisma.builderWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        collaborators: {
          where: { userId, isActive: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Owner always has access
    if (workspace.ownerId === userId) {
      this.accessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
      return;
    }

    const collaborator = workspace.collaborators[0];
    if (!collaborator) {
      // Check if workspace is public
      if (workspace.visibility === 'public' && requiredRole === 'viewer') {
        this.accessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
        return;
      }
      throw new ForbiddenException('Access denied');
    }

    const roleHierarchy = ['viewer', 'commenter', 'editor', 'owner'];
    const userRoleIndex = roleHierarchy.indexOf(collaborator.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      throw new ForbiddenException('Insufficient permissions');
    }

    this.accessCache.set(cacheKey, { expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${base}-${suffix}`;
  }

  private formatWorkspaceResponse(workspace: any) {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      logoUrl: workspace.logoUrl,
      status: workspace.status,
      visibility: workspace.visibility,
      startupName: workspace.startupName,
      industry: workspace.industry,
      stage: workspace.stage,
      targetMarket: workspace.targetMarket,
      foundingDate: workspace.foundingDate,
      settings: workspace.settings,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: workspace.owner
        ? {
            id: workspace.owner.id,
            displayName: workspace.owner.profile?.displayName || 'Unknown',
            avatarUrl: workspace.owner.profile?.avatarUrl,
          }
        : undefined,
      documentCount: workspace._count?.documents,
      collaboratorCount: workspace._count?.collaborators,
      documents: workspace.documents,
      collaborators: workspace.collaborators,
      readinessScores: workspace.readinessScores,
    };
  }

  private logActivity(
    workspaceId: string,
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: any,
  ) {
    // Fire-and-forget: never block the response waiting for activity log writes
    void this.prisma.builderActivityLog.create({
      data: {
        workspaceId,
        userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    }).catch(() => {});
  }

  private getDefaultDocumentContent(type: BuilderDocumentType): Record<string, any> {
    const defaults: Record<string, any> = {
      idea_core: {
        problem: '',
        solution: '',
        targetCustomer: '',
        uniqueValue: '',
        assumptions: [],
        painPoints: [],
      },
      business_model_canvas: {
        customerSegments: [],
        valuePropositions: [],
        channels: [],
        customerRelationships: [],
        revenueStreams: [],
        keyResources: [],
        keyActivities: [],
        keyPartnerships: [],
        costStructure: [],
      },
      market_analysis: {
        tam: { value: 0, description: '' },
        sam: { value: 0, description: '' },
        som: { value: 0, description: '' },
        competitors: [],
        icp: {},
        personas: [],
        trends: [],
        positioning: {},
      },
      pitch_deck: {
        slides: [],
        deckType: 'investor',
      },
      mvp_plan: {
        scope: '',
        features: [],
        sprints: [],
        teamGaps: [],
        risks: [],
        successCriteria: [],
      },
      financial_plan: {
        startupCosts: [],
        operatingCosts: [],
        revenueStreams: [],
        fundingRounds: [],
        unitEconomics: {},
        scenarios: [],
      },
    };

    return defaults[type] || {};
  }

  private async createDefaultSections(documentId: string, type: BuilderDocumentType) {
    const sectionDefs: Record<string, { key: string; title: string }[]> = {
      business_model_canvas: [
        { key: 'customer_segments', title: 'Customer Segments' },
        { key: 'value_propositions', title: 'Value Propositions' },
        { key: 'channels', title: 'Channels' },
        { key: 'customer_relationships', title: 'Customer Relationships' },
        { key: 'revenue_streams', title: 'Revenue Streams' },
        { key: 'key_resources', title: 'Key Resources' },
        { key: 'key_activities', title: 'Key Activities' },
        { key: 'key_partnerships', title: 'Key Partnerships' },
        { key: 'cost_structure', title: 'Cost Structure' },
      ],
      market_analysis: [
        { key: 'market_sizing', title: 'Market Sizing (TAM/SAM/SOM)' },
        { key: 'competitors', title: 'Competitive Landscape' },
        { key: 'icp', title: 'Ideal Customer Profile' },
        { key: 'personas', title: 'Customer Personas' },
        { key: 'trends', title: 'Market Trends' },
        { key: 'positioning', title: 'Positioning' },
      ],
    };

    const sections = sectionDefs[type] || [];

    for (let i = 0; i < sections.length; i++) {
      await this.prisma.builderDocumentSection.create({
        data: {
          documentId,
          sectionKey: sections[i].key,
          sectionTitle: sections[i].title,
          sortOrder: i,
          content: {},
        },
      });
    }
  }

  private async updateDocumentCompletion(documentId: string) {
    const sections = await this.prisma.builderDocumentSection.findMany({
      where: { documentId },
    });

    if (sections.length === 0) return;

    const completedCount = sections.filter((s) => s.isComplete).length;
    const completionPercent = Math.round((completedCount / sections.length) * 100);

    await this.prisma.builderDocument.update({
      where: { id: documentId },
      data: { completionPercent },
    });
  }

  private getReadinessCriteria(dimension: ReadinessDimension): any[] {
    const criteria: Record<string, any[]> = {
      team: [
        { id: 't1', name: 'Co-founder identified', description: 'Have you found a co-founder or core team?', completed: false, weight: 25 },
        { id: 't2', name: 'Complementary skills', description: 'Does your team have complementary skills?', completed: false, weight: 20 },
        { id: 't3', name: 'Full-time commitment', description: 'Is at least one founder full-time?', completed: false, weight: 20 },
        { id: 't4', name: 'Equity agreement', description: 'Have you agreed on equity split?', completed: false, weight: 15 },
        { id: 't5', name: 'Advisors/mentors', description: 'Do you have advisors or mentors?', completed: false, weight: 10 },
        { id: 't6', name: 'Hiring plan', description: 'Do you have a hiring plan?', completed: false, weight: 10 },
      ],
      market: [
        { id: 'm1', name: 'Problem validated', description: 'Have you validated the problem exists?', completed: false, weight: 25 },
        { id: 'm2', name: 'Customer interviews', description: 'Have you conducted 20+ customer interviews?', completed: false, weight: 20 },
        { id: 'm3', name: 'Market size defined', description: 'Have you defined TAM/SAM/SOM?', completed: false, weight: 15 },
        { id: 'm4', name: 'ICP defined', description: 'Have you defined your ideal customer profile?', completed: false, weight: 15 },
        { id: 'm5', name: 'Competitive analysis', description: 'Have you analyzed competitors?', completed: false, weight: 15 },
        { id: 'm6', name: 'Pricing validated', description: 'Have you validated pricing with customers?', completed: false, weight: 10 },
      ],
      product: [
        { id: 'p1', name: 'MVP defined', description: 'Have you defined your MVP scope?', completed: false, weight: 20 },
        { id: 'p2', name: 'Core features built', description: 'Are core features built or in progress?', completed: false, weight: 25 },
        { id: 'p3', name: 'User testing', description: 'Have you conducted user testing?', completed: false, weight: 20 },
        { id: 'p4', name: 'Technical architecture', description: 'Is technical architecture defined?', completed: false, weight: 15 },
        { id: 'p5', name: 'Launch plan', description: 'Do you have a launch plan?', completed: false, weight: 10 },
        { id: 'p6', name: 'Metrics defined', description: 'Have you defined success metrics?', completed: false, weight: 10 },
      ],
      business: [
        { id: 'b1', name: 'Revenue model defined', description: 'Have you defined your revenue model?', completed: false, weight: 25 },
        { id: 'b2', name: 'Unit economics', description: 'Do you understand your unit economics?', completed: false, weight: 20 },
        { id: 'b3', name: 'BMC completed', description: 'Have you completed a Business Model Canvas?', completed: false, weight: 15 },
        { id: 'b4', name: 'Financial projections', description: 'Do you have financial projections?', completed: false, weight: 15 },
        { id: 'b5', name: 'Go-to-market strategy', description: 'Do you have a go-to-market strategy?', completed: false, weight: 15 },
        { id: 'b6', name: 'Partnerships identified', description: 'Have you identified key partnerships?', completed: false, weight: 10 },
      ],
      funding: [
        { id: 'f1', name: 'Pitch deck ready', description: 'Do you have an investor-ready pitch deck?', completed: false, weight: 25 },
        { id: 'f2', name: 'Funding strategy', description: 'Have you defined your funding strategy?', completed: false, weight: 20 },
        { id: 'f3', name: 'Investor list', description: 'Do you have a target investor list?', completed: false, weight: 15 },
        { id: 'f4', name: 'Legal structure', description: 'Is your legal structure in place?', completed: false, weight: 15 },
        { id: 'f5', name: 'Data room', description: 'Do you have a data room prepared?', completed: false, weight: 15 },
        { id: 'f6', name: 'Runway calculated', description: 'Have you calculated your runway needs?', completed: false, weight: 10 },
      ],
      execution: [
        { id: 'e1', name: 'Milestones defined', description: 'Have you defined clear milestones?', completed: false, weight: 20 },
        { id: 'e2', name: 'Sprint planning', description: 'Do you have a sprint/iteration process?', completed: false, weight: 15 },
        { id: 'e3', name: 'Tools & infrastructure', description: 'Are your tools and infrastructure set up?', completed: false, weight: 15 },
        { id: 'e4', name: 'Communication cadence', description: 'Do you have regular team communication?', completed: false, weight: 15 },
        { id: 'e5', name: 'Decision-making process', description: 'Is your decision-making process clear?', completed: false, weight: 15 },
        { id: 'e6', name: 'Risk management', description: 'Have you identified and planned for risks?', completed: false, weight: 20 },
      ],
    };

    return criteria[dimension] || [];
  }

  private getReadinessStatus(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'needs-work';
    return 'critical';
  }

  private getReadinessLevel(score: number): string {
    if (score >= 80) return 'scale';
    if (score >= 60) return 'growth';
    if (score >= 40) return 'mvp';
    if (score >= 20) return 'validation';
    return 'idea';
  }

  private generateRecommendations(dimension: ReadinessDimension, criteria: any[]): string[] {
    return criteria
      .filter((c) => !c.completed)
      .slice(0, 3)
      .map((c) => `Complete: ${c.name}`);
  }

  private async getApplicationTemplate(templateType: string): Promise<any> {
    // Check database first
    const dbTemplate = await this.prisma.builderApplicationTemplate.findFirst({
      where: { templateType: templateType as any, isActive: true },
    });

    if (dbTemplate) {
      return dbTemplate;
    }

    // Return default templates
    const templates: Record<string, any> = {
      yc: {
        name: 'Y Combinator',
        questions: [
          { id: 'yc1', question: 'Describe what your company does in 50 characters or less.', maxLength: 50, required: true },
          { id: 'yc2', question: 'What is your company going to make?', maxLength: 500, required: true },
          { id: 'yc3', question: 'Where do you live now?', required: true },
          { id: 'yc4', question: 'How long have the founders known one another?', required: true },
          { id: 'yc5', question: 'Why did you pick this idea to work on?', maxLength: 500, required: true },
          { id: 'yc6', question: "What's new about what you're making?", maxLength: 500, required: true },
          { id: 'yc7', question: 'Who are your competitors?', maxLength: 500, required: true },
          { id: 'yc8', question: 'How do or will you make money?', maxLength: 500, required: true },
          { id: 'yc9', question: 'How will you get users?', maxLength: 500, required: true },
        ],
      },
      techstars: {
        name: 'Techstars',
        questions: [
          { id: 'ts1', question: 'What does your company do?', maxLength: 100, required: true },
          { id: 'ts2', question: 'What problem are you solving?', maxLength: 500, required: true },
          { id: 'ts3', question: 'What is your solution?', maxLength: 500, required: true },
          { id: 'ts4', question: 'What is your business model?', maxLength: 300, required: true },
          { id: 'ts5', question: 'What traction do you have?', maxLength: 500, required: true },
        ],
      },
    };

    return templates[templateType] || { name: 'Custom', questions: [] };
  }
}
