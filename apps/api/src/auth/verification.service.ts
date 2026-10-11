import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { randomBytes } from 'crypto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly frontendUrl: string;
  private readonly verificationRequired: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.verificationRequired =
      this.config.get<string>('EMAIL_VERIFICATION_REQUIRED') === 'true';
  }

  /** Whether email verification is enforced before login */
  isVerificationRequired(): boolean {
    return this.verificationRequired;
  }

  /** Generate token, persist it, and send the verification email */
  async sendEmailVerification(userId: string): Promise<void> {
    const token = this.generateSecureToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
    });

    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    if (this.mailer.isEnabled()) {
      await this.mailer.sendEmail({
        to: user.email,
        subject: 'Verify your CoFounderBay email',
        html: `
          <h2>Welcome to CoFounderBay!</h2>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${verifyUrl}" style="padding:12px 24px;background:#6756dc;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
          <p>Or copy this URL: ${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
        `,
        text: `Verify your email: ${verifyUrl}`,
      });
      this.logger.log(`Verification email sent to ${user.email}`);
    } else {
      this.logger.warn(
        `Mail not configured. Verification token for ${user.email}: ${token}`,
      );
    }
  }

  /** Verify a token from GET /auth/verify-email?token=... */
  async verifyEmail(token: string): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification token has expired. Please request a new one.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    this.logger.log(`Email verified for ${user.email}`);
    return { email: user.email };
  }

  /** Resend verification email for a user who hasn't verified yet */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether the email exists
      return;
    }
    if (user.emailVerified) {
      return;
    }
    await this.sendEmailVerification(user.id);
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }
}
