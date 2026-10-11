import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MarketplaceCategory = 'legal' | 'finance' | 'marketing' | 'development' | 'design' | 'consulting' | 'coaching' | 'other';

export interface CreateMarketplaceServiceDto {
  title: string;
  description?: string;
  category?: MarketplaceCategory;
  providerName: string;
  providerLogo?: string;
  pricing?: string;
  contactUrl?: string;
  websiteUrl?: string;
  tags?: string[];
  isFeatured?: boolean;
}

export interface UpdateMarketplaceServiceDto {
  title?: string;
  description?: string;
  category?: MarketplaceCategory;
  providerName?: string;
  providerLogo?: string;
  pricing?: string;
  contactUrl?: string;
  websiteUrl?: string;
  tags?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface MarketplaceServiceFilters {
  category?: MarketplaceCategory;
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMarketplaceServiceDto) {
    return this.prisma.marketplaceService.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category || 'other',
        providerName: dto.providerName,
        providerLogo: dto.providerLogo,
        pricing: dto.pricing,
        contactUrl: dto.contactUrl,
        websiteUrl: dto.websiteUrl,
        tags: dto.tags || [],
        isFeatured: dto.isFeatured ?? false,
        createdById: userId,
      },
    });
  }

  /**
   * Public listings, or one provider's own.
   *
   * `createdById` has been on the model all along, and nothing filtered by it,
   * so a provider had no way to see the services they had published —
   * /provider/services listed a fixed array instead. With `createdById` set,
   * inactive listings are included too: their owner is the one person who
   * needs to see a service they have turned off.
   */
  async findAll(filters: MarketplaceServiceFilters & { createdById?: string } = {}) {
    const { category, search, featured, limit = 20, offset = 0, createdById } = filters;

    const where: any = createdById ? { createdById } : { isActive: true };
    if (category) where.category = category;
    if (featured !== undefined) where.isFeatured = featured;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { providerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      this.prisma.marketplaceService.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.marketplaceService.count({ where }),
    ]);

    return {
      services: services.map((s) => ({
        id: s.id,
        isActive: s.isActive,
        title: s.title,
        description: s.description,
        category: s.category,
        providerName: s.providerName,
        providerLogo: s.providerLogo,
        pricing: s.pricing,
        contactUrl: s.contactUrl,
        websiteUrl: s.websiteUrl,
        tags: s.tags as string[] || [],
        isFeatured: s.isFeatured,
        createdAt: s.createdAt.toISOString(),
      })),
      total,
      hasMore: offset + services.length < total,
    };
  }

  async findOne(id: string) {
    const service = await this.prisma.marketplaceService.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Marketplace service not found');
    }

    return {
      id: service.id,
      title: service.title,
      description: service.description,
      category: service.category,
      providerName: service.providerName,
      providerLogo: service.providerLogo,
      pricing: service.pricing,
      contactUrl: service.contactUrl,
      websiteUrl: service.websiteUrl,
      tags: service.tags as string[] || [],
      isFeatured: service.isFeatured,
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    };
  }

  async update(id: string, userId: string, dto: UpdateMarketplaceServiceDto, isAdmin = false) {
    const service = await this.prisma.marketplaceService.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!service) {
      throw new NotFoundException('Marketplace service not found');
    }

    if (service.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('You can only edit your own services');
    }

    return this.prisma.marketplaceService.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.providerName && { providerName: dto.providerName }),
        ...(dto.providerLogo !== undefined && { providerLogo: dto.providerLogo }),
        ...(dto.pricing !== undefined && { pricing: dto.pricing }),
        ...(dto.contactUrl !== undefined && { contactUrl: dto.contactUrl }),
        ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string, userId: string, isAdmin = false) {
    const service = await this.prisma.marketplaceService.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!service) {
      throw new NotFoundException('Marketplace service not found');
    }

    if (service.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own services');
    }

    await this.prisma.marketplaceService.delete({ where: { id } });
    return { ok: true };
  }

  async getCategories(): Promise<string[]> {
    const results = await this.prisma.marketplaceService.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });
    return results.map((r) => r.category);
  }
}
