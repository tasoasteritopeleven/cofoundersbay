import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BehavioralStateService } from './behavioral-state.service';
import { NextActionRecommenderService } from './next-action-recommender.service';
import { NudgeFatigueService } from './nudge-fatigue.service';

@Controller('behavior')
@UseGuards(JwtAuthGuard)
export class BehavioralOptimizerController {
  constructor(
    private readonly stateService: BehavioralStateService,
    private readonly recommender: NextActionRecommenderService,
    private readonly fatigueService: NudgeFatigueService,
  ) {}

  // ── GET /behavior/next-action ─────────────────────────────────────────────────
  // Returns the top recommended next action for the authenticated user.
  // Respects nudge fatigue; may return null if cooldown active.

  @Get('next-action')
  async getNextAction(
    @Request() req: any,
    @Query('surface') surface = 'dashboard',
  ) {
    const userId: string = req.user.sub ?? req.user.id;

    const classified = await this.stateService.getOrClassify(userId);
    const topAction = this.recommender.topAction(classified.signals, classified.state);

    if (!topAction) {
      return { action: null, state: classified.state, reason: 'no eligible actions' };
    }

    const decision = await this.fatigueService.canShowNudge(userId, topAction.key, surface);

    if (!decision.shouldShow) {
      return { action: null, state: classified.state, reason: decision.reason, cooldownEndsAt: decision.cooldownEndsAt };
    }

    await this.fatigueService.recordNudgeShown(
      userId,
      topAction.key,
      surface,
      undefined,
      'v1.0',
      { state: classified.state, confidence: classified.confidence },
    );

    return {
      action: topAction,
      state: classified.state,
      confidence: classified.confidence,
      reason: classified.reason,
    };
  }

  // ── GET /behavior/actions ─────────────────────────────────────────────────────
  // Returns top-N actions without fatigue gating (for showing multiple options).

  @Get('actions')
  async getActions(
    @Request() req: any,
    @Query('n') n?: string,
  ) {
    const userId: string = req.user.sub ?? req.user.id;
    const topN = n ? Math.min(parseInt(n, 10), 5) : 3;

    const classified = await this.stateService.getOrClassify(userId);
    const actions = this.recommender.recommend(classified.signals, classified.state, topN);

    return {
      actions,
      state: classified.state,
      confidence: classified.confidence,
    };
  }

  // ── GET /behavior/state ───────────────────────────────────────────────────────
  // Returns the current classified behavioral state + signals for the user.

  @Get('state')
  async getState(@Request() req: any) {
    const userId: string = req.user.sub ?? req.user.id;
    const classified = await this.stateService.getOrClassify(userId);
    return classified;
  }

  // ── POST /behavior/nudge/seen ─────────────────────────────────────────────────
  // Record that a nudge was seen (already handled in getNextAction).
  // Kept for explicit client-side tracking.

  @Post('nudge/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  async nudgeSeen(
    @Request() req: any,
    @Body() body: { nudgeKey: string; surface: string },
  ) {
    const userId: string = req.user.sub ?? req.user.id;
    await this.fatigueService.recordNudgeShown(userId, body.nudgeKey, body.surface);
  }

  // ── POST /behavior/nudge/:logId/dismiss ───────────────────────────────────────

  @Post('nudge/:logId/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async nudgeDismiss(
    @Request() req: any,
    @Param('logId') logId: string,
  ) {
    const userId: string = req.user.sub ?? req.user.id;
    await this.fatigueService.recordNudgeDismissed(logId, userId);
  }

  // ── POST /behavior/nudge/:logId/convert ───────────────────────────────────────

  @Post('nudge/:logId/convert')
  @HttpCode(HttpStatus.NO_CONTENT)
  async nudgeConvert(@Param('logId') logId: string) {
    await this.fatigueService.recordNudgeConverted(logId);
  }

  // ── Admin-only endpoints ──────────────────────────────────────────────────────

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getAdminStats() {
    return this.fatigueService.getPlatformNudgeStats();
  }

  @Get('admin/nudge-logs')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getAdminNudgeLogs(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.fatigueService.getRecentNudgeLogs(userId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('admin/classify/:userId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async adminClassify(@Param('userId') userId: string) {
    return this.stateService.classifyUser(userId);
  }
}
