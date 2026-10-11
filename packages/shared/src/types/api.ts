// Standard API response types for type safety across frontend and backend

export interface ApiResponse<T = unknown> {
  data?: T;
  success: boolean;
  message?: string;
  error?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Standard error codes for consistent error handling
export enum ErrorCode {
  // Auth errors (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Validation errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Resource errors (4xx)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Rate limiting (4xx)
  RATE_LIMITED = 'RATE_LIMITED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Business logic errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
}

// Standard API error response format
export interface StandardErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId?: string;
  };
}

// Success response wrapper
export interface StandardSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
}

// Request metadata for debugging and monitoring
export interface RequestMetadata {
  requestId: string;
  timestamp: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  path: string;
  method: string;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    search: 'healthy' | 'unhealthy';
    storage: 'healthy' | 'unhealthy';
  };
  metrics?: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
  responseTime?: number;
}

/**
 * The counts shown on the public landing page, measured from the database at
 * `measuredAt` and cached for ten minutes by the API. Every count is a
 * non-negative integer; the landing page renders nothing numeric until they
 * arrive.
 */
export interface PublicStats {
  /** Users whose moderation status is active. */
  members: number;
  /** Active users in a mentor-kind role (mentor, advisor, coach, course creator). */
  mentors: number;
  /** Accepted connection requests. */
  connections: number;
  /** Events on the platform. */
  events: number;
  /** Active organizations. */
  organizations: number;
  /** ISO timestamp of the moment the counts were measured. */
  measuredAt: string;
}
