import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CanvasVersioningService } from './canvas-versioning.service';

const createVersionSchema = z.object({
  label: z.string().max(200).optional(),
  changeSummary: z.string().max(1000).optional(),
  triggerType: z.enum(['manual', 'autosave', 'checkpoint', 'pre_merge', 'post_merge', 'branch_create', 'restore']).optional(),
  branchId: z.string().uuid().optional(),
});

const createBranchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  baseVersionId: z.string().uuid().optional(),
});

const mergeBranchSchema = z.object({
  sourceBranchId: z.string().uuid(),
  targetBranchId: z.string().uuid(),
  strategy: z.enum(['fast_forward', 'manual', 'conflict_resolved']).default('manual'),
  resolutions: z.array(z.object({
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
    resolution: z.enum(['keep_source', 'keep_target', 'keep_both']),
  })).optional(),
});

@Controller('research')
@UseGuards(JwtAuthGuard)
export class CanvasVersioningController {
  constructor(private readonly versioning: CanvasVersioningService) {}

  // ── Versions ───────────────────────────────────────────────────────────────

  @Post('boards/:boardId/versions')
  async createVersion(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = createVersionSchema.parse(body);
    const version = await this.versioning.createVersion(user.id, boardId, dto);
    return { version };
  }

  @Get('boards/:boardId/versions')
  async listVersions(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Query('branchId') branchId?: string,
  ) {
    const versions = await this.versioning.listVersions(user.id, boardId, branchId || undefined);
    return { versions };
  }

  @Get('boards/:boardId/versions/:versionId')
  async getVersion(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('versionId') versionId: string,
  ) {
    const version = await this.versioning.getVersion(user.id, boardId, versionId);
    return { version };
  }

  @Post('boards/:boardId/versions/:versionId/restore')
  async restoreVersion(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('versionId') versionId: string,
  ) {
    const result = await this.versioning.restoreVersion(user.id, boardId, versionId);
    return result;
  }

  @Get('boards/:boardId/diff')
  async diffVersions(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      return { error: 'from and to query params required' };
    }
    const diff = await this.versioning.diffVersions(user.id, boardId, from, to);
    return { diff };
  }

  // ── Branches ───────────────────────────────────────────────────────────────

  @Post('boards/:boardId/branches')
  async createBranch(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = createBranchSchema.parse(body);
    const branch = await this.versioning.createBranch(user.id, boardId, dto);
    return { branch };
  }

  @Get('boards/:boardId/branches')
  async listBranches(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
  ) {
    const branches = await this.versioning.listBranches(user.id, boardId);
    return { branches };
  }

  @Patch('boards/:boardId/branches/:branchId/archive')
  async archiveBranch(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('branchId') branchId: string,
  ) {
    const branch = await this.versioning.updateBranchStatus(user.id, boardId, branchId, 'archived');
    return { branch };
  }

  @Patch('boards/:boardId/branches/:branchId/restore')
  async restoreBranch(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('branchId') branchId: string,
  ) {
    const branch = await this.versioning.updateBranchStatus(user.id, boardId, branchId, 'active');
    return { branch };
  }

  @Delete('boards/:boardId/branches/:branchId')
  async deleteBranch(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Param('branchId') branchId: string,
  ) {
    await this.versioning.deleteBranch(user.id, boardId, branchId);
    return { ok: true };
  }

  // ── Merge ──────────────────────────────────────────────────────────────────

  @Post('boards/:boardId/merge/preview')
  async previewMerge(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const { sourceBranchId, targetBranchId } = z.object({
      sourceBranchId: z.string().uuid(),
      targetBranchId: z.string().uuid(),
    }).parse(body);
    const result = await this.versioning.detectMergeConflicts(user.id, boardId, sourceBranchId, targetBranchId);
    return result;
  }

  @Post('boards/:boardId/merge')
  async mergeBranch(
    @CurrentUser() user: { id: string },
    @Param('boardId') boardId: string,
    @Body() body: unknown,
  ) {
    const dto = mergeBranchSchema.parse(body);
    const result = await this.versioning.mergeBranch(user.id, boardId, dto);
    return result;
  }
}
