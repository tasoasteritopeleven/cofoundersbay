import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

export interface RequestWithPerformance extends Request {
  startTime: number;
}

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);

  use(req: RequestWithPerformance, res: Response, next: NextFunction): void {
    req.startTime = performance.now();

    // Listen for response finish event
    res.on('finish', () => {
      const duration = performance.now() - req.startTime;
      const message = `Performance: ${req.method} ${req.path} - ${res.statusCode} - ${duration.toFixed(2)}ms`;
      
      // Log performance metrics
      this.logger.log(message);

      // Warn on slow requests
      if (duration > 1000) {
        this.logger.warn(`Slow request detected: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
      }
    });

    next();
  }
}
