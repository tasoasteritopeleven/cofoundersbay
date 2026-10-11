import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';

export interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'password_reset' | 'suspicious_activity' | 'rate_limit_exceeded';
  userId?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  metadata: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  suspiciousIPs: string[];
  blockedIPs: string[];
  rateLimitHits: number;
  activeSessions: number;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly rateLimits = new Map<string, RateLimitConfig>();
  private readonly blockedIPs = new Set<string>();
  private readonly suspiciousIPs = new Map<string, { count: number; lastSeen: Date }>();

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {
    this.initializeRateLimits();
    this.loadSecurityConfig();
  }

  /**
   * Initialize default rate limits
   */
  private initializeRateLimits(): void {
    this.rateLimits.set('auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      skipSuccessfulRequests: false,
    });

    this.rateLimits.set('api', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      skipSuccessfulRequests: false,
    });

    this.rateLimits.set('upload', {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 uploads per hour
      skipSuccessfulRequests: false,
    });

    this.rateLimits.set('password_reset', {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 password resets per hour
      skipSuccessfulRequests: true,
    });
  }

  /**
   * Load security configuration from cache/database
   */
  private async loadSecurityConfig(): Promise<void> {
    try {
      const [blockedIPs, suspiciousIPs] = await Promise.all([
        this.cache.get<string[]>('security:blocked_ips'),
        this.cache.get<Record<string, { count: number; lastSeen: Date }>>('security:suspicious_ips'),
      ]);

      if (blockedIPs) {
        blockedIPs.forEach(ip => this.blockedIPs.add(ip));
      }

      if (suspiciousIPs) {
        Object.entries(suspiciousIPs).forEach(([ip, data]) => {
          this.suspiciousIPs.set(ip, data);
        });
      }
    } catch (error) {
      this.logger.error('Failed to load security configuration', error);
    }
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * Check rate limit for a given key and IP
   */
  async checkRateLimit(
    key: string,
    ip: string,
    identifier?: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const config = this.rateLimits.get(key);
    if (!config) {
      return { allowed: true, remaining: Infinity, resetTime: new Date() };
    }

    // Check if IP is blocked
    if (this.isIPBlocked(ip)) {
      return { allowed: false, remaining: 0, resetTime: new Date(Date.now() + config.windowMs) };
    }

    const rateLimitKey = `rate_limit:${key}:${ip}:${identifier || 'global'}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get current requests in window
    const requests = await this.cache.get<number[]>(rateLimitKey) || [];
    const validRequests = requests.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    const allowed = validRequests.length < config.max;
    const remaining = Math.max(0, config.max - validRequests.length - 1);

    if (allowed) {
      // Add current request
      validRequests.push(now);
      await this.cache.set(rateLimitKey, validRequests, Math.ceil(config.windowMs / 1000));
    } else {
      // Log rate limit exceeded
      await this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        ip,
        timestamp: new Date(),
        metadata: {
          key,
          limit: config.max,
          windowMs: config.windowMs,
          requestsInWindow: validRequests.length,
        },
        severity: 'medium',
      });
    }

    return {
      allowed,
      remaining,
      resetTime: new Date(windowStart + config.windowMs),
    };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: Partial<SecurityEvent> & Pick<SecurityEvent, 'type' | 'ip' | 'severity'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: randomBytes(16).toString('hex'),
      userId: undefined,
      userAgent: 'unknown',
      timestamp: new Date(),
      metadata: {},
      ...event,
    };

    // Store event in cache for recent events
    const recentEventsKey = 'security:recent_events';
    const recentEvents = await this.cache.get<SecurityEvent[]>(recentEventsKey) || [];
    recentEvents.push(securityEvent);

    // Keep only last 1000 events
    if (recentEvents.length > 1000) {
      recentEvents.splice(0, recentEvents.length - 1000);
    }

    await this.cache.set(recentEventsKey, recentEvents, 3600);

    // Store in database for long-term storage
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "SecurityEvent" (id, type, "userId", ip, "userAgent", timestamp, metadata, severity)
        VALUES (${securityEvent.id}, ${securityEvent.type}, ${securityEvent.userId}, 
                ${securityEvent.ip}, ${securityEvent.userAgent}, ${securityEvent.timestamp}, 
                ${JSON.stringify(securityEvent.metadata)}, ${securityEvent.severity})
      `;
    } catch (error) {
      this.logger.error('Failed to store security event in database', error);
    }

    // Check for suspicious patterns
    await this.analyzeSecurityEvent(securityEvent);

    this.logger.log(`Security event: ${securityEvent.type} from ${securityEvent.ip}`);
  }

  /**
   * Analyze security event for suspicious patterns
   */
  private async analyzeSecurityEvent(event: SecurityEvent): Promise<void> {
    const recentEventsKey = 'security:recent_events';
    const recentEvents = await this.cache.get<SecurityEvent[]>(recentEventsKey) || [];

    // Check for multiple failed login attempts from same IP
    const failedLogins = recentEvents.filter((e) =>
      e.type === 'login_failure' &&
      e.ip === event.ip &&
      new Date(event.timestamp).getTime() - new Date(e.timestamp).getTime() < 15 * 60 * 1000
    );

    if (failedLogins.length >= 5) {
      await this.handleSuspiciousActivity(event.ip, 'multiple_failed_logins', {
        count: failedLogins.length,
        timeWindow: '15 minutes',
      });
    }

    // Check for rapid password reset requests
    const passwordResets = recentEvents.filter((e) =>
      e.type === 'password_reset' &&
      e.ip === event.ip &&
      new Date(event.timestamp).getTime() - new Date(e.timestamp).getTime() < 60 * 60 * 1000
    );

    if (passwordResets.length >= 3) {
      await this.handleSuspiciousActivity(event.ip, 'rapid_password_resets', {
        count: passwordResets.length,
        timeWindow: '1 hour',
      });
    }

    // Check for unusual user agent patterns
    const userAgentEvents = recentEvents.filter((e) =>
      e.userAgent === event.userAgent &&
      e.ip !== event.ip &&
      new Date(event.timestamp).getTime() - new Date(e.timestamp).getTime() < 60 * 60 * 1000
    );

    if (userAgentEvents.length >= 10) {
      await this.handleSuspiciousActivity(event.ip, 'suspicious_user_agent', {
        userAgent: event.userAgent,
        uniqueIPs: userAgentEvents.length,
      });
    }
  }

  /**
   * Handle suspicious activity
   */
  private async handleSuspiciousActivity(
    ip: string,
    reason: string,
    metadata: Record<string, any>
  ): Promise<void> {
    // Update suspicious IP tracking
    const current = this.suspiciousIPs.get(ip) || { count: 0, lastSeen: new Date() };
    current.count++;
    current.lastSeen = new Date();
    this.suspiciousIPs.set(ip, current);

    // Log suspicious activity event
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      ip,
      timestamp: new Date(),
      metadata: { reason, ...metadata },
      severity: current.count >= 3 ? 'high' : 'medium',
    });

    // Block IP if too many incidents
    if (current.count >= 5) {
      await this.blockIP(ip, 'excessive_suspicious_activity');
    }

    // Update cache
    await this.cache.set('security:suspicious_ips', Object.fromEntries(this.suspiciousIPs), 86400);
  }

  /**
   * Block IP address
   */
  async blockIP(ip: string, reason: string, duration = 24 * 60 * 60 * 1000): Promise<void> {
    this.blockedIPs.add(ip);
    
    // Store in cache with expiration
    await this.cache.set(`security:blocked_ip:${ip}`, { reason, blockedAt: new Date() }, Math.ceil(duration / 1000));
    await this.cache.set('security:blocked_ips', Array.from(this.blockedIPs), 86400);

    // Log blocking event
    await this.logSecurityEvent({
      type: 'suspicious_activity',
      ip,
      timestamp: new Date(),
      metadata: { action: 'ip_blocked', reason, duration },
      severity: 'high',
    });

    this.logger.warn(`IP blocked: ${ip} - Reason: ${reason}`);
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ip: string): Promise<void> {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);

    // Remove from cache
    await this.cache.del(`security:blocked_ip:${ip}`);
    await this.cache.set('security:blocked_ips', Array.from(this.blockedIPs), 86400);
    await this.cache.set('security:suspicious_ips', Object.fromEntries(this.suspiciousIPs), 86400);

    this.logger.log(`IP unblocked: ${ip}`);
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Hash password securely
   */
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(password + salt + this.config.get('app.jwt.accessSecret'))
      .digest('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const computedHash = createHash('sha256')
        .update(password + salt + this.config.get('app.jwt.accessSecret'))
        .digest('hex');
      
      return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
    } catch (error) {
      return false;
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const recentEventsKey = 'security:recent_events';
    const recentEvents = await this.cache.get<SecurityEvent[]>(recentEventsKey) || [];

    const eventsByType = recentEvents.reduce((acc: Record<string, number>, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = recentEvents.reduce((acc: Record<string, number>, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      suspiciousIPs: Array.from(this.suspiciousIPs.keys()),
      blockedIPs: Array.from(this.blockedIPs),
      rateLimitHits: eventsByType['rate_limit_exceeded'] || 0,
      activeSessions: await this.getActiveSessionsCount(),
    };
  }

  /**
   * Get active sessions count
   */
  private async getActiveSessionsCount(): Promise<number> {
    try {
      // This would query your refresh tokens table for active sessions
      return await this.prisma.refreshToken.count({
        where: {
          expiresAt: { gt: new Date() },
        },
      });
    } catch (error) {
      this.logger.error('Failed to get active sessions count', error);
      return 0;
    }
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(limit = 50, type?: string, severity?: string): Promise<SecurityEvent[]> {
    const recentEventsKey = 'security:recent_events';
    const recentEvents = await this.cache.get<SecurityEvent[]>(recentEventsKey) || [];

    let filteredEvents = recentEvents;

    if (type) {
      filteredEvents = filteredEvents.filter((event) => event.type === type);
    }

    if (severity) {
      filteredEvents = filteredEvents.filter((event) => event.severity === severity);
    }

    return filteredEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<boolean> {
    try {
      const hashedToken = createHash('sha256').update(token).digest('hex');
      const refreshToken = await this.prisma.refreshToken.findFirst({
        where: {
          tokenHash: hashedToken,
          expiresAt: { gt: new Date() },
        },
      });

      return !!refreshToken;
    } catch (error) {
      this.logger.error('Failed to validate session', error);
      return false;
    }
  }

  /**
   * Invalidate user sessions
   */
  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      // Log security event
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        userId,
        ip: 'system',
        userAgent: 'system',
        timestamp: new Date(),
        metadata: { action: 'sessions_invalidated' },
        severity: 'medium',
      });

      this.logger.log(`Invalidated all sessions for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to invalidate user sessions', error);
    }
  }

  /**
   * Check for brute force patterns
   */
  async checkBruteForcePattern(ip: string, userId?: string): Promise<boolean> {
    const recentEventsKey = 'security:recent_events';
    const recentEvents = await this.cache.get<SecurityEvent[]>(recentEventsKey) || [];

    const failedLogins = recentEvents.filter((event) =>
      event.type === 'login_failure' &&
      event.ip === ip &&
      (!userId || event.userId === userId) &&
      new Date(event.timestamp).getTime() > Date.now() - 60 * 60 * 1000
    );

    // Block if more than 10 failed attempts in last hour
    if (failedLogins.length >= 10) {
      await this.blockIP(ip, 'brute_force_attack');
      return true;
    }

    return false;
  }

  /**
   * Get IP reputation score
   */
  async getIPReputationScore(ip: string): Promise<number> {
    let score = 100; // Start with perfect score

    // Deduct points for blocked status
    if (this.isIPBlocked(ip)) {
      score -= 50;
    }

    // Deduct points for suspicious activity
    const suspicious = this.suspiciousIPs.get(ip);
    if (suspicious) {
      score -= suspicious.count * 5;
    }

    // Check recent events
    const recentEventsKey = 'security:recent_events';
    const recentEvents = await this.cache.get<SecurityEvent[]>(recentEventsKey) || [];

    const ipEvents = recentEvents.filter((event) =>
      event.ip === ip &&
      new Date(event.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    // Deduct points for failed logins
    const failedLogins = ipEvents.filter((e) => e.type === 'login_failure').length;
    score -= failedLogins * 2;

    // Deduct points for rate limit hits
    const rateLimitHits = ipEvents.filter((e) => e.type === 'rate_limit_exceeded').length;
    score -= rateLimitHits * 3;

    return Math.max(0, score);
  }
}
