import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { XPEventType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';
import { RecordXPOpts } from './gamification.types';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class RecordXPDto {
  eventType!: XPEventType;
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  weightMultiplier?: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly svc: GamificationService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // XP — user-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/users/me/xp
   * Returns total XP, level, streak, and 20 recent events for the caller.
   */
  @Get('users/me/xp')
  async getMyXP(@CurrentUser() user: { id: string }) {
    return this.svc.calculateUserXP(user.id);
  }

  /**
   * GET /gamification/users/:userId/xp
   * Returns XP summary for any user (used by mentor/investor views).
   */
  @Get('users/:userId/xp')
  async getUserXP(@Param('userId') userId: string) {
    return this.svc.calculateUserXP(userId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BADGES — user-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/users/me/badges
   * Returns all earned badges for the caller.
   */
  @Get('users/me/badges')
  async getMyBadges(@CurrentUser() user: { id: string }) {
    return this.svc.getUserBadges(user.id);
  }

  /**
   * GET /gamification/users/:userId/badges
   * Returns earned badges for any user.
   */
  @Get('users/:userId/badges')
  async getUserBadges(@Param('userId') userId: string) {
    return this.svc.getUserBadges(userId);
  }

  /**
   * POST /gamification/users/me/badges/seen
   * Mark all unseen badge notifications as seen.
   */
  @Post('users/me/badges/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markBadgesSeen(@CurrentUser() user: { id: string }) {
    await this.svc.markBadgesSeen(user.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STREAK — user-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/users/me/streak
   * Returns current and longest streak for the caller.
   */
  @Get('users/me/streak')
  async getMyStreak(@CurrentUser() user: { id: string }) {
    return this.svc.getStreak(user.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // XP EVENT — record a new event (called by other services / frontend hooks)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /gamification/events
   * Record an XP event for the caller.
   * Body: { eventType, workspaceId?, entityType?, entityId?, weightMultiplier?, metadata? }
   */
  @Post('events')
  async recordEvent(
    @CurrentUser() user: { id: string },
    @Body() dto: RecordXPDto,
  ) {
    if (!dto.eventType) {
      throw new BadRequestException('eventType is required');
    }
    const validTypes = Object.values(XPEventType) as string[];
    if (!validTypes.includes(dto.eventType)) {
      throw new BadRequestException(`Invalid eventType: ${dto.eventType}`);
    }

    const opts: RecordXPOpts = {
      workspaceId: dto.workspaceId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      weightMultiplier: dto.weightMultiplier,
      metadata: dto.metadata,
    };

    return this.svc.recordXPEvent(user.id, dto.eventType, opts);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READINESS — workspace-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/workspaces/:workspaceId/readiness
   * Returns cached readiness score, computing it on-demand if absent.
   */
  @Get('workspaces/:workspaceId/readiness')
  async getReadiness(@Param('workspaceId') workspaceId: string) {
    const cached = await this.svc.getReadinessScore(workspaceId);
    if (cached) return cached;
    return this.svc.calculateReadinessScore(workspaceId);
  }

  /**
   * POST /gamification/workspaces/:workspaceId/readiness/refresh
   * Force-recompute readiness score (call after significant workspace changes).
   */
  @Post('workspaces/:workspaceId/readiness/refresh')
  async refreshReadiness(@Param('workspaceId') workspaceId: string) {
    return this.svc.calculateReadinessScore(workspaceId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOMENTUM — workspace-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/workspaces/:workspaceId/momentum
   * Returns cached team momentum score, computing on-demand if absent.
   */
  @Get('workspaces/:workspaceId/momentum')
  async getMomentum(@Param('workspaceId') workspaceId: string) {
    const cached = await this.svc.getMomentumScore(workspaceId);
    if (cached) return cached;
    return this.svc.updateTeamMomentum(workspaceId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONTRIBUTIONS — workspace-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/workspaces/:workspaceId/contributions
   * Returns all contributor scores for a workspace, sorted by score desc.
   */
  @Get('workspaces/:workspaceId/contributions')
  async getContributions(@Param('workspaceId') workspaceId: string) {
    return this.svc.getContributionScores(workspaceId);
  }

  /**
   * GET /gamification/workspaces/:workspaceId/contributions/me
   * Returns the caller's contribution score within a workspace.
   */
  @Get('workspaces/:workspaceId/contributions/me')
  async getMyContribution(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    const all = await this.svc.getContributionScores(workspaceId);
    const mine = all.find((c) => c.userId === user.id);
    if (!mine) throw new NotFoundException('No contribution record found for this workspace');
    return mine;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MENTOR METRICS — workspace-scoped
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/workspaces/:workspaceId/mentor-metrics
   * Returns mentor feedback loop metrics for a workspace.
   */
  @Get('workspaces/:workspaceId/mentor-metrics')
  async getMentorMetrics(@Param('workspaceId') workspaceId: string) {
    const cached = await this.svc.getMentorMetrics(workspaceId);
    if (cached) return cached;
    return this.svc.processMentorFeedbackMetrics(workspaceId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FULL REFRESH — workspace-scoped (admin / scheduled job)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /gamification/workspaces/:workspaceId/refresh
   * Force-recompute all workspace metrics: readiness + momentum + mentor metrics.
   */
  @Post('workspaces/:workspaceId/refresh')
  async refreshAllWorkspaceMetrics(
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.svc.refreshWorkspaceMetrics(workspaceId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 10 — EXPLAINABILITY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/users/me/explain?workspaceId=...
   * Returns a comprehensive ScoreExplainDTO for the caller, optionally scoped to a workspace.
   */
  @Get('users/me/explain')
  async getMyExplain(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId?: string,
  ) {
    return this.svc.getScoreExplain(user.id, workspaceId);
  }

  /**
   * GET /gamification/workspaces/:workspaceId/explain/me
   * Returns ScoreExplainDTO for the caller, workspace-scoped.
   */
  @Get('workspaces/:workspaceId/explain/me')
  async getWorkspaceExplain(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.svc.getScoreExplain(user.id, workspaceId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 8 — ROLE-AWARE PERCENTILE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /gamification/workspaces/:workspaceId/contributions/me/percentile
   * Returns role-normalised percentile rank for the caller within this workspace.
   */
  @Get('workspaces/:workspaceId/contributions/me/percentile')
  async getMyPercentile(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.svc.getContributionPercentile(user.id, workspaceId);
  }
}
