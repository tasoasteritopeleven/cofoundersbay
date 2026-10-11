import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateGroupDto,
  UpdateGroupDto,
  CreateGroupPostDto,
  CreateGroupCommentDto,
  GroupFiltersDto,
  PaginationDto,
  UpdateMemberRoleDto,
} from './dto/groups.dto';

const profileSelect = {
  id: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
      headline: true,
    },
  },
  role: true,
} as const;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly automation?: any,
  ) {}

  // ── Create group ──────────────────────────────────────────────────────────

  async createGroup(userId: string, dto: CreateGroupDto) {
    const existing = await this.prisma.group.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Group slug already taken');

    const group = await this.prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          privacy: dto.privacy as any,
          category: dto.category ?? null,
          tags: (dto.tags as any) ?? [],
          coverImageUrl: dto.coverImageUrl ?? null,
          avatarUrl: dto.avatarUrl ?? null,
          rules: (dto.rules as any) ?? [],
          createdById: userId,
        },
      });
      await tx.groupMember.create({
        data: { groupId: g.id, userId, role: 'owner' },
      });
      return g;
    });

    return this.getGroup(group.id, userId);
  }

  // ── List groups ───────────────────────────────────────────────────────────

  async listGroups(filters: GroupFiltersDto, currentUserId?: string) {
    const where: any = {};

    if (filters.privacy) {
      where.privacy = filters.privacy;
    } else if (filters.myGroups && currentUserId) {
      where.members = { some: { userId: currentUserId } };
    } else {
      where.privacy = { in: ['public', 'private'] };
    }

    if (filters.category) where.category = filters.category;

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any =
      filters.sort === 'recent'
        ? { createdAt: 'desc' }
        : filters.sort === 'trending'
          ? { updatedAt: 'desc' }
          : { members: { _count: 'desc' } };

    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        orderBy,
        take: filters.limit,
        skip: filters.offset,
        include: {
          createdBy: { select: profileSelect },
          _count: { select: { members: true, posts: true } },
          members:
            currentUserId
              ? { where: { userId: currentUserId }, select: { role: true } }
              : false,
        },
      }),
      this.prisma.group.count({ where }),
    ]);

    return {
      groups: groups.map((g) => this.mapGroup(g, currentUserId)),
      total,
      hasMore: filters.offset + filters.limit < total,
    };
  }

  // ── Get single group ──────────────────────────────────────────────────────

  async getGroup(groupId: string, currentUserId?: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        createdBy: { select: profileSelect },
        _count: { select: { members: true, posts: true, events: true } },
        members: {
          include: { user: { select: profileSelect } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          take: 20,
        },
      },
    });

    if (!group) throw new NotFoundException('Group not found');

    let membership: { role: string } | null = null;
    if (currentUserId) {
      membership = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: currentUserId } },
        select: { role: true },
      });
    }

    return {
      group: {
        ...this.mapGroup(group, currentUserId),
        members: group.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          user: {
            id: m.user.id,
            displayName: m.user.profile?.displayName ?? 'Unknown',
            avatarUrl: m.user.profile?.avatarUrl ?? null,
            headline: m.user.profile?.headline ?? null,
            role: m.user.role,
          },
        })),
      },
      isMember: !!membership,
      memberRole: membership?.role ?? null,
    };
  }

  // ── Get group by slug ─────────────────────────────────────────────────────

  async getGroupBySlug(slug: string, currentUserId?: string) {
    const group = await this.prisma.group.findUnique({ where: { slug } });
    if (!group) throw new NotFoundException('Group not found');
    return this.getGroup(group.id, currentUserId);
  }

  // ── Update group ──────────────────────────────────────────────────────────

  async updateGroup(groupId: string, userId: string, dto: UpdateGroupDto) {
    await this.requireRole(groupId, userId, ['owner', 'admin']);

    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.privacy !== undefined && { privacy: dto.privacy as any }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.tags !== undefined && { tags: dto.tags as any }),
        ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.rules !== undefined && { rules: dto.rules as any }),
      },
    });

    return { group };
  }

  // ── Delete group ──────────────────────────────────────────────────────────

  async deleteGroup(groupId: string, userId: string) {
    await this.requireRole(groupId, userId, ['owner']);
    await this.prisma.group.delete({ where: { id: groupId } });
    return { ok: true };
  }

  // ── Join group ────────────────────────────────────────────────────────────

  async joinGroup(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.privacy === 'secret') {
      throw new ForbiddenException('Cannot join secret group without invitation');
    }

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) throw new ConflictException('Already a member');

    const member = await this.prisma.groupMember.create({
      data: { groupId, userId, role: 'member' },
      include: { user: { select: profileSelect } },
    });

    this.automation?.fire?.({
      triggerType: 'community_join',
      targetUserId: userId,
      targetEntityType: 'group',
      targetEntityId: groupId,
      payload: { groupName: group.name, privacy: group.privacy },
    }).catch(() => {});

    return {
      member: {
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
      },
    };
  }

  // ── Leave group ───────────────────────────────────────────────────────────

  async leaveGroup(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new NotFoundException('Not a member');
    if (membership.role === 'owner') {
      throw new ForbiddenException(
        'Owner cannot leave. Transfer ownership first.',
      );
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });
    return { ok: true };
  }

  // ── Update member role ────────────────────────────────────────────────────

  async updateMemberRole(
    groupId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.requireRole(groupId, actorId, ['owner', 'admin']);

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException('Cannot change owner role');
    }

    const updated = await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role: dto.role as any },
    });

    return { member: { userId: updated.userId, role: updated.role } };
  }

  // ── Remove member ─────────────────────────────────────────────────────────

  async removeMember(groupId: string, actorId: string, targetUserId: string) {
    await this.requireRole(groupId, actorId, ['owner', 'admin', 'moderator']);

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException('Cannot remove group owner');
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    return { ok: true };
  }

  // ── Posts ─────────────────────────────────────────────────────────────────

  async createPost(groupId: string, userId: string, dto: CreateGroupPostDto) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new ForbiddenException('Must be a member to post');

    const post = await this.prisma.groupPost.create({
      data: {
        groupId,
        authorId: userId,
        content: dto.content,
        mediaUrls: (dto.mediaUrls as any) ?? [],
        isPinned: dto.isPinned ?? false,
      },
      include: {
        author: { select: profileSelect },
        _count: { select: { comments: true, reactions: true } },
      },
    });

    return { post: this.mapPost(post, userId) };
  }

  async listPosts(groupId: string, pagination: PaginationDto, currentUserId?: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    // For private/secret groups require membership
    if (group.privacy !== 'public' && currentUserId) {
      const membership = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: currentUserId } },
      });
      if (!membership) throw new ForbiddenException('Must be a member to view posts');
    }

    const [posts, total] = await Promise.all([
      this.prisma.groupPost.findMany({
        where: { groupId, deletedAt: null },
        include: {
          author: { select: profileSelect },
          _count: { select: { comments: true, reactions: true } },
          reactions: currentUserId
            ? { where: { userId: currentUserId }, select: { emoji: true } }
            : false,
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.groupPost.count({ where: { groupId, deletedAt: null } }),
    ]);

    return {
      posts: posts.map((p) => this.mapPost(p, currentUserId)),
      total,
      hasMore: pagination.offset + pagination.limit < total,
    };
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.groupPost.findUnique({
      where: { id: postId },
      include: {
        group: { include: { members: { where: { userId, role: { in: ['owner', 'admin', 'moderator'] } } } } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');

    const isAuthor = post.authorId === userId;
    const isModerator = post.group.members.length > 0;
    if (!isAuthor && !isModerator) throw new ForbiddenException('Not allowed');

    await this.prisma.groupPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async createComment(
    groupId: string,
    postId: string,
    userId: string,
    dto: CreateGroupCommentDto,
  ) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new ForbiddenException('Must be a member to comment');

    const post = await this.prisma.groupPost.findUnique({ where: { id: postId } });
    if (!post || post.groupId !== groupId) throw new NotFoundException('Post not found');

    const comment = await this.prisma.groupPostComment.create({
      data: { postId, authorId: userId, content: dto.content },
      include: { author: { select: profileSelect } },
    });

    return { comment: this.mapComment(comment) };
  }

  async listComments(postId: string, pagination: PaginationDto) {
    const [comments, total] = await Promise.all([
      this.prisma.groupPostComment.findMany({
        where: { postId, deletedAt: null },
        include: { author: { select: profileSelect } },
        orderBy: { createdAt: 'asc' },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.groupPostComment.count({ where: { postId, deletedAt: null } }),
    ]);

    return { comments: comments.map(this.mapComment), total };
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  async reactToPost(groupId: string, postId: string, userId: string, emoji: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new ForbiddenException('Must be a member to react');

    const existing = await this.prisma.groupPostReaction.findFirst({
      where: { postId, userId },
    });

    if (existing) {
      if (existing.emoji === emoji) {
        // Toggle off
        await this.prisma.groupPostReaction.delete({ where: { id: existing.id } });
        return { action: 'removed', emoji };
      }
      // Update emoji
      await this.prisma.groupPostReaction.update({
        where: { id: existing.id },
        data: { emoji },
      });
      return { action: 'updated', emoji };
    }

    await this.prisma.groupPostReaction.create({
      data: { postId, userId, emoji },
    });
    return { action: 'added', emoji };
  }

  // ── Members list ──────────────────────────────────────────────────────────

  async listMembers(groupId: string, pagination: PaginationDto) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const [members, total] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { groupId },
        include: { user: { select: profileSelect } },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.groupMember.count({ where: { groupId } }),
    ]);

    return {
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          displayName: m.user.profile?.displayName ?? 'Unknown',
          avatarUrl: m.user.profile?.avatarUrl ?? null,
          headline: m.user.profile?.headline ?? null,
          role: m.user.role,
        },
      })),
      total,
    };
  }

  // ── My groups ─────────────────────────────────────────────────────────────

  async getMyGroups(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            createdBy: { select: profileSelect },
            _count: { select: { members: true, posts: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return {
      groups: memberships.map((m) => ({
        ...this.mapGroup(m.group, userId),
        memberRole: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async requireRole(
    groupId: string,
    userId: string,
    allowedRoles: string[],
  ) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a member');
    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return membership;
  }

  private mapGroup(g: any, currentUserId?: string) {
    const myMembership = currentUserId
      ? (g.members as any[])?.find?.((m: any) => m.userId === currentUserId)
      : undefined;

    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      description: g.description,
      privacy: g.privacy,
      category: g.category,
      tags: g.tags ?? [],
      coverImageUrl: g.coverImageUrl,
      avatarUrl: g.avatarUrl,
      rules: g.rules ?? [],
      memberCount: g._count?.members ?? 0,
      postCount: g._count?.posts ?? 0,
      eventCount: g._count?.events ?? 0,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      createdBy: g.createdBy
        ? {
            id: g.createdBy.id,
            displayName: g.createdBy.profile?.displayName ?? 'Unknown',
            avatarUrl: g.createdBy.profile?.avatarUrl ?? null,
            role: g.createdBy.role,
          }
        : null,
      isMember: !!myMembership,
      memberRole: myMembership?.role ?? null,
    };
  }

  private mapPost(p: any, currentUserId?: string) {
    const myReaction = currentUserId
      ? (p.reactions as any[])?.find?.((r: any) => r.userId === currentUserId)
      : undefined;

    return {
      id: p.id,
      groupId: p.groupId,
      content: p.content,
      mediaUrls: p.mediaUrls ?? [],
      isPinned: p.isPinned,
      createdAt: p.createdAt,
      editedAt: p.editedAt,
      commentCount: p._count?.comments ?? 0,
      reactionCount: p._count?.reactions ?? 0,
      myReaction: myReaction?.emoji ?? null,
      author: {
        id: p.author.id,
        displayName: p.author.profile?.displayName ?? 'Unknown',
        avatarUrl: p.author.profile?.avatarUrl ?? null,
        headline: p.author.profile?.headline ?? null,
        role: p.author.role,
      },
    };
  }

  private mapComment(c: any) {
    return {
      id: c.id,
      postId: c.postId,
      content: c.content,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      author: {
        id: c.author.id,
        displayName: c.author.profile?.displayName ?? 'Unknown',
        avatarUrl: c.author.profile?.avatarUrl ?? null,
        role: c.author.role,
      },
    };
  }
}
