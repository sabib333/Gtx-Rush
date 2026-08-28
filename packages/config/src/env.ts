/**
 * Environment configuration with validation.
 * This module validates that all required env vars are present.
 * Server-only — never imported by client code.
 *
 * Supports: development, staging, production environments.
 * Mock auth is ONLY allowed in development.
 */

import dotenv from 'dotenv';
import { resolve } from 'node:path';

// Load .env from project root
const rootDir = resolve(process.cwd(), '../..');
dotenv.config({ path: resolve(rootDir, '.env') });

// ============================================================
// Required environment variables (all environments)
// ============================================================

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'TELEGRAM_BOT_TOKEN',
  'JWT_SECRET',
] as const;

// ============================================================
// Optional environment variables
// ============================================================

const optionalEnvVars = [
  'ADMIN_JWT_SECRET',
  'STARS_PAYMENT_TOKEN',
  'WEBHOOK_SECRET',
  'API_PORT',
  'CORS_ORIGIN',
  'TELEGRAM_BOT_USERNAME',
  'TELEGRAM_WEBHOOK_SECRET',
  'MINI_APP_URL',
  'SESSION_SECRET',
  'DEV_TELEGRAM_MOCK',
  'NODE_ENV',
  'LOG_LEVEL',
  'REDIS_HOST',
  'REDIS_PORT',
  'DB_POOL_MIN',
  'DB_POOL_MAX',
  'DB_STATEMENT_TIMEOUT_MS',
  'RATE_LIMIT_GENERAL',
  'RATE_LIMIT_AUTH',
  'RATE_LIMIT_GAME',
  'RATE_LIMIT_ADMIN',
  'ENABLE_METRICS',
  'ENABLE_TRACING',
  'BACKUP_RETENTION_DAYS',
  'BACKUP_SCHEDULE',
  'NODE_OPTIONS',
] as const;

type RequiredEnv = Record<(typeof requiredEnvVars)[number], string>;
type OptionalEnv = Partial<Record<(typeof optionalEnvVars)[number], string>>;

export type EnvConfig = RequiredEnv & OptionalEnv & {
  LOG_LEVEL: string;
  REDIS_HOST: string | undefined;
  REDIS_PORT: string | undefined;
  DB_POOL_MIN: string | undefined;
  DB_POOL_MAX: string | undefined;
  DB_STATEMENT_TIMEOUT_MS: string | undefined;
  RATE_LIMIT_GENERAL: string | undefined;
  RATE_LIMIT_AUTH: string | undefined;
  RATE_LIMIT_GAME: string | undefined;
  RATE_LIMIT_ADMIN: string | undefined;
  ENABLE_METRICS: string | undefined;
  ENABLE_TRACING: string | undefined;
  BACKUP_RETENTION_DAYS: string | undefined;
  BACKUP_SCHEDULE: string | undefined;
  NODE_OPTIONS: string | undefined;
};

function validateEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const isStaging = nodeEnv === 'staging';
  const isDev = nodeEnv === 'development';
  const isMock = process.env.DEV_TELEGRAM_MOCK === 'true' && isDev;

  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    // Allow missing TELEGRAM_BOT_TOKEN in dev mock mode
    if (key === 'TELEGRAM_BOT_TOKEN' && isMock) {
      continue;
    }
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // In production and staging, additional vars are required
  if (isProd || isStaging) {
    const prodRequired = ['MINI_APP_URL', 'TELEGRAM_WEBHOOK_SECRET', 'SESSION_SECRET'] as const;
    for (const key of prodRequired) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Copy .env.development to .env and fill in the values.'
    );
  }

  // Reject mock auth in staging and production
  if (!isDev && process.env.DEV_TELEGRAM_MOCK === 'true') {
    throw new Error(
      'DEV_TELEGRAM_MOCK=true is not allowed outside development. ' +
        'Set NODE_ENV=development to use mock authentication.'
    );
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? (isMock ? 'mock-token' : ''),
    JWT_SECRET: process.env.JWT_SECRET!,
    ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
    STARS_PAYMENT_TOKEN: process.env.STARS_PAYMENT_TOKEN,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    API_PORT: process.env.API_PORT ?? '3001',
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? (isDev ? 'http://localhost:5173' : ''),
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME ?? 'gtxrushbot',
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    MINI_APP_URL: process.env.MINI_APP_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    DEV_TELEGRAM_MOCK: process.env.DEV_TELEGRAM_MOCK,
    NODE_ENV: nodeEnv,
    LOG_LEVEL: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    DB_POOL_MIN: process.env.DB_POOL_MIN,
    DB_POOL_MAX: process.env.DB_POOL_MAX,
    DB_STATEMENT_TIMEOUT_MS: process.env.DB_STATEMENT_TIMEOUT_MS,
    RATE_LIMIT_GENERAL: process.env.RATE_LIMIT_GENERAL,
    RATE_LIMIT_AUTH: process.env.RATE_LIMIT_AUTH,
    RATE_LIMIT_GAME: process.env.RATE_LIMIT_GAME,
    RATE_LIMIT_ADMIN: process.env.RATE_LIMIT_ADMIN,
    ENABLE_METRICS: process.env.ENABLE_METRICS,
    ENABLE_TRACING: process.env.ENABLE_TRACING,
    BACKUP_RETENTION_DAYS: process.env.BACKUP_RETENTION_DAYS,
    BACKUP_SCHEDULE: process.env.BACKUP_SCHEDULE,
    NODE_OPTIONS: process.env.NODE_OPTIONS,
  };
}

let _env: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isStaging(): boolean {
  return getEnv().NODE_ENV === 'staging';
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

export function isMockAuthEnabled(): boolean {
  return isDevelopment() && getEnv().DEV_TELEGRAM_MOCK === 'true';
}
