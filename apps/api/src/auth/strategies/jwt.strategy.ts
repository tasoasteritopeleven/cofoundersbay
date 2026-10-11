import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService, JwtPayload } from '../auth.service';
import { COOKIE_NAMES } from '../cookie.utils';

function extractJwtFromCookieOrHeader(req: Request): string | null {
  // 1. Try HttpOnly cookie first
  const cookieToken = (req.cookies as Record<string, string>)?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (cookieToken) return cookieToken;

  // 2. Fall back to Authorization header (backwards compat / mobile clients)
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret =
      config.get<string>('JWT_ACCESS_SECRET') ||
      (process.env.NODE_ENV !== 'production'
        ? 'dev-only-secret-min-32-characters-long'
        : undefined);
    if (!secret || secret.length < 16) {
      throw new Error(
        'JWT_ACCESS_SECRET is required in production (min 16 chars). Copy .env.example to .env and set JWT_ACCESS_SECRET.',
      );
    }
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') throw new UnauthorizedException();
    const user = await this.authService.validateUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
