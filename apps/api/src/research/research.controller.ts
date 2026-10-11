import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResearchService } from './research.service';
import { CanvasSynthesisService } from './canvas-synthesis.service';
import { CanvasAssistService } from './canvas-assist.service';
import { Throttle } from '@nestjs/throttler';
import { GamificationEventsService } from '../gamification/gamification-events.service';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ResearchNodeType } from '@prisma/client';

// Maps all 60+ frontend node types to the 6 valid Prisma enum values.
// The original type is preserved in metadata.displayType so the frontend
// can still render the correct icon/colour.
const VALID_PRISMA_TYPES = new Set(['note', 'document', 'image', 'pdf', 'link', 'reference']);

const DOCUMENT_SUBTYPES = new Set([
  // Core document types
  'pitch_deck','business_plan','financial_model','market_analysis','competitor_analysis',
  'swot','lean_canvas','strategy','roadmap','product_roadmap','report',
  'checklist','contract','policy','wireframe','user_research','persona','journey_map',
  'specification','technical_doc','whiteboard','mindmap','flowchart','process',
  'investor_update','term_sheet','cap_table','equity','budget','forecast','proposal',
  'presentation','slide_deck','template','form','survey','feedback','review',
  'onboarding','playbook','runbook','guide','manual','wiki','faq','glossary',
  // Research & Analysis
  'insight','hypothesis','question','evidence','citation',
  // Strategy & Planning
  'okr','vision',
  // Financial
  'invoice','revenue_model',
  // Legal
  'nda','legal','incorporation','ip_filing','compliance',
  // Product & Tech
  'spec','user_story','api_doc','architecture','bug_report','feature_request',
  // Marketing & Sales
  'competitor','market_research','branding','go_to_market','funnel',
  // Team & Operations
  'meeting_notes','org_chart','timeline','kpi','hiring_plan',
  // Communication
  'email_draft','press_release','newsletter',
  // Data & Reports
  'whitepaper','case_study','data','due_diligence','data_room','valuation',
  // Task Management
  'task','milestone','sprint','retrospective',
  // Draw / Diagram shapes (stored as 'document', rendered via metadata.displayType)
  'shape_rect','shape_circle','shape_diamond','shape_triangle','shape_line','shape_arrow','shape_text',
  // Mermaid diagram
  'mermaid_diagram',
  // Visual structured templates (Phase 2)
  'visual_bmc','visual_lean','visual_swot',
  // Embedded interactive nodes (Phase 2)
  'flow_diagram','whiteboard',
]);
const IMAGE_SUBTYPES = new Set(['screenshot','diagram','chart','visualization','mockup','prototype','design']);
const PDF_SUBTYPES   = new Set(['research_paper','article_pdf','ebook']);
const LINK_SUBTYPES  = new Set(['url','website','article','blog_post','social_post','video','podcast','tweet','github']);
const REF_SUBTYPES   = new Set(['entity','startup','person','org','company','investor','accelerator','university']);

function toPrismaNodeType(raw: string): ResearchNodeType {
  if (VALID_PRISMA_TYPES.has(raw)) return raw as ResearchNodeType;
  if (DOCUMENT_SUBTYPES.has(raw)) return 'document';
  if (IMAGE_SUBTYPES.has(raw))    return 'image';
  if (PDF_SUBTYPES.has(raw))      return 'pdf';
  if (LINK_SUBTYPES.has(raw))     return 'link';
  if (REF_SUBTYPES.has(raw))      return 'reference';
  // sticky_note, idea, task, checklist_item, bookmark, and everything else
  return 'note';
}

const createBoardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'team', 'organization', 'public']).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'team', 'organization', 'public']).optional(),
  canvasState: z.unknown().optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

const createNodeSchema = z.object({
  type: z.string().min(1),  // accepts all 60+ frontend types; mapped to Prisma enum in handler
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  url: z.string().url().optional(),
  uploadId: z.string().uuid().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().min(100).max(2000).optional(),
  height: z.number().min(50).max(2000).optional(),
  color: z.string().optional(),
  refEntityType: z.string().optional(),
  refEntityId: z.string().optional(),
  metadata: z.unknown().optional(),
  tags: z.array(z.string()).optional(),
});

const updateNodeSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  url: z.string().url().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  width: z.number().min(100).max(2000).optional(),
  height: z.number().min(50).max(2000).optional(),
  zIndex: z.number().optional(),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
  locked: z.boolean().optional(),
  metadata: z.unknown().optional(),
  tags: z.array(z.string()).optional(),
  builderDocumentId: z.string().uuid().nullable().optional(),
});

const batchUpdateNodesSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      posX: z.number().optional(),
      posY: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      zIndex: z.number().optional(),
    }),
  ),
});

const createConnectorSchema = z.object({
  fromNodeId: z.string().uuid(),
  toNodeId: z.string().uuid(),
  label: z.string().max(200).optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

const updateConnectorSchema = z.object({
  label: z.string().max(200).optional(),
  color: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

const addCollaboratorSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['viewer', 'editor', 'admin']).default('viewer'),
});

const updateCollaboratorSchema = z.object({
  role: z.enum(['viewer', 'editor', 'admin']),
});

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  commentType: z.enum(['general', 'suggestion', 'question', 'pin']).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  parentId: z.string().uuid().optional(),
});

const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
});

@Controller('research')
@UseGuards(JwtAuthGuard)
export class ResearchController {
  constructor(
    private readonly research: ResearchService,
    private readonly config: ConfigService,
    private readonly synthesis: CanvasSynthesisService,
    private readonly gamificationEvents: GamificationEventsService,
    private readonly assist: CanvasAssistService,
  ) {}

  // ─── Boards ────────────────────────────────────────────────────────────────

  @Get('boards')
  async listBoards(
    @CurrentUser() user: { id: string },
    @Query('archived') archived?: string,
  ) {
    const boards = await this.research.listBoards(
      user.id,
      archived === '1' || archived === 'true',
    );
    return { boards };
  }

  @Get('boards/:boardId')
  async getBoard(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string) {
    const board = await this.research.getBoard(user.id, boardId);
    // Restore extended display types from metadata so the frontend renders the correct
    // icon/colour for all 60+ node types (Prisma only stores 6 enum values).
    const nodes = (board.nodes ?? []).map((n: any) => {
      const meta = n.metadata as Record<string, unknown> | null;
      const displayType = meta?.displayType as string | undefined;
      return displayType ? { ...n, type: displayType } : n;
    });
    return { board: { ...board, nodes } };
  }

  @Post('boards')
  async createBoard(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const data = createBoardSchema.parse(body);
    const board = await this.research.createBoard(user.id, data);
    // Record XP for board creation
    this.gamificationEvents.onBoardCreated(user.id, board.id).catch(() => {});
    return { board };
  }

  @Patch('boards/:boardId')
  async updateBoard(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const data = updateBoardSchema.parse(body);
    const board = await this.research.updateBoard(user.id, boardId, data);
    return { board };
  }

  @Delete('boards/:boardId')
  async deleteBoard(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string) {
    await this.research.deleteBoard(user.id, boardId);
    return { ok: true };
  }

  // ─── Nodes ─────────────────────────────────────────────────────────────────

  @Post('boards/:boardId/nodes')
  async createNode(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const raw = createNodeSchema.parse(body);
    const prismaType = toPrismaNodeType(raw.type);
    // Preserve the original display type in metadata so the frontend can show
    // the correct icon/colour for extended node types.
    const existingMeta = (raw.metadata && typeof raw.metadata === 'object') ? raw.metadata as Record<string, unknown> : {};
    const metadata = raw.type !== prismaType
      ? { ...existingMeta, displayType: raw.type }
      : existingMeta;
    const node = await this.research.createNode(user.id, boardId, { ...raw, type: prismaType, metadata });
    // Record XP for node creation (quality based on content length)
    const qualityScore = raw.content ? Math.min(1.0 + (raw.content.length / 1000), 1.5) : 1.0;
    this.gamificationEvents.onNodeCreated(user.id, node.id, boardId, raw.type, qualityScore).catch(() => {});
    // Return the original type to the frontend so the canvas renders correctly
    return { node: { ...node, type: raw.type } };
  }

  @Patch('boards/:boardId/nodes/batch')
  async batchUpdateNodes(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const { updates } = batchUpdateNodesSchema.parse(body);
    await this.research.updateNodesBatch(user.id, boardId, updates);
    return { ok: true };
  }

  @Patch('nodes/:nodeId')
  async updateNode(
    @CurrentUser() user: { id: string },
    @Param('nodeId') nodeId: string,
    @Body() body: unknown,
  ) {
    const data = updateNodeSchema.parse(body);
    const node = await this.research.updateNode(user.id, nodeId, data);
    // Record XP for meaningful node improvements (content/title changes)
    if (data.content || data.title) {
      const improvementDelta = data.content ? Math.min(data.content.length / 10, 50) : 10;
      const boardId = (node as any).boardId || '';
      this.gamificationEvents.onNodeImproved(user.id, nodeId, boardId, improvementDelta).catch(() => {});
    }
    // Re-hydrate displayType → type so the frontend always sees the extended type.
    const meta = node.metadata as Record<string, unknown> | null;
    const displayType = meta?.displayType as string | undefined;
    return { node: displayType ? { ...node, type: displayType } : node };
  }

  @Delete('nodes/:nodeId')
  async deleteNode(@CurrentUser() user: { id: string }, @Param('nodeId') nodeId: string) {
    await this.research.deleteNode(user.id, nodeId);
    return { ok: true };
  }

  // ─── Connectors ────────────────────────────────────────────────────────────

  @Post('boards/:boardId/connectors')
  async createConnector(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const data = createConnectorSchema.parse(body);
    const connector = await this.research.createConnector(user.id, boardId, data);
    return { connector };
  }

  @Patch('connectors/:connectorId')
  async updateConnector(
    @CurrentUser() user: { id: string },
    @Param('connectorId') connectorId: string,
    @Body() body: unknown,
  ) {
    const data = updateConnectorSchema.parse(body);
    const connector = await this.research.updateConnector(user.id, connectorId, data);
    return { connector };
  }

  @Delete('connectors/:connectorId')
  async deleteConnector(@CurrentUser() user: { id: string }, @Param('connectorId') connectorId: string) {
    await this.research.deleteConnector(user.id, connectorId);
    return { ok: true };
  }

  // ─── Collaborators ─────────────────────────────────────────────────────────

  @Get('boards/:boardId/collaborators')
  async listCollaborators(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string) {
    return this.research.listCollaborators(user.id, boardId);
  }

  @Post('boards/:boardId/collaborators')
  async addCollaborator(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const data = addCollaboratorSchema.parse(body);
    const collab = await this.research.addCollaborator(user.id, boardId, data);
    return { collaborator: collab };
  }

  @Patch('boards/:boardId/collaborators/:targetUserId')
  async updateCollaborator(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() body: unknown,
  ) {
    const { role } = updateCollaboratorSchema.parse(body);
    await this.research.updateCollaborator(user.id, boardId, targetUserId, role);
    return { ok: true };
  }

  @Delete('boards/:boardId/collaborators/:targetUserId')
  async removeCollaborator(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    await this.research.removeCollaborator(user.id, boardId, targetUserId);
    return { ok: true };
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  @Get('nodes/:nodeId/comments')
  async listComments(@CurrentUser() user: { id: string }, @Param('nodeId') nodeId: string) {
    const comments = await this.research.listNodeComments(user.id, nodeId);
    return { comments };
  }

  @Post('nodes/:nodeId/comments')
  async createComment(
    @CurrentUser() user: { id: string },
    @Param('nodeId') nodeId: string,
    @Body() body: unknown,
  ) {
    const data = createCommentSchema.parse(body);
    const comment = await this.research.createComment(user.id, nodeId, data);
    return { comment };
  }

  @Patch('comments/:commentId')
  async updateComment(
    @CurrentUser() user: { id: string },
    @Param('commentId') commentId: string,
    @Body() body: unknown,
  ) {
    const data = updateCommentSchema.parse(body);
    const comment = await this.research.updateComment(user.id, commentId, data);
    return { comment };
  }

  @Delete('comments/:commentId')
  async deleteComment(@CurrentUser() user: { id: string }, @Param('commentId') commentId: string) {
    await this.research.deleteComment(user.id, commentId);
    return { ok: true };
  }

  // ─── Snapshots (Phase 4a) ─────────────────────────────────────────────────

  @Post('boards/:boardId/snapshots')
  async createSnapshot(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const data = z.object({
      label: z.string().max(200).optional(),
      triggerType: z.enum(['manual', 'autosave', 'checkpoint']).optional(),
    }).parse(body);
    const snapshot = await this.research.createSnapshot(user.id, boardId, data);
    return { snapshot };
  }

  @Get('boards/:boardId/snapshots')
  async listSnapshots(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
  ) {
    const snapshots = await this.research.listSnapshots(user.id, boardId);
    return { snapshots };
  }

  @Get('boards/:boardId/snapshots/:snapshotId')
  async getSnapshot(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    const snapshot = await this.research.getSnapshot(user.id, boardId, snapshotId);
    return { snapshot };
  }

  @Post('boards/:boardId/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    const result = await this.research.restoreSnapshot(user.id, boardId, snapshotId);
    return result;
  }

  // ─── AI Analysis ───────────────────────────────────────────────────────────

  @Post('boards/:boardId/analyze')
  async analyzeBoard(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY') ?? null;
    const analysis = await this.research.analyzeBoard(user.id, boardId, openaiKey);
    return { analysis };
  }

  // ─── AI panel (proposals only; nothing is written to the board) ────────────

  @Post('boards/:boardId/ai/extract')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  aiExtract(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string, @Body() body: unknown) {
    return this.assist.extract(user.id, boardId, body);
  }

  @Post('boards/:boardId/ai/connections')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  aiConnections(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string, @Body() body: unknown) {
    return this.assist.connections(user.id, boardId, body);
  }

  @Post('boards/:boardId/ai/synthesize')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  aiSynthesize(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string, @Body() body: unknown) {
    return this.assist.synthesize(user.id, boardId, body);
  }

  @Post('boards/:boardId/ai/questions')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  aiQuestions(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string, @Body() body: unknown) {
    return this.assist.questions(user.id, boardId, body);
  }

  @Post('boards/:boardId/ai/chat')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  aiChat(@CurrentUser() user: { id: string }, @Param('boardId') boardId: string, @Body() body: unknown) {
    return this.assist.chat(user.id, boardId, body);
  }

  // ─── Canvas Copilot (multi-agent) ──────────────────────────────────────────

  @Post('boards/:boardId/copilot/chat')
  async copilotChat(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({
      agentId: z.string().default('canvas-strategy'),
      message: z.string().min(1).max(4000),
      selectedNodeIds: z.array(z.string().uuid()).optional(),
      includeAllNodes: z.boolean().optional(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional(),
    }).parse(body);
    return this.synthesis.copilotChat(user.id, boardId, dto);
  }

  @Get('boards/:boardId/copilot/agents')
  async listCopilotAgents() {
    const { listAgents } = await import('../ai/agents/base-agent');
    const canvasAgents = listAgents().filter((a) => a.id.startsWith('canvas-'));
    return { agents: canvasAgents };
  }

  // ─── Canvas ↔ Builder Synthesis ────────────────────────────────────────────

  @Post('boards/:boardId/export-to-builder')
  async exportToBuilder(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({
      workspaceId: z.string().uuid(),
      selectedNodeIds: z.array(z.string().uuid()).optional(),
      documentType: z.string().optional(),
      documentTitle: z.string().max(200).optional(),
      linkNodes: z.boolean().optional(),
    }).parse(body);
    return this.synthesis.exportToBuilder(user.id, boardId, dto);
  }

  @Post('boards/:boardId/import-from-builder')
  async importFromBuilder(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({
      documentId: z.string().uuid(),
      posX: z.number().optional(),
      posY: z.number().optional(),
    }).parse(body);
    return this.synthesis.importToCanvas(user.id, boardId, dto);
  }

  @Post('boards/:boardId/generate-document')
  async generateDocument(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({
      workspaceId: z.string().uuid(),
      documentType: z.string().min(1),
      documentTitle: z.string().max(200).optional(),
      selectedNodeIds: z.array(z.string().uuid()).optional(),
      agentId: z.string().optional(),
    }).parse(body);
    return this.synthesis.generateDocumentFromCanvas(user.id, boardId, dto);
  }

  @Get('boards/:boardId/importable-documents')
  async listImportableDocuments(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
  ) {
    const docs = await this.synthesis.listImportableDocuments(user.id, boardId);
    return { documents: docs };
  }
}
