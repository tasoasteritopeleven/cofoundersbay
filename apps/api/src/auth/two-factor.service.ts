import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

@Injectable()
export class TwoFactorService {
  private readonly APP_NAME = 'CoFounderBay';

  constructor(private readonly prisma: PrismaService) {}

  async generateSetup(userId: string): Promise<TwoFactorSetupResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    // Generate secret
    const secretObj = speakeasy.generateSecret({
      name: `${this.APP_NAME}:${user.email}`,
      issuer: this.APP_NAME,
    });
    const secret = secretObj.base32;

    // Generate QR code
    const otpAuthUrl = secretObj.otpauth_url || `otpauth://totp/${this.APP_NAME}:${user.email}?secret=${secret}&issuer=${this.APP_NAME}`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store secret temporarily (not enabled yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorBackupCodes: backupCodes,
      },
    });

    return {
      secret,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  async verifyAndEnable(userId: string, code: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('Please generate a 2FA setup first');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true };
  }

  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true, twoFactorBackupCodes: true },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // Check TOTP code
    const isValidTotp = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (isValidTotp) {
      return true;
    }

    // Check backup codes
    if (user.twoFactorBackupCodes.includes(code)) {
      // Remove used backup code
      const updatedCodes = user.twoFactorBackupCodes.filter((c) => c !== code);
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: updatedCodes },
      });
      return true;
    }

    return false;
  }

  async disable(userId: string, code: string): Promise<{ success: boolean }> {
    const isValid = await this.verify(userId, code);

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    return { success: true };
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const isValid = await this.verify(userId, code);

    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: backupCodes },
    });

    return { backupCodes };
  }

  async getStatus(userId: string): Promise<{ enabled: boolean; backupCodesRemaining: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      enabled: user.twoFactorEnabled,
      backupCodesRemaining: user.twoFactorBackupCodes.length,
    };
  }

  private generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
