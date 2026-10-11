import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { StandardSuccessResponse } from '@cofounderbay/shared';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.id || randomUUID();
    const timestamp = new Date().toISOString();
    
    return next.handle().pipe(
      map((data) => {
        // If response is already in standard format, just add metadata
        if (this.isStandardSuccessResponse(data)) {
          const response = data as StandardSuccessResponse<T>;
          response.timestamp = timestamp;
          response.requestId = requestId;
          return response;
        }

        // Wrap non-standard responses
        return {
          success: true,
          data,
          timestamp,
          requestId,
        } as StandardSuccessResponse<T>;
      }),
    );
  }

  private isStandardSuccessResponse(data: unknown): data is StandardSuccessResponse<unknown> {
    return (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      (data as { success: unknown }).success === true &&
      'data' in data
    );
  }
}
