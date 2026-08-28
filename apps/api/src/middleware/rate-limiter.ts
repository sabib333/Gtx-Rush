/**
 * Rate Limiter Middleware
 *
 * Supports both in-memory (dev) and Redis-backed (production) rate limiting.
 * In production, uses Redis for distributed rate limiting across instances.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { getEnv, isDevelopment } from '@gtx-rush/config';
import { createLogger } from '../infrastructure/logger';

const log = createLogger('rate-limiter');

// ============================================================
// In-Memory Store (dev fallback)
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================
// Redis Client (lazy-init)
// ============================================================

let redisClient: Redis | null = null;
let redisAvailable = false;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  try {
    const env = getEnv();
    redisClient = new Redis(env.REDIS_URL, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });
    redisClient.on('connect', () => { redisAvailable = true; });
    redisClient.on('error', () => { redisAvailable = false; });
    redisClient.connect().catch(() => { redisAvailable = false; });
    return redisClient;
  } catch {
    return null;
  }
}

// ============================================================
// Configuration
// ============================================================

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
  /** Key generator (default: IP address) */
  keyGenerator?: (req: FastifyRequest) => string;
  /** Message to return when rate limited */
  message?: string;
  /** Redis key prefix */
  prefix?: string;
}

// ============================================================
// Rate Limiter Factory
// ============================================================

export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    keyGenerator = (req) => req.ip ?? 'unknown',
    message = 'Too many requests. Please try again later.',
    prefix = 'rl',
  } = config;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator(req);
    const redisKey = `${prefix}:${key}`;
    const now = Date.now();

    let count = 0;
    let resetAt = now + windowMs;

    // Try Redis-backed rate limiting
    if (!isDevelopment()) {
      const redis = getRedis();
      if (redis && redisAvailable) {
        try {
          // Use Redis pipeline for atomic operations
          const pipeline = redis.pipeline();
          pipeline.incr(redisKey);
          pipeline.expire(redisKey, windowSeconds);
          const results = await pipeline.exec();

          if (results) {
            count = (results[0]?.[1] as number) ?? 0;
            const ttl = await redis.ttl(redisKey);
            resetAt = now + (ttl > 0 ? ttl * 1000 : windowMs);
          }
        } catch {
          // Fall through to memory
        }
      }
    }

    // Fallback to in-memory
    if (count === 0) {
      const entry = memoryStore.get(redisKey);
      if (!entry || now > entry.resetAt) {
        const newEntry = { count: 0, resetAt: now + windowMs };
        memoryStore.set(redisKey, newEntry);
        count = 0;
        resetAt = newEntry.resetAt;
      } else {
        count = entry.count;
        resetAt = entry.resetAt;
      }
    }

    count++;
    if (count === 1 && !redisAvailable) {
      const entry = memoryStore.get(redisKey);
      if (entry) entry.count = count;
    }

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', Math.max(0, max - count));
    reply.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

    if (count > max) {
      reply.header('Retry-After', Math.ceil((resetAt - now) / 1000));
      log.warn('Rate limit hit', { key, count, max, path: req.url });
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
    }
  };
}

// ============================================================
// Pre-configured Rate Limiters
// ============================================================

/** Auth endpoints: 10 requests per minute */
export const authRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait a moment.',
  prefix: 'rl:auth',
});

/** Deep link processing: 20 requests per minute */
export const deepLinkRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many requests. Please slow down.',
  prefix: 'rl:deep',
});

/** Bot commands: 30 requests per minute */
export const botCommandRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many commands. Please wait a moment.',
  prefix: 'rl:bot',
});

/** Challenge actions: 10 requests per minute */
export const challengeRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many challenge actions. Please wait.',
  prefix: 'rl:challenge',
});

/** Score submission: 20 requests per minute */
export const scoreRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many score submissions. Please wait.',
  prefix: 'rl:score',
});

/** Payment endpoints: 5 requests per minute */
export const paymentRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many payment requests. Please wait.',
  prefix: 'rl:payment',
});

/** Admin APIs: 200 requests per minute */
export const adminRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Admin rate limit exceeded.',
  prefix: 'rl:admin',
});

/** General API: 100 requests per minute */
export const generalRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Rate limit exceeded. Please try again later.',
  prefix: 'rl:general',
});
