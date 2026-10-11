import { Injectable, LoggerService } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface LogContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable()
export class AppLogger implements LoggerService {
  private readonly context: string;

  constructor(context?: string) {
    this.context = context || 'App';
  }

  private formatMessage(level: LogEntry['level'], message: string, context: LogContext): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        service: this.context,
      },
    };
  }

  public log(entry: LogEntry): void {
    // In production, this would go to a structured logging service
    // For now, we'll use console with structured format
    const logLine = JSON.stringify(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(logLine);
        break;
      case 'info':
        console.info(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'error':
        console.error(logLine);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(this.formatMessage('debug', message, context || {}));
  }

  info(message: string, context?: LogContext): void {
    this.log(this.formatMessage('info', message, context || {}));
  }

  warn(message: string, context?: LogContext): void {
    this.log(this.formatMessage('warn', message, context || {}));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.formatMessage('error', message, context || {});
    
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    this.log(entry);
  }

  // Convenience methods for common patterns
  logRequest(context: LogContext): void {
    this.info(`${context.method} ${context.path}`, {
      ...context,
      type: 'request',
    });
  }

  logResponse(context: LogContext & { statusCode: number }): void {
    const message = `${context.method} ${context.path} - ${context.statusCode}`;
    const level: LogEntry['level'] = context.statusCode >= 400 ? 'warn' : 'info';
    
    this.log(this.formatMessage(level, message, {
      ...context,
      type: 'response',
    }));
  }

  logError(error: Error, context: LogContext): void {
    this.error(`Error in ${context.method} ${context.path}`, error, {
      ...context,
      type: 'error',
    });
  }

  logPerformance(operation: string, duration: number, context: LogContext): void {
    const level: LogEntry['level'] = duration > 1000 ? 'warn' : 'info';
    this.log(this.formatMessage(level, `${operation} took ${duration}ms`, {
      ...context,
      type: 'performance',
      operation,
      duration,
    }));
  }

  // Static method for creating child loggers
  child(context: string): AppLogger {
    return new AppLogger(`${this.context}:${context}`);
  }
}
