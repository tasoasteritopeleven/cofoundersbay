import { Controller, Get, Param, Post, Delete, Query, UseGuards, Patch, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('unread') unread?: string,
    @Query('type') type?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '30', 10) || 30, 1), 100);

    const where: any = { userId: user.id };
    
    if (unread === 'true') {
      where.readAt = null;
    }
    
    if (type && type !== 'all') {
      where.type = type;
    }

    const items = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return {
      notifications: page.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        meta: n.meta,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt ? n.readAt.toISOString() : null,
      })),
      nextCursor,
    };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Post('mark-all-read')
  async markAllRead(@CurrentUser() user: { id: string }) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Delete(':id')
  async deleteNotification(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.prisma.notification.deleteMany({
      where: { id, userId: user.id },
    });
    return { ok: true };
  }

  @Delete()
  async deleteAll(@CurrentUser() user: { id: string }) {
    await this.prisma.notification.deleteMany({
      where: { userId: user.id },
    });
    return { ok: true };
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: { id: string }) {
    const digest = await this.prisma.activityDigestPreference.findUnique({
      where: { userId: user.id },
    });
    return {
      // No preference row means the user has not explicitly opted into email.
      digestFrequency: digest?.frequency ?? 'never',
    };
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    if (body.digestFrequency) {
      await this.prisma.activityDigestPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, frequency: body.digestFrequency },
        update: { frequency: body.digestFrequency },
      });
    }
    return { ok: true };
  }
}

