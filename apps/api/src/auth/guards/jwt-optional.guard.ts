import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/** Use on routes that work for both authenticated and anonymous; sets req.user when token is valid. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return true;

    try {
      const payload = this.jwt.verify<{ sub: string; type: string }>(token);
      if (payload?.type !== 'access') return true;
      const user = await this.authService.validateUser(payload.sub);
      if (user) request.user = user;
    } catch {
      // invalid or expired token — proceed without user
    }
    return true;
  }
}
