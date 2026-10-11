import { Injectable, UnauthorizedException, ConflictException, ForbiddenException, BadRequestException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterInput, LoginInput } from '@cofounderbay/shared';
import { AutomationService } from '../automation/automation.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access';
}

@Injectable()
export class AuthService {
  private readonly emailVerificationRequired: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Optional() private readonly automation?: AutomationService,
  ) {
    this.emailVerificationRequired =
      this.config.get<string>('EMAIL_VERIFICATION_REQUIRED') === 'true';
  }

  async register(input: RegisterInput): Promise<{ user: { id: string; email: string; role: string; emailVerified: boolean }; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const baseSlug = input.email.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '-');
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const user = await this.prisma.user.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        email: input.email.toLowerCase(),
        slug,
        passwordHash,
        role: input.role as 'founder' | 'mentor' | 'investor' | 'org',
      } as any,
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);

    this.automation?.fire({
      triggerType: 'user_signup',
      targetUserId: user.id,
      payload: { role: user.role, email: user.email },
    }).catch(() => {});

    return {
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
      tokens,
    };
  }

  async login(input: LoginInput): Promise<{ user: { id: string; email: string; role: string; emailVerified: boolean }; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true, email: true, role: true, passwordHash: true, moderationStatus: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (user.moderationStatus === 'suspended') {
      throw new UnauthorizedException('Your account is temporarily suspended');
    }
    if (user.moderationStatus === 'banned') {
      throw new UnauthorizedException('Your account has been banned');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Please use OAuth to sign in (Google/LinkedIn)');
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (this.emailVerificationRequired && !user.emailVerified) {
      throw new ForbiddenException('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return {
      user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const hash = this.hashRefreshToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date()) {
      if (record) await this.prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Handle orphaned refresh token (user deleted)
    if (!record.user) {
      await this.prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
      throw new UnauthorizedException('User no longer exists');
    }

    await this.prisma.refreshToken.delete({ where: { id: record.id } });
    return this.issueTokenPair(record.user.id, record.user.email, record.user.role);
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    const hash = this.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash: hash } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.passwordHash) {
      throw new UnauthorizedException('No password set. Please set a password first.');
    }
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, passwordHash: true },
    });
    // Always succeed (prevent email enumeration)
    if (!user || !user.passwordHash) return;

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { passwordResetToken: token, passwordResetExpires: expires } as any,
    });

    // Trigger automation if configured (sends reset email)
    this.automation?.fire({
      triggerType: 'password_reset_requested',
      targetUserId: user.id,
      payload: { token, expires: expires.toISOString() },
    }).catch(() => {});
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (this.prisma.user as any).findFirst({
      where: { passwordResetToken: token },
      select: { id: true, passwordResetExpires: true },
    }) as { id: string; passwordResetExpires: Date | null } | null;

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.prisma.user as any).update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  }

  async createSessionForUser(userId: string): Promise<{ user: { id: string; email: string; role: string }; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, moderationStatus: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.moderationStatus !== 'active') throw new UnauthorizedException('Account is not active');
    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: { id: user.id, email: user.email, role: user.role }, tokens };
  }

  async demoLogin(): Promise<{ user: { id: string; email: string; role: string; emailVerified: boolean }; tokens: TokenPair }> {
    const DEMO_EMAIL = 'demo@cofounderbay.com';
    let user = await this.prisma.user.findUnique({
      where: { email: DEMO_EMAIL },
      select: { id: true, email: true, role: true, emailVerified: true, moderationStatus: true },
    });

    if (!user) {
      const slug = `demo-user-${Date.now().toString(36)}`;
      user = await this.prisma.user.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          email: DEMO_EMAIL,
          slug,
          passwordHash: await argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id }),
          role: 'founder',
          emailVerified: true,
          moderationStatus: 'active',
          firstName: 'Demo',
          lastName: 'User',
        } as any,
        select: { id: true, email: true, role: true, emailVerified: true, moderationStatus: true },
      });
    }

    if (user.moderationStatus === 'suspended' || user.moderationStatus === 'banned') {
      throw new UnauthorizedException('Demo account is unavailable');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return { user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified }, tokens };
  }

  async validateUser(userId: string): Promise<{ id: string; email: string; role: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, moderationStatus: true },
    });
    if (!user || user.moderationStatus !== 'active') return null;
    return { id: user.id, email: user.email, role: user.role };
  }

  private async issueTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');

    const accessToken = this.jwt.sign(
      { sub: userId, email, role, type: 'access' } as JwtPayload,
      { secret: accessSecret, expiresIn: accessTtl },
    );
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const expiresInSec = this.parseTtlToSeconds(refreshTtl);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + expiresInSec * 1000),
      },
    });

    const accessExpiresIn = this.parseTtlToSeconds(accessTtl);
    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900;
    const [, num, unit] = match;
    const n = parseInt(num!, 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit!] ?? 60);
  }
}
