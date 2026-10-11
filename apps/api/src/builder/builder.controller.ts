import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BuilderService } from './builder.service';
import { BuilderAIService } from './builder-ai.service';
import { BuilderOrgService } from './builder-org.service';
import { GamificationEventsService } from '../gamification/gamification-events.service';
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
} from './dto/builder.dto';

@Controller('builder')
@UseGuards(JwtAuthGuard)
export class BuilderController {
  constructor(
    private readonly builderService: BuilderService,
    private readonly builderAIService: BuilderAIService,
    private readonly builderOrgService: BuilderOrgService,
    private readonly gamificationEvents: GamificationEventsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Workspace Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('workspaces')
  async createWorkspace(@Request() req: any, @Body() dto: CreateWorkspaceDto) {
    return this.builderService.createWorkspace(req.user.id, dto);
  }

  @Get('workspaces')
  async getWorkspaces(@Request() req: any, @Query() query: WorkspaceQueryDto) {
    return this.builderService.getWorkspaces(req.user.id, query);
  }

  @Get('workspaces/:id')
  async getWorkspace(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getWorkspace(req.user.id, id);
  }

  @Put('workspaces/:id')
  async updateWorkspace(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.builderService.updateWorkspace(req.user.id, id, dto);
  }

  @Delete('workspaces/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkspace(@Request() req: any, @Param('id') id: string) {
    return this.builderService.deleteWorkspace(req.user.id, id);
  }

  @Post('workspaces/:id/archive')
  async archiveWorkspace(@Request() req: any, @Param('id') id: string) {
    return this.builderService.archiveWorkspace(req.user.id, id);
  }

  @Get('workspaces/:id/activity')
  async getWorkspaceActivity(
    @Request() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.builderService.getWorkspaceActivity(req.user.id, id, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Document Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('documents')
  async createDocument(@Request() req: any, @Body() dto: CreateDocumentDto) {
    const document = await this.builderService.createDocument(req.user.id, dto);
    // Record XP for artifact creation
    this.gamificationEvents.onArtifactCreated(
      req.user.id,
      document.id,
      dto.workspaceId,
      dto.type || 'document'
    ).catch(() => {});
    return document;
  }

  @Get('documents/:id')
  async getDocument(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getDocument(req.user.id, id);
  }

  @Put('documents/:id')
  async updateDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    const document = await this.builderService.updateDocument(req.user.id, id, dto);
    // Record XP for artifact improvement
    if (dto.completionPercent !== undefined) {
      const completionDelta = Math.abs(dto.completionPercent - (document.completionPercent || 0));
      this.gamificationEvents.onArtifactImproved(
        req.user.id,
        id,
        document.workspaceId,
        completionDelta,
        1 // TODO: get actual collaborator count from workspace
      ).catch(() => {});
    }
    return document;
  }

  @Patch('documents/:id/sections/:sectionKey')
  async updateDocumentSection(
    @Request() req: any,
    @Param('id') id: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: UpdateDocumentSectionDto,
  ) {
    const section = await this.builderService.updateDocumentSection(req.user.id, id, sectionKey, dto);
    // Record XP for section improvement (fetch document to get workspaceId)
    const contentLength = dto.content?.length || 0;
    if (contentLength > 50) {
      const doc = await this.builderService.getDocument(req.user.id, id);
      const completionDelta = Math.min(contentLength / 100, 20);
      this.gamificationEvents.onArtifactImproved(
        req.user.id,
        id,
        doc.workspaceId,
        completionDelta,
        1
      ).catch(() => {});
    }
    return section;
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(@Request() req: any, @Param('id') id: string) {
    return this.builderService.deleteDocument(req.user.id, id);
  }

  @Get('documents/:id/versions')
  async getDocumentVersions(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getDocumentVersions(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Collaborator Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('workspaces/:id/collaborators')
  async getCollaborators(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getCollaborators(req.user.id, id);
  }

  @Post('workspaces/:id/collaborators')
  async addCollaborator(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.builderService.addCollaborator(req.user.id, id, dto);
  }

  @Patch('workspaces/:workspaceId/collaborators/:collaboratorId')
  async updateCollaborator(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('collaboratorId') collaboratorId: string,
    @Body() dto: UpdateCollaboratorDto,
  ) {
    return this.builderService.updateCollaborator(req.user.id, workspaceId, collaboratorId, dto);
  }

  @Delete('workspaces/:workspaceId/collaborators/:collaboratorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCollaborator(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
    @Param('collaboratorId') collaboratorId: string,
  ) {
    return this.builderService.removeCollaborator(req.user.id, workspaceId, collaboratorId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Comment Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('comments')
  async createComment(@Request() req: any, @Body() dto: CreateCommentDto) {
    return this.builderService.createComment(req.user.id, dto);
  }

  @Get('documents/:id/comments')
  async getDocumentComments(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getDocumentComments(req.user.id, id);
  }

  @Patch('comments/:id')
  async updateComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.builderService.updateComment(req.user.id, id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(@Request() req: any, @Param('id') id: string) {
    return this.builderService.deleteComment(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Review Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('reviews')
  async createReview(@Request() req: any, @Body() dto: CreateReviewDto) {
    return this.builderService.createReview(req.user.id, dto);
  }

  @Get('documents/:id/reviews')
  async getDocumentReviews(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getDocumentReviews(req.user.id, id);
  }

  @Post('reviews/:id/submit')
  async submitReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.builderService.submitReview(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Readiness Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('readiness/assess')
  async assessReadiness(@Request() req: any, @Body() dto: AssessReadinessDto) {
    return this.builderService.assessReadiness(req.user.id, dto);
  }

  @Patch('workspaces/:id/readiness/criterion')
  async updateReadinessCriterion(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateReadinessCriterionDto,
  ) {
    return this.builderService.updateReadinessCriterion(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Application Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('applications')
  async createApplication(@Request() req: any, @Body() dto: CreateApplicationDto) {
    return this.builderService.createApplication(req.user.id, dto);
  }

  @Get('workspaces/:id/applications')
  async getApplications(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getApplications(req.user.id, id);
  }

  @Get('applications/:id')
  async getApplication(@Request() req: any, @Param('id') id: string) {
    return this.builderService.getApplication(req.user.id, id);
  }

  @Put('applications/:id')
  async updateApplication(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.builderService.updateApplication(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AI Generation Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('ai/generate')
  async generateContent(@Request() req: any, @Body() dto: GenerateContentDto) {
    return this.builderAIService.generateDocumentContent(req.user.id, dto);
  }

  @Post('ai/generate-section')
  async generateSection(
    @Request() req: any,
    @Body() body: { workspaceId: string; documentType: string; sectionKey: string; context?: Record<string, any> },
  ) {
    return this.builderAIService.generateSection(
      req.user.id,
      body.workspaceId,
      body.documentType as any,
      body.sectionKey,
      body.context || {},
    );
  }

  @Post('ai/generate-application-answer')
  async generateApplicationAnswer(
    @Request() req: any,
    @Body() body: { workspaceId: string; question: string; context?: Record<string, any> },
  ) {
    const answer = await this.builderAIService.generateApplicationAnswer(
      req.user.id,
      body.workspaceId,
      body.question,
      body.context || {},
    );
    return { answer };
  }

  @Post('ai/improve')
  async improveContent(
    @Request() req: any,
    @Body() body: { content: string; documentType: string; feedback?: string },
  ) {
    const improved = await this.builderAIService.improveContent(
      body.content,
      body.documentType as any,
      body.feedback,
    );
    return { improved };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Organization / Multi-tenant Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('org/:tenantId/workspaces')
  async getOrgWorkspaces(
    @Request() req: any,
    @Param('tenantId') tenantId: string,
    @Query() query: WorkspaceQueryDto,
  ) {
    return this.builderOrgService.getOrgWorkspaces(tenantId, req.user.id, query);
  }

  @Get('org/:tenantId/stats')
  async getOrgStats(@Request() req: any, @Param('tenantId') tenantId: string) {
    return this.builderOrgService.getOrgStats(tenantId, req.user.id);
  }

  @Get('org/:tenantId/members')
  async getOrgMemberActivity(@Request() req: any, @Param('tenantId') tenantId: string) {
    return this.builderOrgService.getOrgMemberActivity(tenantId, req.user.id);
  }

  @Post('org/:tenantId/workspaces')
  async createOrgWorkspace(
    @Request() req: any,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.builderOrgService.createOrgWorkspace(tenantId, req.user.id, dto);
  }

  @Post('org/:tenantId/workspaces/:workspaceId/invite')
  async bulkInviteToWorkspace(
    @Request() req: any,
    @Param('tenantId') tenantId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { invitations: { userId: string; role: string }[] },
  ) {
    return this.builderOrgService.bulkInviteToWorkspace(
      tenantId,
      workspaceId,
      req.user.id,
      body.invitations,
    );
  }

  @Get('org/:tenantId/templates')
  async getOrgTemplates(@Request() req: any, @Param('tenantId') tenantId: string) {
    return this.builderOrgService.getOrgTemplates(tenantId, req.user.id);
  }

  @Post('org/:tenantId/templates')
  async createOrgTemplate(
    @Request() req: any,
    @Param('tenantId') tenantId: string,
    @Body() body: {
      type: string;
      name: string;
      description?: string;
      content: Record<string, any>;
      category?: string;
      industry?: string;
      stage?: string;
      isPublic?: boolean;
    },
  ) {
    return this.builderOrgService.createOrgTemplate(tenantId, req.user.id, body);
  }

  @Get('org/:tenantId/cohorts/:cohortId/workspaces')
  async getCohortWorkspaces(
    @Request() req: any,
    @Param('tenantId') tenantId: string,
    @Param('cohortId') cohortId: string,
  ) {
    return this.builderOrgService.getCohortWorkspaces(tenantId, cohortId, req.user.id);
  }
}
