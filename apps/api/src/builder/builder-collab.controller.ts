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
import { BuilderCollabService } from './builder-collab.service';
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

// ─────────────────────────────────────────────────────────────────────────────
// Collaboration Controller — Phase 1 + Phase 2
// Architecture report: COLLABORATION_ARCHITECTURE.md §8 Phase 1-2
//
// All endpoints are additive — no existing builder endpoints are modified.
// Prefix: /collab (separate from /builder to avoid any route conflicts)
// ─────────────────────────────────────────────────────────────────────────────

@Controller('collab')
@UseGuards(JwtAuthGuard)
export class BuilderCollabController {
  constructor(private readonly collabService: BuilderCollabService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Branch Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  @Post('branches')
  async createBranch(@Request() req: any, @Body() dto: CreateBranchDto) {
    return this.collabService.createBranch(req.user.id, dto);
  }

  @Get('branches/:id')
  async getBranch(@Request() req: any, @Param('id') id: string) {
    return this.collabService.getBranch(req.user.id, id);
  }

  @Get('documents/:documentId/branches')
  async listBranches(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Query() query: ListBranchesQueryDto,
  ) {
    return this.collabService.listBranches(req.user.id, documentId, query);
  }

  @Patch('branches/:id')
  async updateBranch(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.collabService.updateBranch(req.user.id, id, dto);
  }

  @Post('branches/:id/close')
  @HttpCode(HttpStatus.OK)
  async closeBranch(@Request() req: any, @Param('id') id: string) {
    return this.collabService.closeBranch(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Change Proposal Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  @Post('proposals')
  async createProposal(@Request() req: any, @Body() dto: CreateProposalDto) {
    return this.collabService.createProposal(req.user.id, dto);
  }

  @Get('proposals/:id')
  async getProposal(@Request() req: any, @Param('id') id: string) {
    return this.collabService.getProposal(req.user.id, id);
  }

  @Get('documents/:documentId/proposals')
  async listProposals(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Query() query: ListProposalsQueryDto,
  ) {
    return this.collabService.listProposals(req.user.id, documentId, query);
  }

  @Patch('proposals/:id')
  async updateProposal(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProposalDto,
  ) {
    return this.collabService.updateProposal(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Review Request / Decision Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  @Post('reviews/request')
  async requestReview(@Request() req: any, @Body() dto: RequestReviewDto) {
    return this.collabService.requestReview(req.user.id, dto);
  }

  @Post('proposals/:id/review')
  @HttpCode(HttpStatus.OK)
  async submitProposalReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitProposalReviewDto,
  ) {
    return this.collabService.submitProposalReview(req.user.id, id, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Share Link Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  @Post('share-links')
  async createShareLink(@Request() req: any, @Body() dto: CreateShareLinkDto) {
    return this.collabService.createShareLink(req.user.id, dto);
  }

  @Get('share-links/:id')
  async getShareLink(@Request() req: any, @Param('id') id: string) {
    return this.collabService.getShareLink(req.user.id, id);
  }

  @Get('documents/:documentId/share-links')
  async listDocumentShareLinks(
    @Request() req: any,
    @Param('documentId') documentId: string,
  ) {
    return this.collabService.listShareLinks(req.user.id, { documentId });
  }

  @Get('workspaces/:workspaceId/share-links')
  async listWorkspaceShareLinks(
    @Request() req: any,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.collabService.listShareLinks(req.user.id, { workspaceId });
  }

  @Patch('share-links/:id')
  async updateShareLink(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateShareLinkDto,
  ) {
    return this.collabService.updateShareLink(req.user.id, id, dto);
  }

  @Post('share-links/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeShareLink(@Request() req: any, @Param('id') id: string) {
    return this.collabService.revokeShareLink(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // External Share Access (no auth required — token-based)
  // ─────────────────────────────────────────────────────────────────────────

  @Get('share/:token')
  async accessShareLink(
    @Param('token') token: string,
    @Query('password') password?: string,
  ) {
    return this.collabService.accessShareToken(token, password);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Version History + Restore Endpoints
  // ─────────────────────────────────────────────────────────────────────────

  @Get('documents/:documentId/versions')
  async listDocumentVersions(
    @Request() req: any,
    @Param('documentId') documentId: string,
  ) {
    return this.collabService.listDocumentVersions(req.user.id, documentId);
  }

  @Post('versions/restore')
  async restoreVersion(@Request() req: any, @Body() dto: RestoreVersionDto) {
    return this.collabService.restoreVersion(req.user.id, dto);
  }
}
