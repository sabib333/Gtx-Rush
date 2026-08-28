/**
 * GTX Rush — Cache Layer v1.0
 *
 * Redis-backed cache with:
 * - TTL-based expiration
 * - Key prefixing per service
 * - In-memory fallback when Redis is unavailable
 * - Cache invalidation strategies
 * - Never the source of truth for critical data
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import Redis from 'ioredis';
import { getEnv, isDevelopment } from '@gtx-rush/config';
import { createLogger } from './logger';

const log = createLogger('cache');

// ============================================================
// Cache Configuration
// ============================================================

interface CacheConfig {
  prefix: string;
  defaultTtlSeconds: number;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  prefix: 'gtx',
  defaultTtlSeconds: 300, // 5 minutes
  maxRetries: 3,
  retryDelayMs: 100,
};

// ============================================================
// In-Memory Fallback Store
// ============================================================

interface MemoryCacheEntry {
  value: string;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryCacheEntry>();

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function memoryDel(key: string): void {
  memoryStore.delete(key);
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.expiresAt) {
      memoryStore.delete(key);
    }
  }
}, 60_000);

// ============================================================
// Cache Class
// ============================================================

class CacheLayer {
  private redis: Redis | null = null;
  private config: CacheConfig;
  private available = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.connect();
  }

  private connect(): void {
    try {
      const env = getEnv();
      this.redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 5) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        enableReadyCheck: true,
      });

      this.redis.on('connect', () => {
        this.available = true;
        log.info('Redis connected');
      });

      this.redis.on('error', (err: Error) => {
        this.available = false;
        log.warn('Redis unavailable, using memory fallback', { error: err.message });
      });

      this.redis.on('close', () => {
        this.available = false;
        // Auto-reconnect after delay
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 5000);
        }
      });

      this.redis.connect().catch(() => {
        this.available = false;
        log.warn('Redis connection failed, using memory fallback');
      });
    } catch {
      this.available = false;
    }
  }

  private prefixedKey(key: string): string {
    return `${this.config.prefix}:${key}`;
  }

  /**
   * Get a cached value by key.
   */
  async get<T = string>(key: string): Promise<T | null> {
    const fullKey = this.prefixedKey(key);

    // Try Redis first
    if (this.available && this.redis) {
      try {
        const value = await this.redis.get(fullKey);
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      } catch {
        // Fall through to memory
      }
    }

    // Fallback to memory
    const memValue = memoryGet(fullKey);
    if (memValue === null) return null;
    try {
      return JSON.parse(memValue) as T;
    } catch {
      return memValue as unknown as T;
    }
  }

  /**
   * Set a cached value with TTL.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const fullKey = this.prefixedKey(key);
    const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    // Try Redis first
    if (this.available && this.redis) {
      try {
        await this.redis.setex(fullKey, ttl, serialized);
        return;
      } catch {
        // Fall through to memory
      }
    }

    // Fallback to memory
    memorySet(fullKey, serialized, ttl);
  }

  /**
   * Delete a cached key.
   */
  async del(key: string): Promise<void> {
    const fullKey = this.prefixedKey(key);

    if (this.available && this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch {
        // ignore
      }
    }

    memoryDel(fullKey);
  }

  /**
   * Invalidate all keys matching a pattern.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const fullPattern = this.prefixedKey(pattern);

    if (this.available && this.redis) {
      try {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch {
        // Fall through
      }
    }

    // Invalidate memory cache
    for (const key of memoryStore.keys()) {
      if (key.startsWith(this.config.prefix + ':') && key.includes(pattern.replace('*', ''))) {
        memoryStore.delete(key);
      }
    }
  }

  /**
   * Get or set (cache-aside pattern).
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Check if cache is available (Redis connected).
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Graceful shutdown.
   */
  async close(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// ============================================================
// Pre-configured cache instances
// ============================================================

/** Game configuration cache (5 minute TTL) */
export const gameConfigCache = new CacheLayer({ prefix: 'gtx:game', defaultTtlSeconds: 300 });

/** Leaderboard cache (1 minute TTL) */
export const leaderboardCache = new CacheLayer({ prefix: 'gtx:lb', defaultTtlSeconds: 60 });

/** Event configuration cache (2 minute TTL) */
export const eventCache = new CacheLayer({ prefix: 'gtx:event', defaultTtlSeconds: 120 });

/** Store catalog cache (10 minute TTL) */
export const storeCache = new CacheLayer({ prefix: 'gtx:store', defaultTtlSeconds: 600 });

/** General API cache (1 minute TTL) */
export const apiCache = new CacheLayer({ prefix: 'gtx:api', defaultTtlSeconds: 60 });

/** Public profile cache (5 minute TTL) */
export const profileCache = new CacheLayer({ prefix: 'gtx:profile', defaultTtlSeconds: 300 });

export { CacheLayer };
