import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AutomationService } from './automation.service';

@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  // ── Rules ──────────────────────────────────────────────────────────────────

  @Get('rules')
  async listRules(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.automation.listRules({
      tenantId: tenantId ?? undefined,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('rules/:id')
  async getRule(@Param('id') id: string) {
    return this.automation.getRule(id);
  }

  @Post('rules')
  async createRule(
    @Body() body: {
      name: string;
      description?: string;
      triggerType: string;
      conditionDef?: unknown;
      actionDef: unknown;
      delaySeconds?: number;
      scheduleExpression?: string;
      priority?: number;
      tenantId?: string;
    },
    @Request() req: any,
  ) {
    return this.automation.createRule({ ...body, createdBy: req.user?.id });
  }

  @Patch('rules/:id')
  async updateRule(@Param('id') id: string, @Body() body: any) {
    return this.automation.updateRule(id, body);
  }

  @Patch('rules/:id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'paused' | 'archived' },
  ) {
    return this.automation.setRuleStatus(id, body.status);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('id') id: string) {
    await this.automation.deleteRule(id);
  }

  @Post('rules/:id/trigger')
  async manualTrigger(@Param('id') id: string, @Request() req: any) {
    await this.automation.manualTrigger(id, req.user?.id);
    return { queued: true };
  }

  // ── Executions ─────────────────────────────────────────────────────────────

  @Get('executions')
  async listExecutions(
    @Query('ruleId') ruleId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.automation.listExecutions({
      ruleId,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('executions/:id/logs')
  async getExecutionLogs(@Param('id') id: string) {
    return this.automation.getExecutionLogs(id);
  }

  // ── Tenant config ──────────────────────────────────────────────────────────

  @Get('config/:tenantId')
  async getTenantConfig(@Param('tenantId') tenantId: string) {
    return this.automation.getTenantConfig(tenantId);
  }

  @Patch('config/:tenantId')
  async upsertTenantConfig(@Param('tenantId') tenantId: string, @Body() body: any) {
    return this.automation.upsertTenantConfig(tenantId, body);
  }

  // ── Notification templates ─────────────────────────────────────────────────

  @Get('templates')
  async listTemplates(@Query('tenantId') tenantId?: string) {
    return this.automation.listTemplates(tenantId);
  }

  @Post('templates')
  async upsertTemplate(@Body() body: any) {
    return this.automation.upsertTemplate(body);
  }
}
