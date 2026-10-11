import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaService } from '../ai/ollama.service';
import { getAgent } from '../ai/agents/base-agent';

export interface CanvasNodeSnapshot {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  posX: number;
  posY: number;
}

export interface CopilotChatResult {
  message: string;
  agentId: string;
  model: string;
  fallback?: boolean;
  boardContext: { nodeCount: number; usedNodeIds: string[] };
}

export interface ExportToBuilderResult {
  documentId: string;
  documentTitle: string;
  documentType: string;
  workspaceId: string;
  sourceNodeIds: string[];
  linkedNodeIds: string[]; // nodes that were updated with builderDocumentId
}

export interface ImportToCanvasResult {
  nodeId: string;
  nodeType: string;
  title: string;
  builderDocumentId: string;
}

// Maps canvas node types (displayType) to BuilderDocument types
const CANVAS_TYPE_TO_BUILDER_TYPE: Record<string, string> = {
  swot: 'swot_analysis',
  swot_analysis: 'swot_analysis',
  pitch_deck: 'pitch_deck',
  pitch: 'pitch_deck',
  business_model: 'business_model_canvas',
  bmc: 'business_model_canvas',
  lean_canvas: 'lean_canvas',
  market_research: 'market_analysis',
  competitor: 'competitive_analysis',
  go_to_market: 'go_to_market',
  financial_plan: 'financial_plan',
  revenue_model: 'financial_plan',
  spec: 'prd',
  user_story: 'prd',
  architecture: 'technical_architecture',
  vision: 'idea_core',
  idea: 'idea_core',
  // Default for research / note types
  note: 'custom',
  document: 'custom',
  insight: 'custom',
};

// Maps BuilderDocument types to canvas node display types
const BUILDER_TYPE_TO_CANVAS_TYPE: Record<string, string> = {
  swot_analysis: 'swot',
  pitch_deck: 'pitch_deck',
  business_model_canvas: 'business_model',
  lean_canvas: 'lean_canvas',
  market_analysis: 'market_research',
  competitive_analysis: 'competitor',
  go_to_market: 'go_to_market',
  financial_plan: 'financial_plan',
  prd: 'spec',
  technical_architecture: 'architecture',
  idea_core: 'vision',
  custom: 'document',
};

@Injectable()
export class CanvasSynthesisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Access guard
  // ─────────────────────────────────────────────────────────────────────────

  private async assertBoardAccess(userId: string, boardId: string, role: 'view' | 'edit' = 'view') {
    const board = await this.prisma.researchBoard.findUnique({
      where: { id: boardId },
      select: {
        id: true, ownerId: true, visibility: true,
        collaborators: { where: { userId }, select: { role: true } },
      },
    });
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId === userId) return;
    const collab = board.collaborators[0];
    if (!collab && board.visibility !== 'public') throw new ForbiddenException('Access denied');
    if (role === 'edit' && collab?.role === 'viewer') throw new ForbiddenException('Edit access required');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Load board nodes as compact snapshots for AI context
  // ─────────────────────────────────────────────────────────────────────────

  private async loadBoardNodes(boardId: string, nodeIds?: string[]): Promise<CanvasNodeSnapshot[]> {
    const where: any = { boardId };
    if (nodeIds && nodeIds.length > 0) where.id = { in: nodeIds };

    const nodes = await this.prisma.researchNode.findMany({
      where,
      select: { id: true, type: true, title: true, content: true, metadata: true, posX: true, posY: true },
      orderBy: { createdAt: 'asc' },
    });

    return nodes.map((n) => {
      const meta = (n.metadata as Record<string, any>) || {};
      return {
        id: n.id,
        type: meta.displayType || n.type,
        title: n.title ?? '',
        content: typeof n.content === 'string' ? n.content : JSON.stringify(n.content || {}),
        metadata: meta,
        posX: n.posX,
        posY: n.posY,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas-aware copilot chat
  // ─────────────────────────────────────────────────────────────────────────

  async copilotChat(
    userId: string,
    boardId: string,
    dto: {
      agentId: string;
      message: string;
      selectedNodeIds?: string[];
      includeAllNodes?: boolean;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
  ): Promise<CopilotChatResult> {
    await this.assertBoardAccess(userId, boardId, 'view');

    // Load board context
    const nodeIds = dto.includeAllNodes ? undefined : dto.selectedNodeIds;
    const nodes = await this.loadBoardNodes(boardId, nodeIds);

    const board = await this.prisma.researchBoard.findUnique({
      where: { id: boardId },
      select: { title: true, description: true },
    });

    const agent = getAgent(dto.agentId || 'canvas-strategy');

    // Build compact canvas context (capped at 8000 chars to fit context window)
    const nodesSummary = nodes
      .slice(0, 60)
      .map((n) => `[${n.type.toUpperCase()}] "${n.title}"\n${n.content?.slice(0, 400) || '(empty)'}`)
      .join('\n\n---\n\n');

    const boardContext = `RESEARCH CANVAS: "${board?.title || 'Untitled'}"
${board?.description ? `Description: ${board.description}\n` : ''}
CANVAS NODES (${nodes.length} total${dto.selectedNodeIds?.length ? `, ${dto.selectedNodeIds.length} selected` : ''}):

${nodesSummary}`;

    const messages = agent.buildMessages(dto.message, dto.history || [], {
      userId,
      platformData: { canvasContext: boardContext.slice(0, 8000) },
    });

    let result: string;
    let usedModel = this.ollama.getDefaultModel();
    let isFallback = false;

    try {
      result = await this.ollama.chat(messages, {
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens,
      });
    } catch {
      isFallback = true;
      result = `I analyzed your canvas with ${nodes.length} nodes. While I'm temporarily unable to connect to the AI service, here's what I can see: your canvas contains ${nodes.map((n) => n.type).filter((v, i, a) => a.indexOf(v) === i).join(', ')} nodes. Please try again shortly.`;
      usedModel = 'fallback';
    }

    return {
      message: result,
      agentId: agent.config.id,
      model: isFallback ? 'fallback' : usedModel,
      fallback: isFallback,
      boardContext: { nodeCount: nodes.length, usedNodeIds: nodes.map((n) => n.id) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export canvas nodes → BuilderDocument
  // ─────────────────────────────────────────────────────────────────────────

  async exportToBuilder(
    userId: string,
    boardId: string,
    dto: {
      workspaceId: string;
      selectedNodeIds?: string[];
      documentType?: string;
      documentTitle?: string;
      linkNodes?: boolean; // update ResearchNode.builderDocumentId
    },
  ): Promise<ExportToBuilderResult> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    // Verify workspace access
    const workspace = await this.prisma.builderWorkspace.findFirst({
      where: {
        id: dto.workspaceId,
        collaborators: { some: { userId, role: { in: ['owner', 'editor'] } } },
      },
    });
    if (!workspace) {
      throw new ForbiddenException('Builder workspace not found or access denied');
    }

    const nodes = await this.loadBoardNodes(boardId, dto.selectedNodeIds);
    if (nodes.length === 0) throw new NotFoundException('No nodes found for export');

    // Determine document type from nodes
    let docType = dto.documentType;
    if (!docType) {
      const firstTyped = nodes.find((n) => CANVAS_TYPE_TO_BUILDER_TYPE[n.type]);
      docType = firstTyped ? (CANVAS_TYPE_TO_BUILDER_TYPE[firstTyped.type] || 'custom') : 'custom';
    }

    // Build document title
    const docTitle = dto.documentTitle || `Canvas Export: ${nodes.length} nodes`;

    // Build content from nodes — structure depends on document type
    const content = this.buildDocumentContent(docType, nodes);

    // Create the BuilderDocument
    const doc = await this.prisma.builderDocument.create({
      data: {
        workspaceId: dto.workspaceId,
        type: docType as any,
        title: docTitle,
        content: content as any,
        status: 'draft',
        completionPercent: Math.min(40 + nodes.length * 2, 70),
        aiGenerated: false,
        version: 1,
        description: `Exported from Research Canvas (${nodes.length} nodes)`,
      },
    });

    // Optionally link source nodes to the new document
    const linkedNodeIds: string[] = [];
    if (dto.linkNodes !== false) {
      const nodeIdsToLink = nodes.map((n) => n.id);
      await this.prisma.researchNode.updateMany({
        where: { id: { in: nodeIdsToLink }, boardId },
        data: { builderDocumentId: doc.id },
      });
      linkedNodeIds.push(...nodeIdsToLink);
    }

    return {
      documentId: doc.id,
      documentTitle: doc.title,
      documentType: docType,
      workspaceId: dto.workspaceId,
      sourceNodeIds: nodes.map((n) => n.id),
      linkedNodeIds,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Import BuilderDocument → canvas node
  // ─────────────────────────────────────────────────────────────────────────

  async importToCanvas(
    userId: string,
    boardId: string,
    dto: {
      documentId: string;
      posX?: number;
      posY?: number;
    },
  ): Promise<ImportToCanvasResult> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    const doc = await this.prisma.builderDocument.findFirst({
      where: {
        id: dto.documentId,
        workspace: {
          collaborators: { some: { userId } },
        },
      },
      select: { id: true, type: true, title: true, content: true, description: true, workspaceId: true },
    });
    if (!doc) throw new NotFoundException('Builder document not found or access denied');

    // Check not already linked to this board
    const existing = await this.prisma.researchNode.findFirst({
      where: { boardId, builderDocumentId: doc.id },
    });

    if (existing) {
      return {
        nodeId: existing.id,
        nodeType: (existing.metadata as any)?.displayType || existing.type,
        title: existing.title ?? '',
        builderDocumentId: doc.id,
      };
    }

    const canvasType = BUILDER_TYPE_TO_CANVAS_TYPE[doc.type] || 'document';
    const prismaType = this.toPrismaNodeType(canvasType);

    // Extract a brief content preview from the builder document
    const rawContent = doc.content as Record<string, any> || {};
    const contentPreview = this.extractContentPreview(rawContent);

    const node = await this.prisma.researchNode.create({
      data: {
        boardId,
        type: prismaType as any,
        title: doc.title,
        content: contentPreview,
        posX: dto.posX ?? 400,
        posY: dto.posY ?? 300,
        width: 280,
        height: 200,
        builderDocumentId: doc.id,
        metadata: {
          displayType: canvasType,
          importedFromBuilder: true,
          builderDocumentType: doc.type,
          builderWorkspaceId: doc.workspaceId,
        } as any,
      },
    });

    return {
      nodeId: node.id,
      nodeType: canvasType,
      title: node.title ?? '',
      builderDocumentId: doc.id,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI-assisted document generation from canvas nodes
  // ─────────────────────────────────────────────────────────────────────────

  async generateDocumentFromCanvas(
    userId: string,
    boardId: string,
    dto: {
      workspaceId: string;
      documentType: string;
      documentTitle?: string;
      selectedNodeIds?: string[];
      agentId?: string;
    },
  ): Promise<ExportToBuilderResult & { aiGenerated: boolean; generationPrompt: string }> {
    await this.assertBoardAccess(userId, boardId, 'edit');

    const nodes = await this.loadBoardNodes(boardId, dto.selectedNodeIds);
    if (nodes.length === 0) throw new NotFoundException('No nodes found');

    const agent = getAgent(dto.agentId || 'canvas-pitch');
    const nodesSummary = nodes
      .map((n) => `[${n.type}] "${n.title}": ${n.content?.slice(0, 600) || '(empty)'}`)
      .join('\n\n');

    const generationPrompt = `Based on these ${nodes.length} canvas nodes, generate structured content for a ${dto.documentType} document.\n\nCANVAS NODES:\n${nodesSummary}\n\nOutput valid JSON matching the document structure for ${dto.documentType}.`;

    let generatedContent: Record<string, any> = {};
    let aiGenerated = false;

    try {
      const messages = agent.buildMessages(generationPrompt, [], { userId });
      const response = await this.ollama.chat(messages, {
        temperature: 0.3,
        maxTokens: 3000,
      });
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0]);
        aiGenerated = true;
      }
    } catch {
      generatedContent = this.buildDocumentContent(dto.documentType, nodes);
    }

    const workspace = await this.prisma.builderWorkspace.findFirst({
      where: { id: dto.workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const doc = await this.prisma.builderDocument.create({
      data: {
        workspaceId: dto.workspaceId,
        type: dto.documentType as any,
        title: dto.documentTitle || `${dto.documentType.replace(/_/g, ' ')} (from canvas)`,
        content: generatedContent as any,
        status: 'draft',
        completionPercent: aiGenerated ? 65 : 40,
        aiGenerated,
        version: 1,
        description: `AI-generated from Research Canvas (${nodes.length} nodes)`,
      },
    });

    // Link nodes
    await this.prisma.researchNode.updateMany({
      where: { id: { in: nodes.map((n) => n.id) }, boardId },
      data: { builderDocumentId: doc.id },
    });

    return {
      documentId: doc.id,
      documentTitle: doc.title,
      documentType: dto.documentType,
      workspaceId: dto.workspaceId,
      sourceNodeIds: nodes.map((n) => n.id),
      linkedNodeIds: nodes.map((n) => n.id),
      aiGenerated,
      generationPrompt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // List builder documents available for import into a canvas
  // ─────────────────────────────────────────────────────────────────────────

  async listImportableDocuments(
    userId: string,
    boardId: string,
  ): Promise<Array<{ id: string; type: string; title: string; workspaceName: string; alreadyLinked: boolean }>> {
    await this.assertBoardAccess(userId, boardId, 'view');

    const [docs, linkedNodes] = await Promise.all([
      this.prisma.builderDocument.findMany({
        where: {
          workspace: { collaborators: { some: { userId } } },
          status: { not: 'archived' },
        },
        select: { id: true, type: true, title: true, workspace: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.prisma.researchNode.findMany({
        where: { boardId, builderDocumentId: { not: null } },
        select: { builderDocumentId: true },
      }),
    ]);

    const linkedDocIds = new Set(linkedNodes.map((n) => n.builderDocumentId).filter(Boolean));

    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      workspaceName: d.workspace.name,
      alreadyLinked: linkedDocIds.has(d.id),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildDocumentContent(docType: string, nodes: CanvasNodeSnapshot[]): Record<string, any> {
    const byType = (type: string) => nodes.filter((n) => n.type.toLowerCase().includes(type));

    switch (docType) {
      case 'swot_analysis':
        return {
          strengths: byType('strength').map((n) => n.title).join(', ') || byType('swot').map((n) => n.content).join('\n'),
          weaknesses: byType('weakness').map((n) => n.title).join(', '),
          opportunities: byType('opportunit').map((n) => n.title).join(', '),
          threats: byType('threat').map((n) => n.title).join(', '),
          notes: nodes.map((n) => `${n.title}: ${n.content}`).join('\n\n'),
        };
      case 'pitch_deck':
        return {
          overview: nodes.find((n) => n.type === 'vision')?.content || '',
          problem: nodes.find((n) => ['insight', 'problem', 'hypothesis'].includes(n.type))?.content || '',
          solution: nodes.find((n) => n.type === 'idea')?.content || '',
          market: nodes.find((n) => n.type === 'market_research')?.content || '',
          competitors: byType('competitor').map((n) => n.title).join(', '),
          businessModel: nodes.find((n) => n.type === 'revenue_model')?.content || '',
          slides: nodes.map((n) => ({ title: n.title, content: n.content, type: n.type })),
        };
      case 'business_model_canvas':
        return {
          valuePropositions: nodes.find((n) => n.type === 'vision')?.content || '',
          customerSegments: nodes.find((n) => n.type === 'market_research')?.content || '',
          channels: '',
          customerRelationships: '',
          revenueStreams: nodes.find((n) => n.type === 'revenue_model')?.content || '',
          keyResources: '',
          keyActivities: '',
          keyPartnerships: '',
          costStructure: '',
          sourceNodes: nodes.map((n) => ({ id: n.id, type: n.type, title: n.title })),
        };
      case 'market_analysis':
        return {
          summary: nodes.filter((n) => n.type === 'market_research').map((n) => n.content).join('\n\n'),
          competitors: byType('competitor').map((n) => ({ name: n.title, notes: n.content })),
          tam: '',
          sam: '',
          som: '',
          insights: byType('insight').map((n) => n.content).join('\n'),
          sourceNodes: nodes.map((n) => n.id),
        };
      default:
        return {
          title: `Export from Research Canvas`,
          content: nodes.map((n) => `## ${n.title}\n\n${n.content}`).join('\n\n---\n\n'),
          nodes: nodes.map((n) => ({ id: n.id, type: n.type, title: n.title, content: n.content })),
        };
    }
  }

  private extractContentPreview(content: Record<string, any>): string {
    const values = Object.values(content).filter((v) => typeof v === 'string' && v.length > 0);
    return values.slice(0, 3).join('\n\n').slice(0, 1200);
  }

  private toPrismaNodeType(type: string): string {
    const DOCUMENT_SUBTYPES = new Set([
      'document', 'note', 'spec', 'user_story', 'architecture', 'vision', 'idea',
      'market_research', 'go_to_market', 'revenue_model', 'financial_plan',
      'pitch_deck', 'business_model', 'lean_canvas', 'swot', 'competitor',
    ]);
    const IMAGE_SUBTYPES = new Set(['image', 'diagram', 'screenshot', 'photo', 'infographic']);
    const PDF_SUBTYPES = new Set(['pdf', 'research_paper', 'article_pdf', 'ebook']);
    const LINK_SUBTYPES = new Set(['link', 'url', 'website', 'reference_link']);

    if (IMAGE_SUBTYPES.has(type)) return 'image';
    if (PDF_SUBTYPES.has(type)) return 'pdf';
    if (LINK_SUBTYPES.has(type)) return 'link';
    if (DOCUMENT_SUBTYPES.has(type)) return 'document';
    return 'note';
  }
}
