import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type JobPostingView = {
  id: string;
  title: string;
  role: string | null;
  location: string | null;
  isRemote: boolean;
  isFeatured: boolean;
  /** The poster's id, so a reader can open their profile or message them. */
  creator: { id: string; displayName: string; avatarUrl: string | null };
  href?: string;
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(
    creatorId: string,
    data: {
      title: string;
      description?: string | null;
      role?: string | null;
      location?: string | null;
      isRemote?: boolean;
    },
  ): Promise<JobPostingView & { description: string | null; createdAt: string }> {
    const job = await this.prisma.jobPosting.create({
      data: {
        creatorId,
        title: data.title,
        description: data.description ?? null,
        role: data.role ?? null,
        location: data.location ?? null,
        isRemote: data.isRemote ?? false,
        isActive: true,
      },
      include: {
        creator: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    return {
      id: job.id,
      title: job.title,
      role: job.role,
      location: job.location,
      isRemote: job.isRemote,
      isFeatured: job.isFeatured,
      description: job.description,
      createdAt: job.createdAt.toISOString(),
      creator: {
        id: job.creatorId,
        displayName: job.creator.profile?.displayName ?? 'Anonymous',
        avatarUrl: job.creator.profile?.avatarUrl ?? null,
      },
    };
  }

  async getJob(
    jobId: string,
  ): Promise<JobPostingView & { description: string | null; createdAt: string }> {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        creator: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return {
      id: job.id,
      title: job.title,
      role: job.role,
      location: job.location,
      isRemote: job.isRemote,
      isFeatured: job.isFeatured,
      description: job.description,
      createdAt: job.createdAt.toISOString(),
      creator: {
        id: job.creatorId,
        displayName: job.creator.profile?.displayName ?? 'Anonymous',
        avatarUrl: job.creator.profile?.avatarUrl ?? null,
      },
    };
  }

  async deleteJob(jobId: string, requesterId: string): Promise<void> {
    const job = await this.prisma.jobPosting.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.creatorId !== requesterId) throw new ForbiddenException('Not authorized');
    await this.prisma.jobPosting.delete({ where: { id: jobId } });
  }

  async listActive(limit = 10): Promise<JobPostingView[]> {
    const jobs = await this.prisma.jobPosting.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        creator: {
          select: {
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return jobs.map((j) => ({
      id: j.id,
      title: j.title,
      role: j.role,
      location: j.location,
      isRemote: j.isRemote,
      isFeatured: j.isFeatured,
      creator: {
        id: j.creatorId,
        displayName: j.creator.profile?.displayName ?? 'Anonymous',
        avatarUrl: j.creator.profile?.avatarUrl ?? null,
      },
      // "View" opened /discover for every job; it opens the poster now.
      href: `/profiles/${j.creatorId}`,
    }));
  }
}
