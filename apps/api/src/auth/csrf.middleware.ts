import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const CSRF_COOKIE = 'cfb_csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie CSRF protection.
 *
 * For every response, we set a non-HttpOnly cookie with a random token.
 * The frontend reads this cookie and sends it back as a header on
 * state-changing requests (POST/PUT/PATCH/DELETE).
 * We compare the cookie value to the header value — they must match.
 *
 * Safe methods (GET/HEAD/OPTIONS) are exempt.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Ensure a CSRF token cookie exists
    const existingToken = (req.cookies as Record<string, string>)?.[CSRF_COOKIE];
    if (!existingToken) {
      const token = randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // Must be readable by JS
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24h
      });
    }

    // Safe methods are exempt
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    // Auth endpoints that don't require CSRF (no cookie auth yet at login/register time)
    const exemptPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/verify-email', '/api/auth/resend-verification'];
    if (exemptPaths.some((p) => req.path.endsWith(p) || req.originalUrl.includes(p))) {
      return next();
    }

    // Validate: cookie token must match header token
    const cookieToken = (req.cookies as Record<string, string>)?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    next();
  }
}

export { CSRF_COOKIE, CSRF_HEADER };
