import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AdminAuditService } from './admin-audit.service';
import { MailerService } from '../mailer/mailer.service';
import { ScoringInspectorService } from './scoring-inspector.service';
import { AbuseDetectionService } from './abuse-detection.service';
import { ExperimentationService } from './experimentation.service';
import { BanUserDto, ChangeUserRoleDto, UpdateUserModerationDto } from './dto/admin-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AdminAuditService,
    private readonly mailer: MailerService,
    private readonly scoringInspector: ScoringInspectorService,
    private readonly abuseDetection: AbuseDetectionService,
    private readonly experimentation: ExperimentationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Platform Stats
  // ─────────────────────────────────────────────────────────────────

  @Get('stats')
  async getStats() {
    const stats = await this.adminService.getPlatformStats();
    return { stats };
  }

  // ─────────────────────────────────────────────────────────────────
  // User Management
  // ─────────────────────────────────────────────────────────────────

  @Get('users')
  async listUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    return this.adminService.listUsers({ role, status, q, limit, offset });
  }

  @Patch('users/:userId/role')
  async changeUserRole(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
    @Body() body: ChangeUserRoleDto,
  ) {
    await this.adminService.changeUserRole({
      adminId: admin.id,
      userId,
      newRole: body.role,
    });
    return { success: true };
  }

  @Post('users/:userId/ban')
  async banUser(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
    @Body() body: BanUserDto,
  ) {
    await this.adminService.banUser({
      adminId: admin.id,
      userId,
      reason: body.reason,
    });
    return { success: true };
  }

  @Post('users/:userId/unban')
  async unbanUser(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
  ) {
    await this.adminService.unbanUser({
      adminId: admin.id,
      userId,
    });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Content Management
  // ─────────────────────────────────────────────────────────────────

  @Patch('content/:type/:id/feature')
  async featureContent(
    @CurrentUser() admin: { id: string },
    @Param('type') type: 'event' | 'group' | 'job',
    @Param('id') id: string,
    @Body() body: { featured: boolean },
  ) {
    await this.adminService.featureContent({
      adminId: admin.id,
      contentType: type,
      contentId: id,
      featured: body.featured,
    });
    return { success: true };
  }

  @Delete('content/:type/:id')
  async removeContent(
    @CurrentUser() admin: { id: string },
    @Param('type') type: 'event' | 'group' | 'job',
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    await this.adminService.removeContent({
      adminId: admin.id,
      contentType: type,
      contentId: id,
      reason: body.reason,
    });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Cohort / Program Management
  // ─────────────────────────────────────────────────────────────────

  @Get('cohorts')
  async listCohorts(
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    return this.adminService.listCohorts({ q, limit, offset });
  }

  @Post('cohorts')
  async createCohort(
    @CurrentUser() admin: { id: string },
    @Body() body: {
      name: string;
      slug: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      capacity?: number;
      isPublic?: boolean;
    },
  ) {
    const cohort = await this.adminService.createCohort({ adminId: admin.id, ...body });
    return { cohort };
  }

  @Patch('cohorts/:cohortId')
  async updateCohort(
    @CurrentUser() admin: { id: string },
    @Param('cohortId') cohortId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const cohort = await this.adminService.updateCohort({ adminId: admin.id, cohortId, data: body });
    return { cohort };
  }

  @Delete('cohorts/:cohortId')
  async deleteCohort(
    @CurrentUser() admin: { id: string },
    @Param('cohortId') cohortId: string,
  ) {
    await this.adminService.deleteCohort({ adminId: admin.id, cohortId });
    return { success: true };
  }

  @Post('cohorts/:cohortId/members')
  async addCohortMember(
    @CurrentUser() admin: { id: string },
    @Param('cohortId') cohortId: string,
    @Body() body: { userId: string; role?: string },
  ) {
    await this.adminService.addCohortMember({ adminId: admin.id, cohortId, userId: body.userId, role: body.role });
    return { success: true };
  }

  @Delete('cohorts/:cohortId/members/:userId')
  async removeCohortMember(
    @CurrentUser() admin: { id: string },
    @Param('cohortId') cohortId: string,
    @Param('userId') userId: string,
  ) {
    await this.adminService.removeCohortMember({ adminId: admin.id, cohortId, userId });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Reports listing (needed by frontend moderation queue)
  // ─────────────────────────────────────────────────────────────────

  @Get('reports')
  async listReports(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    return this.adminService.listReports({ status, type, limit, offset });
  }

  @Patch('users/:userId/moderation')
  async updateUserModeration(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
    @Body() body: UpdateUserModerationDto,
  ) {
    await this.adminService.updateUserModerationStatus({ adminId: admin.id, userId, status: body.status, reason: body.reason });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Reports / Moderation
  // ─────────────────────────────────────────────────────────────────

  @Post('reports/:reportId/resolve')
  async resolveReport(
    @CurrentUser() admin: { id: string },
    @Param('reportId') reportId: string,
    @Body() body: { resolution: 'resolved' | 'dismissed'; note?: string; banUser?: boolean },
  ) {
    await this.adminService.resolveReport({
      adminId: admin.id,
      reportId,
      resolution: body.resolution,
      note: body.note,
      banUser: body.banUser,
    });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Email Template Preview & Test Send
  // ─────────────────────────────────────────────────────────────────

  @Get('email-templates')
  listEmailTemplates() {
    return {
      templates: [
        { id: 'welcome', name: 'Welcome Email', description: 'Sent on successful registration' },
        { id: 'connection_request', name: 'Connection Request', description: 'Sent when someone requests to connect' },
        { id: 'connection_accepted', name: 'Connection Accepted', description: 'Sent when a connection is accepted' },
        { id: 'new_message', name: 'New Message', description: 'Sent when a new message arrives' },
        { id: 'session_reminder', name: 'Session Reminder', description: 'Sent 24h before a mentor session' },
        { id: 'weekly_digest', name: 'Weekly Digest', description: 'Personalized weekly recommendations' },
        { id: 'password_reset', name: 'Password Reset', description: 'Sent on password reset request' },
      ],
    };
  }

  @Get('email-templates/:templateId/preview')
  previewEmailTemplate(@Param('templateId') templateId: string) {
    const templates: Record<string, { subject: string; html: string }> = {
      welcome: {
        subject: 'Welcome to CoFounderBay!',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
  <h1 style="color:#5b6ef5">Welcome to CoFounderBay!</h1>
  <p>Your account has been created. Start exploring founders, mentors, and investors.</p>
  <a href="{{FRONTEND_URL}}/discover" style="background:#5b6ef5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Explore Now</a>
</div>`,
      },
      connection_request: {
        subject: '{{SENDER_NAME}} wants to connect with you',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
  <h2>New Connection Request</h2>
  <p><strong>{{SENDER_NAME}}</strong> ({{SENDER_ROLE}}) wants to connect with you on CoFounderBay.</p>
  <a href="{{FRONTEND_URL}}/connections" style="background:#5b6ef5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">View Request</a>
</div>`,
      },
      weekly_digest: {
        subject: 'Your weekly founder recommendations',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
  <h2>People you should meet this week</h2>
  <p>Based on your profile and activity, here are this week's top matches:</p>
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
    <strong>{{MATCH_NAME}}</strong> — {{MATCH_ROLE}}<br/>
    <span style="color:#6b7280">{{MATCH_REASON}}</span>
  </div>
  <a href="{{FRONTEND_URL}}/discover" style="background:#5b6ef5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">See All Matches</a>
</div>`,
      },
      password_reset: {
        subject: 'Reset your CoFounderBay password',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
  <h2>Password Reset</h2>
  <p>Click the link below to reset your password. This link expires in 1 hour.</p>
  <a href="{{RESET_URL}}" style="background:#5b6ef5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Reset Password</a>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
</div>`,
      },
    };
    const tpl = templates[templateId];
    if (!tpl) throw new BadRequestException(`Unknown template: ${templateId}`);
    return tpl;
  }

  @Post('email-templates/:templateId/test-send')
  async testSendEmail(
    @Param('templateId') templateId: string,
    @Body() body: { to: string },
  ) {
    if (!body.to) throw new BadRequestException('Recipient email required');
    if (!this.mailer.isEnabled()) {
      return { sent: false, reason: 'Email not configured (SMTP settings missing)' };
    }
    const templates: Record<string, { subject: string; html: string }> = {
      welcome: { subject: '[TEST] Welcome to CoFounderBay!', html: '<h1>Welcome!</h1><p>This is a test email.</p>' },
      weekly_digest: { subject: '[TEST] Weekly digest', html: '<h1>Weekly Digest</h1><p>Test email.</p>' },
    };
    const tpl = templates[templateId] ?? { subject: `[TEST] ${templateId}`, html: `<p>Test for template: ${templateId}</p>` };
    await this.mailer.sendEmail({ to: body.to, subject: tpl.subject, html: tpl.html });
    return { sent: true, to: body.to };
  }

  // ─────────────────────────────────────────────────────────────────
  // Taxonomy / Skill Management
  // ─────────────────────────────────────────────────────────────────

  @Get('skills')
  async listSkills(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 100;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    return this.adminService.listSkillsAdmin({ q, category, limit, offset });
  }

  @Post('skills')
  async createSkill(
    @CurrentUser() admin: { id: string },
    @Body() body: { name: string; slug: string; category?: string },
  ) {
    return this.adminService.createSkill(admin.id, body);
  }

  @Patch('skills/:skillId')
  async updateSkill(
    @CurrentUser() admin: { id: string },
    @Param('skillId') skillId: string,
    @Body() body: { name?: string; slug?: string; category?: string | null },
  ) {
    return this.adminService.updateSkill(admin.id, skillId, body);
  }

  @Delete('skills/:skillId')
  async deleteSkill(
    @CurrentUser() admin: { id: string },
    @Param('skillId') skillId: string,
  ) {
    await this.adminService.deleteSkill(admin.id, skillId);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Audit Log
  // ─────────────────────────────────────────────────────────────────

  @Get('audit-logs')
  async listAuditLogs(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    return this.auditService.list({ actorId, action, entityType, limit, offset });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE G4 — SCORE INSPECTION CONSOLE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /admin/score/:userId
   * Full scoring report: XP breakdown, badges, streak, contributions, anomalies.
   */
  @Get('score/:userId')
  async inspectUserScore(@Param('userId') userId: string) {
    return this.scoringInspector.inspectUser(userId);
  }

  /**
   * GET /admin/score/platform/xp-distribution
   * Platform-wide XP histogram for analytics dashboard.
   */
  @Get('score/platform/xp-distribution')
  async getXPDistribution() {
    return this.scoringInspector.getXPDistribution();
  }

  /**
   * GET /admin/score/platform/badge-rates
   * Badge unlock rates across all users.
   */
  @Get('score/platform/badge-rates')
  async getBadgeUnlockRates() {
    return this.scoringInspector.getBadgeUnlockRates();
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE G4 — ANTI-ABUSE MONITOR
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /admin/abuse
   * List abuse flags with optional status/type filters.
   */
  @Get('abuse')
  async listAbuseFlags(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;
    return this.abuseDetection.listFlags({ status, type, limit, offset });
  }

  /**
   * GET /admin/abuse/stats
   * Aggregate abuse statistics: totals by type, top offenders.
   */
  @Get('abuse/stats')
  async getAbuseStats() {
    return this.abuseDetection.getAbuseStats();
  }

  /**
   * POST /admin/abuse/:flagId/resolve
   * Admin resolves a flag with an action (warn, reduce XP, dismiss, etc.)
   */
  @Post('abuse/:flagId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveAbuseFlag(
    @CurrentUser() admin: { id: string },
    @Param('flagId') flagId: string,
    @Body() body: {
      action: 'reduced_xp' | 'streak_freeze' | 'warning' | 'safe' | 'banned';
      status: 'actioned' | 'dismissed';
    },
  ) {
    if (!body.action || !body.status) throw new BadRequestException('action and status are required');
    await this.abuseDetection.resolveFlag({
      flagId,
      resolvedById: admin.id,
      action: body.action,
      status: body.status,
    });
    return { success: true };
  }

  /**
   * POST /admin/abuse/run-detection/:userId
   * Manually trigger abuse detection for a specific user.
   */
  @Post('abuse/run-detection/:userId')
  @HttpCode(HttpStatus.OK)
  async runAbuseDetection(@Param('userId') userId: string) {
    return this.abuseDetection.runDetectionForUser(userId);
  }

  /**
   * POST /admin/abuse/run-ring-detection
   * Manually trigger mutual endorsement ring scan (expensive — admin only).
   */
  @Post('abuse/run-ring-detection')
  @HttpCode(HttpStatus.OK)
  async runRingDetection() {
    return this.abuseDetection.runRingDetection();
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE G4 — EXPERIMENTATION PANEL
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /admin/experiments
   * List all experiments with assignment counts.
   */
  @Get('experiments')
  async listExperiments() {
    return this.experimentation.listExperiments();
  }

  /**
   * POST /admin/experiments
   * Create a new A/B experiment.
   */
  @Post('experiments')
  async createExperiment(
    @CurrentUser() admin: { id: string },
    @Body() body: {
      name: string;
      description?: string;
      key: string;
      variantA: Record<string, unknown>;
      variantB: Record<string, unknown>;
      splitRatio?: number;
    },
  ) {
    if (!body.name || !body.key || !body.variantA || !body.variantB) {
      throw new BadRequestException('name, key, variantA, variantB are required');
    }
    return this.experimentation.createExperiment({ ...body, createdById: admin.id });
  }

  /**
   * PATCH /admin/experiments/:id
   * Update experiment config (name, description, variants, splitRatio).
   */
  @Patch('experiments/:id')
  async updateExperiment(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      description: string;
      variantA: Record<string, unknown>;
      variantB: Record<string, unknown>;
      splitRatio: number;
    }>,
  ) {
    await this.experimentation.updateExperiment(id, body);
    return { success: true };
  }

  /**
   * POST /admin/experiments/:id/activate
   * Activate an experiment (start assigning users to variants).
   */
  @Post('experiments/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateExperiment(@Param('id') id: string) {
    await this.experimentation.activateExperiment(id);
    return { success: true };
  }

  /**
   * POST /admin/experiments/:id/deactivate
   * Deactivate an experiment (stop new assignments; keep existing).
   */
  @Post('experiments/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateExperiment(@Param('id') id: string) {
    await this.experimentation.deactivateExperiment(id);
    return { success: true };
  }

  /**
   * GET /admin/experiments/:id/metrics
   * Per-variant metrics: XP avg, badge rate, 7d retention.
   */
  @Get('experiments/:id/metrics')
  async getExperimentMetrics(@Param('id') id: string) {
    return this.experimentation.getExperimentMetrics(id);
  }

  /**
   * DELETE /admin/experiments/:id
   * Delete an experiment (removes all assignments).
   */
  @Delete('experiments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExperiment(@Param('id') id: string) {
    await this.experimentation.deleteExperiment(id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE G4 — SYSTEM CONFIG (LIVE WEIGHT TUNING)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /admin/config
   * List all system config keys, optionally filtered by category.
   */
  @Get('config')
  async listConfig(@Query('category') category?: string) {
    return this.experimentation.listConfigs(category);
  }

  /**
   * PUT /admin/config/:key
   * Upsert a config value (create or update).
   */
  @Put('config/:key')
  async upsertConfig(
    @CurrentUser() admin: { id: string },
    @Param('key') key: string,
    @Body() body: { value: unknown; description?: string; category?: string },
  ) {
    if (body.value === undefined) throw new BadRequestException('value is required');
    return this.experimentation.upsertConfig({
      key,
      value: body.value,
      description: body.description,
      category: body.category,
      updatedById: admin.id,
    });
  }

  /**
   * DELETE /admin/config/:key
   * Remove a config key (reverts to hardcoded default).
   */
  @Delete('config/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('key') key: string) {
    await this.experimentation.deleteConfig(key);
  }

  /**
   * POST /admin/config/seed
   * Seed default config values (idempotent — skips existing keys).
   */
  @Post('config/seed')
  @HttpCode(HttpStatus.OK)
  async seedDefaultConfigs(@CurrentUser() admin: { id: string }) {
    const seeded = await this.experimentation.seedDefaultConfigs(admin.id);
    return { seeded };
  }
}
