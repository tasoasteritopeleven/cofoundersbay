import {
  Controller, Get, Post, Delete, Body, Param,
  Query, UseGuards, BadRequestException, Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('shortlist')
@UseGuards(JwtAuthGuard)
export class ShortlistController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 100);

    const items = await this.prisma.savedProfile.findMany({
      where: { savedById: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                headline: true,
                location: true,
                skills: {
                  take: 5,
                  include: { skill: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      items: page.map((item) => ({
        id: item.id,
        userId: item.userId,
        note: item.note ?? null,
        savedAt: item.createdAt.toISOString(),
        profile: item.user?.profile
          ? {
              displayName: item.user.profile.displayName,
              avatarUrl: item.user.profile.avatarUrl ?? null,
              headline: item.user.profile.headline ?? null,
              role: item.user.role ?? null,
              location: item.user.profile.location ?? null,
              skills: item.user.profile.skills.map((ps) => ps.skill.name),
            }
          : null,
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  @Get('ids')
  async listIds(@CurrentUser() user: { id: string }) {
    const items = await (this.prisma as any).savedProfile.findMany({
      where: { savedById: user.id },
      select: { userId: true },
    });
    return { ids: items.map((i: any) => i.userId) };
  }

  @Post()
  async save(
    @CurrentUser() user: { id: string },
    @Body() body: { userId: string; note?: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (body.userId === user.id) throw new BadRequestException('Cannot save your own profile');

    const target = await this.prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('User not found');

    const existing = await (this.prisma as any).savedProfile.findUnique({
      where: { savedById_userId: { savedById: user.id, userId: body.userId } },
    });

    if (existing) {
      return { ok: true, saved: true, id: existing.id };
    }

    const saved = await (this.prisma as any).savedProfile.create({
      data: {
        savedById: user.id,
        userId: body.userId,
        note: body.note ?? null,
      },
    });

    return { ok: true, saved: true, id: saved.id };
  }

  @Patch(':userId/note')
  async updateNote(
    @CurrentUser() user: { id: string },
    @Param('userId') targetUserId: string,
    @Body() body: { note: string },
  ) {
    const item = await (this.prisma as any).savedProfile.findUnique({
      where: { savedById_userId: { savedById: user.id, userId: targetUserId } },
    });
    if (!item) throw new BadRequestException('Not in shortlist');

    await (this.prisma as any).savedProfile.update({
      where: { id: item.id },
      data: { note: body.note ?? null },
    });
    return { ok: true };
  }

  @Delete(':userId')
  async remove(
    @CurrentUser() user: { id: string },
    @Param('userId') targetUserId: string,
  ) {
    await (this.prisma as any).savedProfile.deleteMany({
      where: { savedById: user.id, userId: targetUserId },
    });
    return { ok: true, saved: false };
  }
}
