import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { HttpException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ErrorCode, StandardErrorResponse, StandardSuccessResponse } from '@cofounderbay/shared';

type RequestWithId = Request & { reqId?: string };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithId>();
    
    // Generate unique request ID for tracing
    const requestId = req.reqId || String(req.id ?? '') || randomUUID();
    req.reqId = requestId;

    const timestamp = new Date().toISOString();
    const path = req.url;
    const method = req.method;
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, res, {
        requestId,
        timestamp,
        path,
        method,
        userAgent,
        ip,
      });
    }

    // Handle non-HTTP exceptions (unexpected errors)
    return this.handleUnexpectedError(exception, res, {
      requestId,
      timestamp,
      path,
      method,
      userAgent,
      ip,
    });
  }

  private handleHttpException(
    exception: HttpException,
    res: Response,
    metadata: {
      requestId: string;
      timestamp: string;
      path: string;
      method: string;
      userAgent?: string;
      ip?: string;
    },
  ) {
    const status = exception.getStatus();
    const body = exception.getResponse();

    // Check if it's already a standardized error response
    if (this.isStandardErrorResponse(body)) {
      const errorResponse = body as StandardErrorResponse;
      
      // Add request metadata
      errorResponse.error.timestamp = metadata.timestamp;
      errorResponse.error.requestId = metadata.requestId;

      // Log appropriate level
      if (status >= 500) {
        this.logger.error(
          `[${metadata.requestId}] ${status} ${metadata.method} ${metadata.path}`,
          {
            error: errorResponse.error,
            userAgent: metadata.userAgent,
            ip: metadata.ip,
          },
        );
      } else if (status >= 400) {
        this.logger.warn(
          `[${metadata.requestId}] ${status} ${metadata.method} ${metadata.path}`,
          {
            error: errorResponse.error,
            userAgent: metadata.userAgent,
            ip: metadata.ip,
          },
        );
      }

      return res.status(status).json(errorResponse);
    }

    // Handle legacy HTTP exceptions
    const message = typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: string | string[] }).message
      : exception.message;
    const msg = Array.isArray(message) ? message[0] : message;

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: {
        code: this.mapHttpStatusToErrorCode(status),
        message: msg,
        timestamp: metadata.timestamp,
        requestId: metadata.requestId,
      },
    };

    // Log appropriate level
    if (status >= 500) {
      this.logger.error(
        `[${metadata.requestId}] ${status} ${metadata.method} ${metadata.path}`,
        {
          error: errorResponse.error,
          exception,
          userAgent: metadata.userAgent,
          ip: metadata.ip,
        },
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${metadata.requestId}] ${status} ${metadata.method} ${metadata.path}`,
        {
          error: errorResponse.error,
          userAgent: metadata.userAgent,
          ip: metadata.ip,
        },
      );
    }

    return res.status(status).json(errorResponse);
  }

  private handleUnexpectedError(
    exception: unknown,
    res: Response,
    metadata: {
      requestId: string;
      timestamp: string;
      path: string;
      method: string;
      userAgent?: string;
      ip?: string;
    },
  ) {
    const errorResponse: StandardErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        timestamp: metadata.timestamp,
        requestId: metadata.requestId,
      },
    };

    // Log full error details for debugging
    this.logger.error(
      `[${metadata.requestId}] Unexpected error in ${metadata.method} ${metadata.path}`,
      {
        error: errorResponse.error,
        exception: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        userAgent: metadata.userAgent,
        ip: metadata.ip,
      },
    );

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }

  private isStandardErrorResponse(body: unknown): body is StandardErrorResponse {
    return (
      typeof body === 'object' &&
      body !== null &&
      'success' in body &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'object' &&
      (body as { error: { code?: unknown } }).error !== null &&
      'code' in (body as { error: { code?: unknown } }).error
    );
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      // 423 Locked — no NestJS HttpStatus enum member, so match the numeric status
      case 423:
        return ErrorCode.RESOURCE_LOCKED;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ErrorCode.INTERNAL_ERROR;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCode.SERVICE_UNAVAILABLE;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}

// Middleware to add request ID to all requests
export function requestIdMiddleware(req: RequestWithId, res: Response, next: () => void) {
  req.reqId = randomUUID();
  next();
}
