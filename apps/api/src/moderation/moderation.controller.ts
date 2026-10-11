import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ReportStatus, ReportType, UserModerationStatus } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ModerationService } from './moderation.service';

const createReportSchema = z.object({
  reportedId: z.string().uuid(),
  type: z.nativeEnum(ReportType),
  reason: z.string().trim().min(8).max(3000),
  context: z.unknown().optional(),
});

const updateReportSchema = z.object({
  status: z.nativeEnum(ReportStatus),
  moderationStatus: z.nativeEnum(UserModerationStatus).optional(),
});

const updateUserStatusSchema = z.object({
  moderationStatus: z.nativeEnum(UserModerationStatus),
});

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  async createReport(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = createReportSchema.parse(body);
    const report = await this.moderation.createReport({
      reporterId: user.id,
      reportedId: input.reportedId,
      type: input.type,
      reason: input.reason,
      context: input.context,
    });
    return { report };
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ModerationAdminController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('reports')
  async listReports(
    @Query('status') status?: ReportStatus,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const reports = await this.moderation.listReports({
      status,
      q: q?.trim() || undefined,
      limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
    });
    return { reports };
  }

  @Patch('reports/:reportId')
  async updateReport(
    @CurrentUser() user: { id: string },
    @Param('reportId') reportId: string,
    @Body() body: unknown,
  ) {
    const input = updateReportSchema.parse(body);
    const report = await this.moderation.updateReportStatus({
      reportId,
      resolverId: user.id,
      status: input.status,
      moderationStatus: input.moderationStatus,
    });
    return { report };
  }
}
