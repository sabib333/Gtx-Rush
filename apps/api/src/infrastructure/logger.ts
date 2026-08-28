/**
 * GTX Rush — Structured Logger v1.0
 *
 * Production-grade structured logging with:
 * - Consistent JSON output
 * - Request ID propagation
 * - User ID context
 * - Severity levels
 * - Never logs secrets, tokens, or passwords
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import { getEnv } from '@gtx-rush/config';

// ============================================================
// Log Levels
// ============================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ============================================================
// Log Entry Interface
// ============================================================

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  requestId?: string;
  userId?: string;
  event?: string;
  errorCode?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  ip?: string;
  error?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Sensitive fields that must never appear in logs
// ============================================================

const SENSITIVE_FIELDS = new Set([
  'password', 'passwordhash', 'token', 'secret', 'bot_token',
  'api_key', 'apikey', 'authorization', 'cookie', 'session',
  'payment_token', 'paymentsecret', 'webhook_secret',
  'jwt_secret', 'admin_jwt_secret', 'session_secret',
]);

function sanitizeMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ============================================================
// Logger Class
// ============================================================

class StructuredLogger {
  private minLevel: number;
  private serviceName: string;

  constructor(serviceName: string, level?: string) {
    this.serviceName = serviceName;
    const envLevel = (level ?? getEnv().LOG_LEVEL ?? 'info') as LogLevel;
    this.minLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const output = JSON.stringify(entry);

    switch (entry.level) {
      case 'fatal':
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: this.serviceName,
      message,
      metadata: meta ? sanitizeMetadata(meta) : undefined,
    });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: this.serviceName,
      message,
      metadata: meta ? sanitizeMetadata(meta) : undefined,
    });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: this.serviceName,
      message,
      metadata: meta ? sanitizeMetadata(meta) : undefined,
    });
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: this.serviceName,
      message,
      metadata: meta ? sanitizeMetadata(meta) : undefined,
    };

    if (error instanceof Error) {
      entry.error = error.message;
      entry.stack = error.stack;
    } else if (error) {
      entry.error = String(error);
    }

    this.write(entry);
  }

  fatal(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: this.serviceName,
      message,
      metadata: meta ? sanitizeMetadata(meta) : undefined,
    };

    if (error instanceof Error) {
      entry.error = error.message;
      entry.stack = error.stack;
    } else if (error) {
      entry.error = String(error);
    }

    this.write(entry);
  }

  /**
   * Create a child logger with a request context.
   */
  child(context: { requestId?: string; userId?: string }): ChildLogger {
    return new ChildLogger(this, context);
  }
}

// ============================================================
// Child Logger (with request context)
// ============================================================

class ChildLogger {
  constructor(
    private parent: StructuredLogger,
    private context: { requestId?: string; userId?: string },
  ) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...meta });
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    this.parent.error(message, error, { ...this.context, ...meta });
  }
}

// ============================================================
// API Request Logger
// ============================================================

export function createRequestLogger(
  requestId: string,
  method: string,
  url: string,
  ip?: string,
): {
  log: ChildLogger;
  end: (statusCode: number, startTime: number) => void;
} {
  const baseLogger = new StructuredLogger('api');
  const log = baseLogger.child({ requestId });

  const startTime = Date.now();

  return {
    log,
    end: (statusCode: number, _startTime: number) => {
      const duration = Date.now() - startTime;
      log.info('request_completed', {
        method,
        path: url,
        statusCode,
        duration,
        ip,
      });
    },
  };
}

// ============================================================
// Exported instances
// ============================================================

export const logger = new StructuredLogger('gtx-rush');

export function createLogger(serviceName: string): StructuredLogger {
  return new StructuredLogger(serviceName);
}
