import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { BusinessErrorException } from '../common/errors/business-error.exception';
import { User, Profile } from '@prisma/client';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role: 'founder' | 'mentor' | 'investor' | 'org';
  displayName?: string;
}

export interface UpdateUserData {
  displayName?: string;
  role?: 'founder' | 'mentor' | 'investor' | 'org';
  moderationStatus?: 'active' | 'suspended' | 'banned';
}

export interface UserWithProfile extends User {
  profile?: Profile | null;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Create a new user with optional profile
   */
  async createUser(data: CreateUserData): Promise<User> {
    const cacheKey = `user:email:${data.email}`;
    
    // Check if user already exists
    const existingUser = await this.getUserByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create user
    const baseSlug = data.email.split('@')[0].replace(/[^a-z0-9]/g, '-').toLowerCase();
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        slug,
        passwordHash: data.passwordHash,
        role: data.role,
        moderationStatus: 'active',
        lastSeenAt: new Date(),
      },
    });

    // Create profile if display name provided
    if (data.displayName) {
      await this.prisma.profile.create({
        data: {
          userId: user.id,
          displayName: data.displayName,
          visibilityRules: {},
          rolePayload: {},
        },
      });
    }

    // Invalidate cache
    await this.cache.invalidateByTag(`user:${user.id}`);
    
    this.logger.log(`Created user: ${user.id} (${user.email})`);
    return user;
  }

  /**
   * Get user by ID with optional profile
   */
  async getUserById(id: string, includeProfile = false): Promise<UserWithProfile | null> {
    const cacheKey = `user:${id}:${includeProfile ? 'with-profile' : 'basic'}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: includeProfile ? { profile: true } : undefined,
      });

      if (!user) {
        return null;
      }

      return user;
    }, { ttl: 3600, tags: [`user:${id}`] });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const cacheKey = `user:email:${email}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.user.findUnique({
        where: { email },
      });
    }, { ttl: 3600, tags: [`user:email:${email}`] });
  }

  /**
   * Update user data
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Invalidate all user-related caches
    await this.cache.invalidateByTag(`user:${id}`);
    await this.cache.invalidateByTag(`user:email:${updatedUser.email}`);
    
    this.logger.log(`Updated user: ${id}`);
    return updatedUser;
  }

  /**
   * Delete user (soft delete by updating moderation status)
   */
  async deleteUser(id: string): Promise<void> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        moderationStatus: 'suspended',
        updatedAt: new Date(),
      },
    });

    // Invalidate all user-related caches
    await this.cache.invalidateByTag(`user:${id}`);
    await this.cache.invalidateByTag(`user:email:${existingUser.email}`);
    
    this.logger.log(`Suspended user: ${id}`);
  }

  /**
   * Get users by role with pagination
   */
  async getUsersByRole(
    role: 'founder' | 'mentor' | 'investor' | 'org',
    page = 1,
    limit = 20,
    includeProfile = false
  ): Promise<{ users: UserWithProfile[]; total: number; page: number; limit: number }> {
    const cacheKey = `users:role:${role}:page:${page}:limit:${limit}:${includeProfile}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const offset = (page - 1) * limit;
      
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: { role, moderationStatus: 'active' },
          include: includeProfile ? { profile: true } : undefined,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({
          where: { role, moderationStatus: 'active' },
        }),
      ]);

      return { users, total, page, limit };
    }, { ttl: 1800, tags: [`users:role:${role}`] });
  }

  /**
   * Search users by display name or email
   */
  async searchUsers(
    query: string,
    page = 1,
    limit = 20,
    role?: 'founder' | 'mentor' | 'investor' | 'org'
  ): Promise<{ users: UserWithProfile[]; total: number; page: number; limit: number }> {
    const cacheKey = `users:search:${query}:page:${page}:limit:${limit}:${role || 'all'}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const offset = (page - 1) * limit;
      const where: any = {
        moderationStatus: 'active',
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { profile: { displayName: { contains: query, mode: 'insensitive' } } },
        ],
      };

      if (role) {
        where.role = role;
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include: { profile: true },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      return { users, total, page, limit };
    }, { ttl: 600, tags: [`users:search:${query}`] });
  }

  /**
   * Update user last seen timestamp
   */
  async updateLastSeen(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });

    // Invalidate user cache
    await this.cache.invalidateByTag(`user:${id}`);
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<{
    total: number;
    byRole: Record<string, number>;
    activeToday: number;
    activeThisWeek: number;
    newThisMonth: number;
  }> {
    const cacheKey = 'users:statistics';
    
    return this.cache.getOrSet(cacheKey, async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        total,
        roleStats,
        activeToday,
        activeThisWeek,
        newThisMonth,
      ] = await Promise.all([
        this.prisma.user.count({ where: { moderationStatus: 'active' } }),
        this.prisma.user.groupBy({
          by: ['role'],
          where: { moderationStatus: 'active' },
          _count: true,
        }),
        this.prisma.user.count({
          where: {
            moderationStatus: 'active',
            lastSeenAt: { gte: today },
          },
        }),
        this.prisma.user.count({
          where: {
            moderationStatus: 'active',
            lastSeenAt: { gte: weekAgo },
          },
        }),
        this.prisma.user.count({
          where: {
            moderationStatus: 'active',
            createdAt: { gte: monthAgo },
          },
        }),
      ]);

      const byRole = roleStats.reduce((acc, stat) => {
        acc[stat.role] = stat._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        byRole,
        activeToday,
        activeThisWeek,
        newThisMonth,
      };
    }, { ttl: 3600, tags: ['users:statistics'] });
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string): Promise<{
    connectionsSent: number;
    connectionsReceived: number;
    messagesSent: number;
    eventsAttended: number;
    groupsJoined: number;
    lastActivity: Date | null;
  }> {
    const cacheKey = `user:${userId}:activity-summary`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const [
        connectionsSent,
        connectionsReceived,
        messagesSent,
        eventsAttended,
        groupsJoined,
      ] = await Promise.all([
        this.prisma.connectionRequest.count({
          where: { requesterId: userId },
        }),
        this.prisma.connectionRequest.count({
          where: { receiverId: userId },
        }),
        this.prisma.message.count({
          where: { senderId: userId },
        }),
        this.prisma.eventRsvp.count({
          where: { userId, status: 'going' },
        }),
        this.prisma.groupMember.count({
          where: { userId },
        }),
      ]);

      // Get last activity from various sources
      const [lastMessage, lastConnection, lastEvent] = await Promise.all([
        this.prisma.message.findFirst({
          where: { senderId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.connectionRequest.findFirst({
          where: { requesterId: userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.eventRsvp.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      const activities = [lastMessage, lastConnection, lastEvent]
        .filter(Boolean)
        .map(a => a!.createdAt);
      
      const lastActivity = activities.length > 0 
        ? new Date(Math.max(...activities.map(d => d.getTime())))
        : null;

      return {
        connectionsSent,
        connectionsReceived,
        messagesSent,
        eventsAttended,
        groupsJoined,
        lastActivity,
      };
    }, { ttl: 1800, tags: [`user:${userId}:activity`] });
  }

  /**
   * Validate user permissions for resource access
   */
  async validateUserAccess(userId: string, resourceType: string, resourceId: string): Promise<boolean> {
    switch (resourceType) {
      case 'profile':
        return this.validateProfileAccess(userId, resourceId);
      case 'message':
        return this.validateMessageAccess(userId, resourceId);
      case 'event':
        return this.validateEventAccess(userId, resourceId);
      case 'group':
        return this.validateGroupAccess(userId, resourceId);
      default:
        return false;
    }
  }

  private async validateProfileAccess(userId: string, profileId: string): Promise<boolean> {
    // User can access their own profile
    if (userId === profileId) return true;

    // Check if users are connected
    const connection = await this.prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: profileId },
          { requesterId: profileId, receiverId: userId },
        ],
        status: 'accepted',
      },
    });

    return !!connection;
  }

  private async validateMessageAccess(userId: string, messageId: string): Promise<boolean> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, conversationId: true },
    });

    if (!message) return false;

    // Sender can access their own messages
    if (message.senderId === userId) return true;

    // Check if user is part of the conversation
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId,
        },
      },
    });

    return !!participant;
  }

  private async validateEventAccess(userId: string, eventId: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { isOnline: true, creatorId: true },
    });

    if (!event) return false;

    // Creator can access their own events
    if (event.creatorId === userId) return true;

    // All events are accessible (no private mode in schema)
    return true;

  }

  private async validateGroupAccess(userId: string, groupId: string): Promise<boolean> {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    return !!member;
  }
}
