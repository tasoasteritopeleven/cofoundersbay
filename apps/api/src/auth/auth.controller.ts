import { Body, Controller, Get, Post, Query, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ZodError } from 'zod';
import { AuthService, TokenPair } from './auth.service';
import { VerificationService } from './verification.service';
import { registerSchema, loginSchema, refreshSchema } from '@cofounderbay/shared';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { setAuthCookies, clearAuthCookies, COOKIE_NAMES } from './cookie.utils';

function parseWithZod<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new BadRequestException(messages || 'Validation failed');
    }
    throw error;
  }
}

interface RegisterDto {
  email: string;
  password: string;
  role?: 'founder' | 'mentor' | 'investor' | 'org';
}

interface LoginDto {
  email: string;
  password: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationService: VerificationService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parseWithZod(registerSchema, body);
    const result = await this.authService.register(input);

    // Send verification email (non-blocking — don't fail registration if mail fails)
    this.verificationService.sendEmailVerification(result.user.id).catch(() => {});

    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  // @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const input = parseWithZod(loginSchema, body);
      const result = await this.authService.login(input);

      setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

      return {
        user: result.user,
        tokens: result.tokens,
      };
    } catch (error) {
      console.error('[LOGIN ERROR]', error);
      throw error;
    }
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ) {
    // Accept refresh token from cookie OR body (backwards compat)
    const refreshToken =
      (req.cookies as Record<string, string>)?.[COOKIE_NAMES.REFRESH_TOKEN] ||
      body.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException('No refresh token provided');
    }

    const tokens: TokenPair = await this.authService.refresh(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string | null },
  ) {
    const refreshToken =
      body.refreshToken ||
      (req.cookies as Record<string, string>)?.[COOKIE_NAMES.REFRESH_TOKEN] ||
      null;

    await this.authService.logout(refreshToken);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string; email: string; role: string }) {
    return { user };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() body: ChangePasswordDto,
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('currentPassword and newPassword are required');
    }
    if (body.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
    return { ok: true };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Verification token is required');
    const result = await this.verificationService.verifyEmail(token);
    return { ok: true, email: result.email };
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('Email is required');
    await this.authService.requestPasswordReset(body.email);
    return { ok: true, message: 'If that email exists, a password reset link has been sent.' };
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token) throw new BadRequestException('Reset token is required');
    if (!body.password || body.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    await this.authService.resetPassword(body.token, body.password);
    return { ok: true, message: 'Password has been reset successfully. You can now log in.' };
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('demo')
  async demoLogin(@Res({ passthrough: true }) res: Response) {
    const result = await this.authService.demoLogin();
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    return { user: result.user, tokens: result.tokens };
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('resend-verification')
  async resendVerification(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('Email is required');
    await this.verificationService.resendVerification(body.email);
    // Always return success to prevent email enumeration
    return { ok: true, message: 'If the email exists and is unverified, a new verification link has been sent.' };
  }
}
