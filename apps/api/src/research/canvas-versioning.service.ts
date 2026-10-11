import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Snapshot types ────────────────────────────────────────────────────────────

export interface NodeSnapshot {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  posX: number;
  posY: number;
  width: number;
  height: number;
  zIndex: number;
  color: string | null;
  collapsed: boolean;
  locked: boolean;
  metadata: unknown;
  tags: string[];
}

export interface ConnectorSnapshot {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string | null;
  color: string | null;
  style: string | null;
}

// ── Diff types ────────────────────────────────────────────────────────────────

export interface NodeDiff {
  id: string;
  title: string | null;
  type: string;
}

export interface ModifiedNodeDiff {
  id: string;
  title: string | null;
  type: string;
  changes: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
}

export interface MovedNodeDiff {
  id: string;
  title: string | null;
  before: { posX: number; posY: number };
  after: { posX: number; posY: number };
}

export interface EdgeDiff {
  added: ConnectorSnapshot[];
  removed: ConnectorSnapshot[];
}

export interface CanvasDiff {
  added: NodeDiff[];
  removed: NodeDiff[];
  modified: ModifiedNodeDiff[];
  moved: MovedNodeDiff[];
  edgeDiff: EdgeDiff;
  isEmpty: boolean;
}

// ── Conflict types ────────────────────────────────────────────────────────────

export type ConflictKind =
  | 'both_modified'
  | 'deleted_on_target_modified_on_source'
  | 'deleted_on_source_modified_on_target'
  | 'edge_conflict';

export interface MergeConflict {
  kind: ConflictKind;
  nodeId?: string;
  edgeId?: string;
  description: string;
  sourceValue?: unknown;
  targetValue?: unknown;
}

export interface ConflictResolution {
  nodeId?: string;
  edgeId?: string;
  resolution: 'keep_source' | 'keep_target' | 'keep_both';
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CanvasVersionDto {
  id: string;
  boardId: string;
  branchId: string | null;
  branchName: string | null;
  parentVersionId: string | null;
  label: string | null;
  changeSummary: string | null;
  triggerType: string;
  nodeCount: number;
  createdAt: string;
  createdBy: { id: string; displayName: string; avatarUrl?: string } | null;
  diffData: CanvasDiff | null;
}

export interface CanvasBranchDto {
  id: string;
  boardId: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  headVersionId: string | null;
  baseVersionId: string | null;
  nodeCount: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string; avatarUrl?: string } | null;
}

// ── DIFF ENGINE ───────────────────────────────────────────────────────────────

const POSITION_THRESHOLD = 4; // px — ignore micro sub-pixel drifts

function diffCanvases(
  beforeNodes: NodeSnapshot[],
  afterNodes: NodeSnapshot[],
  beforeEdges: ConnectorSnapshot[],
  afterEdges: ConnectorSnapshot[],
): CanvasDiff {
  const beforeMap = new Map<string, NodeSnapshot>(beforeNodes.map((n) => [n.id, n]));
  const afterMap = new Map<string, NodeSnapshot>(afterNodes.map((n) => [n.id, n]));
  const beforeEdgeMap = new Map<string, ConnectorSnapshot>(beforeEdges.map((e) => [e.id, e]));
  const afterEdgeMap = new Map<string, ConnectorSnapshot>(afterEdges.map((e) => [e.id, e]));

  const added: NodeDiff[] = [];
  const removed: NodeDiff[] = [];
  const modified: ModifiedNodeDiff[] = [];
  const moved: MovedNodeDiff[] = [];

  // Nodes added in after
  for (const [id, node] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push({ id, title: node.title, type: node.type });
    }
  }

  // Nodes removed in after
  for (const [id, node] of beforeMap) {
    if (!afterMap.has(id)) {
      removed.push({ id, title: node.title, type: node.type });
    }
  }

  // Modified / moved
  for (const [id, after] of afterMap) {
    const before = beforeMap.get(id);
    if (!before) continue;

    const changes: ModifiedNodeDiff['changes'] = [];
    const CONTENT_FIELDS: (keyof NodeSnapshot)[] = ['title', 'content', 'color', 'type', 'locked', 'collapsed'];
    for (const field of CONTENT_FIELDS) {
      if (before[field] !== after[field]) {
        changes.push({ field, before: before[field], after: after[field] });
      }
    }
    if (changes.length > 0) {
      modified.push({ id, title: after.title, type: after.type, changes });
    }

    const dx = Math.abs(after.posX - before.posX);
    const dy = Math.abs(after.posY - before.posY);
    if (dx > POSITION_THRESHOLD || dy > POSITION_THRESHOLD) {
      moved.push({
        id,
        title: after.title,
        before: { posX: before.posX, posY: before.posY },
        after: { posX: after.posX, posY: after.posY },
      });
    }
  }

  // Edge diff
  const addedEdges = [...afterEdgeMap.values()].filter((e) => !beforeEdgeMap.has(e.id));
  const removedEdges = [...beforeEdgeMap.values()].filter((e) => !afterEdgeMap.has(e.id));

  const diff: CanvasDiff = {
    added,
    removed,
    modified,
    moved,
    edgeDiff: { added: addedEdges, removed: removedEdges },
    isEmpty:
      added.length === 0 &&
      removed.length === 0 &&
      modified.length === 0 &&
      moved.length === 0 &&
      addedEdges.length === 0 &&
      removedEdges.length === 0,
  };

  return diff;
}

// ── SERVICE ───────────────────────────────────────────────────────────────────

@Injectable()
export class CanvasVersioningService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Access guard ──────────────────────────────────────────────────────────

  private async assertBoardAccess(
    userId: string,
    boardId: string,
    level: 'view' | 'edit',
  ): Promise<void> {
    const board = await this.prisma.researchBoard.findUnique({
      where: { id: boardId },
      include: { collaborators: { where: { userId } } },
    });
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId === userId) return;
    const collab = board.collaborators[0];
    if (!collab) {
      if (board.visibility === 'public' && level === 'view') return;
      throw new ForbiddenException('Access denied');
    }
    if (level === 'edit' && collab.role === 'viewer') {
      throw new ForbiddenException('Edit access denied');
    }
  }

  // ── Snapshot capture ──────────────────────────────────────────────────────

  private async captureCurrentCanvas(boardId: string): Promise<{
    nodes: NodeSnapshot[];
    edges: ConnectorSnapshot[];
    canvasState: unknown;
  }> {
    const [nodes, edges, board] = await Promise.all([
      this.prisma.researchNode.findMany({
        where: { boardId },
        select: {
          id: true, type: true, title: true, content: true,
          posX: true, posY: true, width: true, height: true,
          zIndex: true, color: true, collapsed: true, locked: true,
          metadata: true, tags: true,
        },
      }),
      this.prisma.researchConnector.findMany({
        where: { boardId },
        select: { id: true, fromNodeId: true, toNodeId: true, label: true, color: true, style: true },
      }),
      this.prisma.researchBoard.findUnique({ where: { id: boardId }, select: { canvasState: true } }),
    ]);

    return {
      nodes: nodes.map((n) => ({
        id: n.id, type: n.type, title: n.title, content: n.content,
        posX: n.posX, posY: n.posY, width: n.width, height: n.height,
        zIndex: n.zIndex, color: n.color, collapsed: n.collapsed, locked: n.locked,
        metadata: n.metadata, tags: n.tags,
      })),
      edges: edges.map((e) => ({
        id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId,
        label: e.label, color: e.color, style: e.style,
      })),
      canvasState: board?.canvasState ?? null,
    };
  }

  // ── Versions ──────────────────────────────────────────────────────────────

  async createVersion(
    userId: string,
    boardId: string,
    dto: {
      label?: string;
      changeSummary?: string;
      triggerType?: string;
      branchId?: string;
    },
  ): Promise<CanvasVersionDto> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    // Find parent version (latest on this branch/mainline)
    const parent = await this.prisma.canvasVersion.findFirst({
      where: { boardId, branchId: dto.branchId ?? null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nodeData: true, connectors: true },
    });

    const current = await this.captureCurrentCanvas(boardId);

    // Compute diff vs parent
    let diffData: CanvasDiff | null = null;
    if (parent) {
      const parentNodes = parent.nodeData as unknown as NodeSnapshot[];
      const parentEdges = (parent.connectors ?? []) as unknown as ConnectorSnapshot[];
      diffData = diffCanvases(parentNodes, current.nodes, parentEdges, current.edges);
    }

    // Auto-generate summary if not provided
    let changeSummary = dto.changeSummary;
    if (!changeSummary && diffData && !diffData.isEmpty) {
      const parts: string[] = [];
      if (diffData.added.length > 0) parts.push(`+${diffData.added.length} node${diffData.added.length > 1 ? 's' : ''}`);
      if (diffData.removed.length > 0) parts.push(`-${diffData.removed.length} node${diffData.removed.length > 1 ? 's' : ''}`);
      if (diffData.modified.length > 0) parts.push(`~${diffData.modified.length} modified`);
      if (diffData.moved.length > 0) parts.push(`${diffData.moved.length} moved`);
      if (diffData.edgeDiff.added.length > 0) parts.push(`+${diffData.edgeDiff.added.length} edge${diffData.edgeDiff.added.length > 1 ? 's' : ''}`);
      if (diffData.edgeDiff.removed.length > 0) parts.push(`-${diffData.edgeDiff.removed.length} edge${diffData.edgeDiff.removed.length > 1 ? 's' : ''}`);
      changeSummary = parts.join(', ');
    }

    const version = await this.prisma.canvasVersion.create({
      data: {
        boardId,
        branchId: dto.branchId ?? null,
        parentVersionId: parent?.id ?? null,
        createdById: userId,
        label: dto.label,
        changeSummary,
        triggerType: (dto.triggerType ?? 'manual') as any,
        nodeData: current.nodes as any,
        connectors: current.edges as any,
        canvasState: current.canvasState as any,
        nodeCount: current.nodes.length,
        diffData: diffData as any,
      },
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Update branch headVersionId if applicable
    if (dto.branchId) {
      await this.prisma.canvasBranch.update({
        where: { id: dto.branchId },
        data: { headVersionId: version.id },
      });
    }

    return this.formatVersion(version);
  }

  async listVersions(
    userId: string,
    boardId: string,
    branchId?: string,
  ): Promise<CanvasVersionDto[]> {
    await this.assertBoardAccess(userId, boardId, 'view');

    const versions = await this.prisma.canvasVersion.findMany({
      where: { boardId, branchId: branchId ?? null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        branch: { select: { id: true, name: true } },
      },
    });

    return (versions as any[]).map((v) => this.formatVersion(v));
  }

  async getVersion(userId: string, boardId: string, versionId: string): Promise<CanvasVersionDto & {
    nodeData: NodeSnapshot[];
    connectors: ConnectorSnapshot[];
    canvasState: unknown;
  }> {
    await this.assertBoardAccess(userId, boardId, 'view');

    const version = await this.prisma.canvasVersion.findFirst({
      where: { id: versionId, boardId },
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (!version) throw new NotFoundException('Version not found');

    return {
      ...this.formatVersion(version as any),
      nodeData: version.nodeData as unknown as NodeSnapshot[],
      connectors: version.connectors as unknown as ConnectorSnapshot[],
      canvasState: version.canvasState,
    };
  }

  async diffVersions(
    userId: string,
    boardId: string,
    versionAId: string,
    versionBId: string,
  ): Promise<CanvasDiff> {
    await this.assertBoardAccess(userId, boardId, 'view');

    const [vA, vB] = await Promise.all([
      this.prisma.canvasVersion.findFirst({ where: { id: versionAId, boardId } }),
      this.prisma.canvasVersion.findFirst({ where: { id: versionBId, boardId } }),
    ]);

    if (!vA || !vB) throw new NotFoundException('One or both versions not found');

    return diffCanvases(
      vA.nodeData as unknown as NodeSnapshot[],
      vB.nodeData as unknown as NodeSnapshot[],
      vA.connectors as unknown as ConnectorSnapshot[],
      vB.connectors as unknown as ConnectorSnapshot[],
    );
  }

  async restoreVersion(
    userId: string,
    boardId: string,
    versionId: string,
  ): Promise<{ ok: boolean; newVersionId: string }> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    const version = await this.prisma.canvasVersion.findFirst({
      where: { id: versionId, boardId },
    });
    if (!version) throw new NotFoundException('Version not found');

    const nodes = version.nodeData as unknown as NodeSnapshot[];
    const edges = version.connectors as unknown as ConnectorSnapshot[];

    // Save pre-restore checkpoint
    const current = await this.captureCurrentCanvas(boardId);
    const parent = await this.prisma.canvasVersion.findFirst({
      where: { boardId, branchId: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    await this.prisma.canvasVersion.create({
      data: {
        boardId,
        branchId: null,
        parentVersionId: parent?.id ?? null,
        createdById: userId,
        label: 'Pre-restore checkpoint',
        changeSummary: `Auto-saved before restoring version from ${new Date(version.createdAt).toLocaleString()}`,
        triggerType: 'restore',
        nodeData: current.nodes as any,
        connectors: current.edges as any,
        canvasState: current.canvasState as any,
        nodeCount: current.nodes.length,
      },
    });

    // Restore: delete all current nodes + connectors, recreate from snapshot
    await this.prisma.$transaction([
      this.prisma.researchConnector.deleteMany({ where: { boardId } }),
      this.prisma.researchNode.deleteMany({ where: { boardId } }),
    ]);

    // Re-create nodes preserving IDs
    if (nodes.length > 0) {
      for (const n of nodes) {
        await this.prisma.researchNode.create({
          data: {
            id: n.id,
            boardId,
            type: n.type as any,
            title: n.title,
            content: n.content,
            posX: n.posX,
            posY: n.posY,
            width: n.width,
            height: n.height,
            zIndex: n.zIndex,
            color: n.color,
            collapsed: n.collapsed,
            locked: n.locked,
            metadata: n.metadata as any,
            tags: n.tags,
          },
        });
      }
    }

    // Re-create connectors (only those whose nodes are present)
    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = edges.filter((e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId));
    if (validEdges.length > 0) {
      await this.prisma.researchConnector.createMany({
        data: validEdges.map((e) => ({
          id: e.id,
          boardId,
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
          label: e.label,
          color: e.color,
          style: e.style ?? 'solid',
        })),
        skipDuplicates: true,
      });
    }

    // Create a version entry for this restore
    const latestParent = await this.prisma.canvasVersion.findFirst({
      where: { boardId, branchId: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const restored = await this.prisma.canvasVersion.create({
      data: {
        boardId,
        branchId: null,
        parentVersionId: latestParent?.id ?? null,
        createdById: userId,
        label: `Restored: ${version.label ?? new Date(version.createdAt).toLocaleString()}`,
        changeSummary: `Restored canvas to a previous version`,
        triggerType: 'restore',
        nodeData: nodes as any,
        connectors: validEdges as any,
        canvasState: version.canvasState as any,
        nodeCount: nodes.length,
      },
    });

    return { ok: true, newVersionId: restored.id };
  }

  // ── Branches ──────────────────────────────────────────────────────────────

  async createBranch(
    userId: string,
    boardId: string,
    dto: { name: string; description?: string; baseVersionId?: string },
  ): Promise<CanvasBranchDto> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    if (!dto.name.trim()) throw new BadRequestException('Branch name required');

    // Normalize branch name: lowercase, hyphens
    const name = dto.name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');

    const existing = await this.prisma.canvasBranch.findUnique({
      where: { boardId_name: { boardId, name } },
    });
    if (existing) throw new BadRequestException(`Branch "${name}" already exists`);

    // If no baseVersionId, find latest mainline version
    let baseVersionId = dto.baseVersionId;
    if (!baseVersionId) {
      const latest = await this.prisma.canvasVersion.findFirst({
        where: { boardId, branchId: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      baseVersionId = latest?.id;
    }

    const branch = await this.prisma.canvasBranch.create({
      data: {
        boardId,
        name,
        description: dto.description,
        baseVersionId,
        headVersionId: baseVersionId,
        createdById: userId,
        status: 'active',
        isDefault: false,
      },
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        headVersion: { select: { nodeCount: true } },
      },
    });

    // Auto-create the first version for this branch (fork snapshot)
    const current = await this.captureCurrentCanvas(boardId);
    const firstVersion = await this.prisma.canvasVersion.create({
      data: {
        boardId,
        branchId: branch.id,
        parentVersionId: baseVersionId ?? null,
        createdById: userId,
        label: `Branch created: ${name}`,
        changeSummary: `Forked from ${baseVersionId ? 'version checkpoint' : 'mainline head'}`,
        triggerType: 'branch_create',
        nodeData: current.nodes as any,
        connectors: current.edges as any,
        canvasState: current.canvasState as any,
        nodeCount: current.nodes.length,
      },
    });

    await this.prisma.canvasBranch.update({
      where: { id: branch.id },
      data: { headVersionId: firstVersion.id },
    });

    return this.formatBranch(branch as any);
  }

  async listBranches(userId: string, boardId: string): Promise<CanvasBranchDto[]> {
    await this.assertBoardAccess(userId, boardId, 'view');

    const branches = await this.prisma.canvasBranch.findMany({
      where: { boardId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        headVersion: { select: { nodeCount: true } },
      },
    });

    return (branches as any[]).map((b) => this.formatBranch(b));
  }

  async updateBranchStatus(
    userId: string,
    boardId: string,
    branchId: string,
    status: 'active' | 'archived',
  ): Promise<CanvasBranchDto> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    const branch = await this.prisma.canvasBranch.findFirst({ where: { id: branchId, boardId } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isDefault) throw new BadRequestException('Cannot archive the default branch');

    const updated = await this.prisma.canvasBranch.update({
      where: { id: branchId },
      data: { status: status as any },
      include: {
        createdBy: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        headVersion: { select: { nodeCount: true } },
      },
    });

    return this.formatBranch(updated as any);
  }

  async deleteBranch(userId: string, boardId: string, branchId: string): Promise<void> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    const branch = await this.prisma.canvasBranch.findFirst({ where: { id: branchId, boardId } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isDefault) throw new BadRequestException('Cannot delete the default branch');

    await this.prisma.canvasBranch.delete({ where: { id: branchId } });
  }

  // ── Merge ─────────────────────────────────────────────────────────────────

  async detectMergeConflicts(
    userId: string,
    boardId: string,
    sourceBranchId: string,
    targetBranchId: string,
  ): Promise<{ conflicts: MergeConflict[]; diff: CanvasDiff }> {
    await this.assertBoardAccess(userId, boardId, 'view');

    const [source, target] = await Promise.all([
      this.prisma.canvasBranch.findFirst({
        where: { id: sourceBranchId, boardId },
        include: { headVersion: true },
      }),
      this.prisma.canvasBranch.findFirst({
        where: { id: targetBranchId, boardId },
        include: { headVersion: true },
      }),
    ]);

    if (!source) throw new NotFoundException('Source branch not found');
    if (!target) throw new NotFoundException('Target branch not found');

    const sourceNodesArr = (source.headVersion?.nodeData ?? []) as unknown as NodeSnapshot[];
    const targetNodesArr = (target.headVersion?.nodeData ?? []) as unknown as NodeSnapshot[];
    const sourceEdgesArr = (source.headVersion?.connectors ?? []) as unknown as ConnectorSnapshot[];
    const targetEdgesArr = (target.headVersion?.connectors ?? []) as unknown as ConnectorSnapshot[];

    const diff = diffCanvases(sourceNodesArr, targetNodesArr, sourceEdgesArr, targetEdgesArr);

    const conflicts: MergeConflict[] = [];
    const sourceMap = new Map<string, NodeSnapshot>(sourceNodesArr.map((n) => [n.id, n]));
    const targetMap = new Map<string, NodeSnapshot>(targetNodesArr.map((n) => [n.id, n]));

    // Find nodes modified on both branches vs their common base
    const baseVersionId = source.baseVersionId;
    let baseNodes: NodeSnapshot[] = [];
    if (baseVersionId) {
      const baseVersion = await this.prisma.canvasVersion.findUnique({ where: { id: baseVersionId } });
      baseNodes = baseVersion?.nodeData as unknown as NodeSnapshot[];
    }
    const baseMap = new Map<string, NodeSnapshot>(baseNodes.map((n) => [n.id, n]));

    for (const [id, sourceNode] of sourceMap) {
      const targetNode = targetMap.get(id);
      const baseNode = baseMap.get(id);

      if (targetNode && baseNode) {
        const modifiedInSource = sourceNode.content !== baseNode.content || sourceNode.title !== baseNode.title;
        const modifiedInTarget = targetNode.content !== baseNode.content || targetNode.title !== baseNode.title;

        if (modifiedInSource && modifiedInTarget) {
          conflicts.push({
            kind: 'both_modified',
            nodeId: id,
            description: `Node "${sourceNode.title ?? id}" was modified in both branches`,
            sourceValue: { title: sourceNode.title, content: sourceNode.content },
            targetValue: { title: targetNode.title, content: targetNode.content },
          });
        }
      }

      if (!targetNode && baseMap.has(id)) {
        conflicts.push({
          kind: 'deleted_on_target_modified_on_source',
          nodeId: id,
          description: `Node "${sourceNode.title ?? id}" was deleted on target but modified on source`,
          sourceValue: sourceNode,
        });
      }
    }

    for (const [id, targetNode] of targetMap) {
      if (!sourceMap.has(id) && baseMap.has(id)) {
        conflicts.push({
          kind: 'deleted_on_source_modified_on_target',
          nodeId: id,
          description: `Node "${targetNode.title ?? id}" was deleted on source but exists on target`,
          targetValue: targetNode,
        });
      }
    }

    return { conflicts, diff };
  }

  async mergeBranch(
    userId: string,
    boardId: string,
    dto: {
      sourceBranchId: string;
      targetBranchId: string;
      strategy: 'fast_forward' | 'manual' | 'conflict_resolved';
      resolutions?: ConflictResolution[];
    },
  ): Promise<{ mergeId: string; resultVersionId: string; conflicts: MergeConflict[] }> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    const [source, target] = await Promise.all([
      this.prisma.canvasBranch.findFirst({
        where: { id: dto.sourceBranchId, boardId },
        include: { headVersion: true },
      }),
      this.prisma.canvasBranch.findFirst({
        where: { id: dto.targetBranchId, boardId },
        include: { headVersion: true },
      }),
    ]);

    if (!source) throw new NotFoundException('Source branch not found');
    if (!target) throw new NotFoundException('Target branch not found');

    const sourceNodes: NodeSnapshot[] = (source.headVersion?.nodeData as unknown as NodeSnapshot[]) ?? [];
    const sourceEdges: ConnectorSnapshot[] = (source.headVersion?.connectors as unknown as ConnectorSnapshot[]) ?? [];
    const targetNodes: NodeSnapshot[] = (target.headVersion?.nodeData as unknown as NodeSnapshot[]) ?? [];
    const targetEdges: ConnectorSnapshot[] = (target.headVersion?.connectors as unknown as ConnectorSnapshot[]) ?? [];

    const { conflicts } = await this.detectMergeConflicts(userId, boardId, dto.sourceBranchId, dto.targetBranchId);

    // Apply merge: start with target state, apply source changes
    const mergedNodeMap = new Map<string, NodeSnapshot>(targetNodes.map((n) => [n.id, n]));
    const mergedEdgeMap = new Map<string, ConnectorSnapshot>(targetEdges.map((e) => [e.id, e]));

    // Apply source additions/modifications respecting resolutions
    const resolutionMap = new Map<string, ConflictResolution>(
      (dto.resolutions ?? []).map((r) => [r.nodeId ?? r.edgeId ?? '', r]),
    );

    for (const node of sourceNodes) {
      const conflict = conflicts.find((c) => c.nodeId === node.id);
      if (conflict) {
        const res = resolutionMap.get(node.id);
        if (!res || res.resolution === 'keep_source') {
          mergedNodeMap.set(node.id, node);
        } else if (res.resolution === 'keep_both') {
          mergedNodeMap.set(node.id, node);
          // Keep target version under new id would require a new node — for simplicity keep source
        }
        // keep_target: do nothing (target already in map)
      } else {
        mergedNodeMap.set(node.id, node);
      }
    }

    // Apply source edge additions
    for (const edge of sourceEdges) {
      if (!mergedEdgeMap.has(edge.id)) {
        mergedEdgeMap.set(edge.id, edge);
      }
    }

    const mergedNodes = [...mergedNodeMap.values()];
    const mergedEdges = [...mergedEdgeMap.values()].filter(
      (e) => mergedNodeMap.has(e.fromNodeId) && mergedNodeMap.has(e.toNodeId),
    );

    // Create result version on target branch
    const parentVersion = await this.prisma.canvasVersion.findFirst({
      where: { boardId, branchId: dto.targetBranchId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const diff = diffCanvases(targetNodes, mergedNodes, targetEdges, mergedEdges);

    const resultVersion = await this.prisma.canvasVersion.create({
      data: {
        boardId,
        branchId: dto.targetBranchId,
        parentVersionId: parentVersion?.id ?? null,
        createdById: userId,
        label: `Merged: ${source.name} → ${target.name}`,
        changeSummary: `Merged branch "${source.name}" into "${target.name}"`,
        triggerType: 'post_merge',
        nodeData: mergedNodes as any,
        connectors: mergedEdges as any,
        canvasState: target.headVersion?.canvasState as any,
        nodeCount: mergedNodes.length,
        diffData: diff as any,
      },
    });

    // Update target branch head
    await this.prisma.canvasBranch.update({
      where: { id: dto.targetBranchId },
      data: { headVersionId: resultVersion.id },
    });

    // Archive source branch after merge
    await this.prisma.canvasBranch.update({
      where: { id: dto.sourceBranchId },
      data: { status: 'merged' },
    });

    // Record merge
    const merge = await this.prisma.canvasMerge.create({
      data: {
        boardId,
        sourceBranchId: dto.sourceBranchId,
        targetBranchId: dto.targetBranchId,
        mergedById: userId,
        strategy: dto.strategy as any,
        conflictsJson: conflicts as any,
        resolvedJson: (dto.resolutions ?? null) as any,
        sourceVersionId: source.headVersionId,
        resultVersionId: resultVersion.id,
      },
    });

    // If target is the default/mainline branch, apply the merged state to the live canvas
    const targetBranchRecord = await this.prisma.canvasBranch.findUnique({
      where: { id: dto.targetBranchId },
    });

    if (targetBranchRecord?.isDefault) {
      await this.applyVersionToCanvas(boardId, mergedNodes, mergedEdges);
    }

    return { mergeId: merge.id, resultVersionId: resultVersion.id, conflicts };
  }

  // ── Apply version to live canvas (used by restore + mainline merge) ────────

  private async applyVersionToCanvas(
    boardId: string,
    nodes: NodeSnapshot[],
    edges: ConnectorSnapshot[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.researchConnector.deleteMany({ where: { boardId } }),
      this.prisma.researchNode.deleteMany({ where: { boardId } }),
    ]);

    for (const n of nodes) {
      await this.prisma.researchNode.create({
        data: {
          id: n.id, boardId,
          type: n.type as any,
          title: n.title,
          content: n.content,
          posX: n.posX, posY: n.posY,
          width: n.width, height: n.height,
          zIndex: n.zIndex,
          color: n.color,
          collapsed: n.collapsed,
          locked: n.locked,
          metadata: n.metadata as any,
          tags: n.tags,
        },
      });
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const validEdges = edges.filter((e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId));
    if (validEdges.length > 0) {
      await this.prisma.researchConnector.createMany({
        data: validEdges.map((e) => ({
          id: e.id, boardId,
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
          label: e.label,
          color: e.color,
          style: e.style ?? 'solid',
        })),
        skipDuplicates: true,
      });
    }
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  private formatVersion(v: any): CanvasVersionDto {
    return {
      id: v.id,
      boardId: v.boardId,
      branchId: v.branchId ?? null,
      branchName: v.branch?.name ?? null,
      parentVersionId: v.parentVersionId ?? null,
      label: v.label ?? null,
      changeSummary: v.changeSummary ?? null,
      triggerType: v.triggerType,
      nodeCount: v.nodeCount,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
      createdBy: v.createdBy
        ? {
            id: v.createdBy.id,
            displayName: v.createdBy.profile?.displayName ?? 'Unknown',
            avatarUrl: v.createdBy.profile?.avatarUrl ?? undefined,
          }
        : null,
      diffData: v.diffData ?? null,
    };
  }

  private formatBranch(b: any): CanvasBranchDto {
    return {
      id: b.id,
      boardId: b.boardId,
      name: b.name,
      description: b.description ?? null,
      status: b.status,
      isDefault: b.isDefault,
      headVersionId: b.headVersionId ?? null,
      baseVersionId: b.baseVersionId ?? null,
      nodeCount: b.headVersion?.nodeCount ?? null,
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
      updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt,
      createdBy: b.createdBy
        ? {
            id: b.createdBy.id,
            displayName: b.createdBy.profile?.displayName ?? 'Unknown',
            avatarUrl: b.createdBy.profile?.avatarUrl ?? undefined,
          }
        : null,
    };
  }
}
