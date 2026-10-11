import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BuilderAIService } from './builder-ai.service';
import { BuilderService } from './builder.service';
import { BuilderCollaboratorRole, BuilderDocumentType } from './dto/builder.dto';

const ownerId = 'owner-1';
const collaboratorUserId = 'collaborator-1';
const workspaceId = 'workspace-1';
const collaboratorId = 'collaborator-row-1';

describe('builder collaborator isolation', () => {
  let prisma: any;
  let cache: any;
  let service: BuilderService;

  beforeEach(() => {
    prisma = {
      builderWorkspace: {
        findUnique: vi.fn().mockResolvedValue({ ownerId, collaborators: [], visibility: 'private' }),
      },
      builderCollaborator: {
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      builderActivityLog: { create: vi.fn().mockResolvedValue({}) },
    };
    cache = { del: vi.fn().mockResolvedValue(undefined) };
    service = new BuilderService(prisma, cache);
  });

  it('does not update a collaborator row from a different workspace', async () => {
    prisma.builderCollaborator.findFirst.mockResolvedValue(null);

    await expect(service.updateCollaborator(ownerId, workspaceId, collaboratorId, {
      role: BuilderCollaboratorRole.EDITOR,
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.builderCollaborator.findFirst).toHaveBeenCalledWith({
      where: { id: collaboratorId, workspaceId },
      select: { id: true, userId: true },
    });
    expect(prisma.builderCollaborator.update).not.toHaveBeenCalled();
  });

  it('does not remove a collaborator row from a different workspace', async () => {
    prisma.builderCollaborator.findFirst.mockResolvedValue(null);

    await expect(service.removeCollaborator(ownerId, workspaceId, collaboratorId))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.builderCollaborator.findFirst).toHaveBeenCalledWith({
      where: { id: collaboratorId, workspaceId },
    });
    expect(prisma.builderCollaborator.delete).not.toHaveBeenCalled();
  });

  it('purges cached allows immediately after a role downgrade', async () => {
    let collaboratorRole: BuilderCollaboratorRole = BuilderCollaboratorRole.EDITOR;
    prisma.builderWorkspace.findUnique.mockImplementation(async ({ include }: any) => {
      const requestedUserId = include?.collaborators?.where?.userId;
      return {
        ownerId,
        visibility: 'private',
        collaborators: requestedUserId === collaboratorUserId
          ? [{ role: collaboratorRole }]
          : [],
      };
    });
    prisma.builderCollaborator.findFirst.mockResolvedValue({
      id: collaboratorId,
      userId: collaboratorUserId,
    });
    prisma.builderCollaborator.update.mockImplementation(async () => {
      collaboratorRole = BuilderCollaboratorRole.VIEWER;
      return { id: collaboratorId, userId: collaboratorUserId, role: collaboratorRole };
    });

    await (service as any).checkWorkspaceAccess(collaboratorUserId, workspaceId, 'editor');
    await service.updateCollaborator(ownerId, workspaceId, collaboratorId, {
      role: BuilderCollaboratorRole.VIEWER,
    });

    await expect((service as any).checkWorkspaceAccess(collaboratorUserId, workspaceId, 'editor'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(cache.del).toHaveBeenCalledWith(`cofounderbay:builder:workspace:${workspaceId}`);
  });
});

describe('builder AI authorization and cache isolation', () => {
  let prisma: any;
  let service: BuilderAIService;

  beforeEach(() => {
    prisma = {
      builderWorkspace: { findUnique: vi.fn() },
      builderAIGeneration: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new BuilderAIService(prisma, { get: vi.fn().mockReturnValue(undefined) } as any);
  });

  it('denies generation before cache lookup or persistence for a non-member', async () => {
    prisma.builderWorkspace.findUnique.mockResolvedValue({ ownerId, collaborators: [] });

    await expect(service.generateDocumentContent('outsider-1', {
      workspaceId,
      documentType: BuilderDocumentType.IDEA_CORE,
      context: { confidential: true },
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.builderAIGeneration.findFirst).not.toHaveBeenCalled();
    expect(prisma.builderAIGeneration.create).not.toHaveBeenCalled();
  });

  it('requires editor access for application-answer generation', async () => {
    prisma.builderWorkspace.findUnique.mockResolvedValue({
      ownerId,
      collaborators: [{ role: BuilderCollaboratorRole.VIEWER }],
    });

    await expect(service.generateApplicationAnswer(
      collaboratorUserId,
      workspaceId,
      'What problem do you solve?',
      {},
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes generation cache reads to workspace, actor, model and policy-derived hash', async () => {
    prisma.builderWorkspace.findUnique.mockResolvedValue({ ownerId, collaborators: [] });
    prisma.builderAIGeneration.findFirst.mockResolvedValue({
      response: { problem: 'Scoped response' },
      tokensUsed: 12,
      model: 'mock',
    });

    const result = await service.generateDocumentContent(ownerId, {
      workspaceId,
      documentType: BuilderDocumentType.IDEA_CORE,
      context: { confidential: true },
    });

    expect(result.content).toEqual({ problem: 'Scoped response' });
    expect(prisma.builderAIGeneration.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId,
        userId: ownerId,
        model: 'mock',
        status: 'completed',
        promptHash: expect.any(String),
      }),
      orderBy: { createdAt: 'desc' },
    });
  });
});
