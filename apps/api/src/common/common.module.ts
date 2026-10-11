import { Module } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { ValidationPipe } from './pipes/validation.pipe';
import { PerformanceMiddleware } from './middleware/performance.middleware';
import { requestIdMiddleware } from './filters/http-exception.filter';

@Module({
  providers: [
    HttpExceptionFilter,
    ResponseInterceptor,
    PerformanceMiddleware,
  ],
  exports: [
    HttpExceptionFilter,
    ResponseInterceptor,
    PerformanceMiddleware,
  ],
})
export class CommonModule {}

// Export middleware functions for use in main.ts
export { requestIdMiddleware };
