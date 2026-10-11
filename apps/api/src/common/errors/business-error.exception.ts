import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@cofounderbay/shared';

export class BusinessErrorException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    status?: HttpStatus,
  ) {
    // Map error codes to HTTP status codes
    const httpStatus = status || BusinessErrorException.mapErrorCodeToHttpStatus(code);
    
    super(
      {
        success: false,
        error: {
          code,
          message,
          details,
          timestamp: new Date().toISOString(),
        },
      },
      httpStatus,
    );
  }

  private static mapErrorCodeToHttpStatus(code: ErrorCode): HttpStatus {
    switch (code) {
      // 400 Bad Request
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.MISSING_REQUIRED_FIELD:
      case ErrorCode.INVALID_FORMAT:
        return HttpStatus.BAD_REQUEST;

      // 401 Unauthorized
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.INVALID_CREDENTIALS:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.INVALID_TOKEN:
      case ErrorCode.SESSION_EXPIRED:
        return HttpStatus.UNAUTHORIZED;

      // 403 Forbidden
      case ErrorCode.FORBIDDEN:
      case ErrorCode.INSUFFICIENT_PERMISSIONS:
      case ErrorCode.ACCOUNT_SUSPENDED:
        return HttpStatus.FORBIDDEN;

      // 404 Not Found
      case ErrorCode.NOT_FOUND:
        return HttpStatus.NOT_FOUND;

      // 409 Conflict
      case ErrorCode.ALREADY_EXISTS:
      case ErrorCode.CONFLICT:
        return HttpStatus.CONFLICT;

      // 423 Locked (not available in NestJS, use CONFLICT)
      case ErrorCode.RESOURCE_LOCKED:
        return HttpStatus.CONFLICT;

      // 429 Too Many Requests
      case ErrorCode.RATE_LIMITED:
      case ErrorCode.TOO_MANY_REQUESTS:
        return HttpStatus.TOO_MANY_REQUESTS;

      // 500 Internal Server Error
      case ErrorCode.INTERNAL_ERROR:
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;

      // 503 Service Unavailable
      case ErrorCode.SERVICE_UNAVAILABLE:
        return HttpStatus.SERVICE_UNAVAILABLE;

      // 400 for business logic errors
      case ErrorCode.QUOTA_EXCEEDED:
      case ErrorCode.FEATURE_DISABLED:
        return HttpStatus.BAD_REQUEST;
    }
  }
}

// Convenience factory methods for common errors
export class BusinessError {
  static notFound(message: string, details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.NOT_FOUND, message, details);
  }

  static alreadyExists(message: string, details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.ALREADY_EXISTS, message, details);
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new BusinessErrorException(ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message: string = 'Forbidden') {
    return new BusinessErrorException(ErrorCode.FORBIDDEN, message);
  }

  static conflict(message: string, details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.CONFLICT, message, details);
  }

  static quotaExceeded(message: string, details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.QUOTA_EXCEEDED, message, details);
  }

  static featureDisabled(message: string = 'This feature is currently disabled') {
    return new BusinessErrorException(ErrorCode.FEATURE_DISABLED, message);
  }

  static accountSuspended(message: string = 'Account has been suspended') {
    return new BusinessErrorException(ErrorCode.ACCOUNT_SUSPENDED, message);
  }

  static rateLimited(message: string = 'Too many requests') {
    return new BusinessErrorException(ErrorCode.RATE_LIMITED, message);
  }

  static internal(message: string = 'Internal server error', details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.INTERNAL_ERROR, message, details);
  }

  static database(message: string = 'Database error', details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.DATABASE_ERROR, message, details);
  }

  static externalService(message: string = 'External service error', details?: Record<string, unknown>) {
    return new BusinessErrorException(ErrorCode.EXTERNAL_SERVICE_ERROR, message, details);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable') {
    return new BusinessErrorException(ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}
