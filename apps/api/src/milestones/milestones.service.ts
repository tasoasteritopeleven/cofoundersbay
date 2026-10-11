import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MilestoneStatus = 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type MilestonePriority = 'low' | 'medium' | 'high';

export interface CreateMilestoneDto {
  title: string;
  description?: string;
  status?: MilestoneStatus;
  priority?: MilestonePriority;
  category?: string;
  dueDate?: string;
  progress?: number;
  notes?: string;
  collaboratorId?: string;
}

export interface UpdateMilestoneDto extends Partial<CreateMilestoneDto> {
  completedAt?: string | null;
}

export interface MilestoneFilters {
  status?: MilestoneStatus;
  priority?: MilestonePriority;
  category?: string;
  collaboratorId?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: MilestoneFilters = {}) {
    const { status, priority, category, collaboratorId, limit = 50, cursor } = filters;

    const where: any = {
      OR: [
        { ownerId: userId },
        { collaboratorId: userId },
      ],
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (collaboratorId) where.collaboratorId = collaboratorId;

    const items = await this.prisma.milestone.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        collaborator: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      milestones: page.map(this.mapMilestone),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      total: page.length,
    };
  }

  async getSummary(userId: string) {
    const all = await this.prisma.milestone.findMany({
      where: {
        OR: [{ ownerId: userId }, { collaboratorId: userId }],
      },
      select: { status: true, dueDate: true, priority: true },
    });

    const now = new Date();
    const counts = { todo: 0, in_progress: 0, blocked: 0, completed: 0, cancelled: 0 };
    let overdue = 0;
    let dueSoon = 0;
    const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const m of all) {
      counts[m.status as keyof typeof counts] = (counts[m.status as keyof typeof counts] ?? 0) + 1;
      if (m.dueDate && m.status !== 'completed' && m.status !== 'cancelled') {
        if (m.dueDate < now) overdue++;
        else if (m.dueDate <= soonThreshold) dueSoon++;
      }
    }

    const total = all.length;
    const completionRate = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

    return { counts, total, overdue, dueSoon, completionRate };
  }

  async findOne(id: string, userId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } },
        },
        collaborator: {
          select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } },
        },
      },
    });

    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.ownerId !== userId && milestone.collaboratorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.mapMilestone(milestone as any);
  }

  async create(userId: string, dto: CreateMilestoneDto) {
    const data: any = {
      ownerId: userId,
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'todo',
      priority: dto.priority ?? 'medium',
      category: dto.category,
      progress: Math.min(100, Math.max(0, dto.progress ?? 0)),
      notes: dto.notes,
    };

    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.collaboratorId && dto.collaboratorId !== userId) {
      data.collaboratorId = dto.collaboratorId;
    }

    const milestone = await this.prisma.milestone.create({
      data,
      include: {
        collaborator: {
          select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } },
        },
      },
    });

    return this.mapMilestone(milestone as any);
  }

  async update(id: string, userId: string, dto: UpdateMilestoneDto) {
    const existing = await this.prisma.milestone.findUnique({
      where: { id },
      select: { ownerId: true, collaboratorId: true, status: true },
    });

    if (!existing) throw new NotFoundException('Milestone not found');
    if (existing.ownerId !== userId && existing.collaboratorId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'completed' && existing.status !== 'completed') {
        data.completedAt = new Date();
        data.progress = 100;
      } else if (dto.status !== 'completed') {
        data.completedAt = null;
      }
    }
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.progress !== undefined) data.progress = Math.min(100, Math.max(0, dto.progress));
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.collaboratorId !== undefined) {
      data.collaboratorId = dto.collaboratorId || null;
    }

    const milestone = await this.prisma.milestone.update({
      where: { id },
      data,
      include: {
        collaborator: {
          select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } },
        },
      },
    });

    return this.mapMilestone(milestone as any);
  }

  async delete(id: string, userId: string) {
    const existing = await this.prisma.milestone.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!existing) throw new NotFoundException('Milestone not found');
    // Only owner can delete
    if (existing.ownerId !== userId) throw new ForbiddenException('Only the owner can delete a milestone');

    await this.prisma.milestone.delete({ where: { id } });
    return { ok: true };
  }

  private mapMilestone(m: any) {
    return {
      id: m.id,
      ownerId: m.ownerId,
      collaboratorId: m.collaboratorId ?? null,
      collaborator: m.collaborator
        ? {
            id: m.collaborator.id,
            displayName: m.collaborator.profile?.displayName ?? 'Unknown',
            avatarUrl: m.collaborator.profile?.avatarUrl ?? null,
          }
        : null,
      title: m.title,
      description: m.description ?? null,
      status: m.status as MilestoneStatus,
      priority: m.priority as MilestonePriority,
      category: m.category ?? null,
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      progress: m.progress ?? 0,
      notes: m.notes ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}
