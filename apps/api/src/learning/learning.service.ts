import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type LearningResourceType = 'article' | 'video' | 'course' | 'podcast' | 'book' | 'tool' | 'template';
type LearningDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CreateLearningResourceDto {
  title: string;
  description?: string;
  type?: LearningResourceType;
  category?: string;
  url: string;
  author?: string;
  duration?: number;
  difficulty?: LearningDifficulty;
  tags?: string[];
  imageUrl?: string;
  isFeatured?: boolean;
}

export interface UpdateLearningResourceDto {
  title?: string;
  description?: string;
  type?: LearningResourceType;
  category?: string;
  url?: string;
  author?: string;
  duration?: number;
  difficulty?: LearningDifficulty;
  tags?: string[];
  imageUrl?: string;
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface LearningResourceFilters {
  type?: LearningResourceType;
  category?: string;
  difficulty?: LearningDifficulty;
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateLearningResourceDto) {
    return this.prisma.learningResource.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type || 'article',
        category: dto.category,
        url: dto.url,
        author: dto.author,
        duration: dto.duration,
        difficulty: dto.difficulty || 'beginner',
        tags: dto.tags || [],
        imageUrl: dto.imageUrl,
        isFeatured: dto.isFeatured ?? false,
        createdById: userId,
      },
    });
  }

  async findAll(filters: LearningResourceFilters = {}) {
    const { type, category, difficulty, search, featured, limit = 20, offset = 0 } = filters;

    const where: any = { isActive: true };
    if (type) where.type = type;
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (featured !== undefined) where.isFeatured = featured;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [resources, total] = await Promise.all([
      this.prisma.learningResource.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.learningResource.count({ where }),
    ]);

    return {
      resources: resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        category: r.category,
        url: r.url,
        author: r.author,
        duration: r.duration,
        difficulty: r.difficulty,
        tags: r.tags as string[] || [],
        imageUrl: r.imageUrl,
        isFeatured: r.isFeatured,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      hasMore: offset + resources.length < total,
    };
  }

  async findOne(id: string) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
    });

    if (!resource) {
      throw new NotFoundException('Learning resource not found');
    }

    return {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      category: resource.category,
      url: resource.url,
      author: resource.author,
      duration: resource.duration,
      difficulty: resource.difficulty,
      tags: resource.tags as string[] || [],
      imageUrl: resource.imageUrl,
      isFeatured: resource.isFeatured,
      isActive: resource.isActive,
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    };
  }

  async update(id: string, userId: string, dto: UpdateLearningResourceDto, isAdmin = false) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!resource) {
      throw new NotFoundException('Learning resource not found');
    }

    if (resource.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('You can only edit your own resources');
    }

    return this.prisma.learningResource.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.url && { url: dto.url }),
        ...(dto.author !== undefined && { author: dto.author }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.difficulty && { difficulty: dto.difficulty }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string, userId: string, isAdmin = false) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!resource) {
      throw new NotFoundException('Learning resource not found');
    }

    if (resource.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own resources');
    }

    await this.prisma.learningResource.delete({ where: { id } });
    return { ok: true };
  }

  async getCategories(): Promise<string[]> {
    const results = await this.prisma.learningResource.findMany({
      where: { isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    return results.map((r) => r.category!).filter(Boolean);
  }
}
