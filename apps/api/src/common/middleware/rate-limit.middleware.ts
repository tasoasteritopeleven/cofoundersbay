import { Injectable, NestMiddleware, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../../security/security.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly securityService: SecurityService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const ip = this.getClientIP(req);
    
    // Check if IP is blocked
    if (this.securityService.isIPBlocked(ip)) {
      throw new ForbiddenException('Access blocked due to suspicious activity');
    }

    // Determine rate limit key based on endpoint
    const rateLimitKey = this.getRateLimitKey(req);
    
    // Check rate limit
    const rateLimitResult = await this.securityService.checkRateLimit(
      rateLimitKey,
      ip,
      (req as any).user?.id,
    );

    // Set rate limit headers
    res.set({
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
    });

    if (!rateLimitResult.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    );
  }

  private getRateLimitKey(req: Request): string {
    const path = req.path;
    
    if (path.startsWith('/auth/login') || path.startsWith('/auth/register')) {
      return 'auth';
    }
    if (path.startsWith('/auth/reset-password')) {
      return 'password_reset';
    }
    if (path.startsWith('/upload')) {
      return 'upload';
    }
    return 'api';
  }
}
