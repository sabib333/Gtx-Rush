/**
 * GTX Rush — Health Check Endpoints v1.0
 *
 * /health — Liveness probe (is the app alive?)
 * /ready  — Readiness probe (is the app ready to serve traffic?)
 *
 * Health checks distinguish between:
 * - Application alive (process running)
 * - Application ready (dependencies connected)
 *
 * Does not expose sensitive infrastructure details.
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { getEnv } from '@gtx-rush/config';
import { createLogger } from '../infrastructure/logger';

const log = createLogger('health');

// ============================================================
// Health State
// ============================================================

interface HealthState {
  startedAt: Date;
  lastHealthCheck: Date | null;
  redisAvailable: boolean;
  databaseAvailable: boolean;
}

const state: HealthState = {
  startedAt: new Date(),
  lastHealthCheck: null,
  redisAvailable: false,
  databaseAvailable: true, // Assume DB is available until proven otherwise
};

/**
 * Update health state (called by infrastructure modules).
 */
export function setRedisHealth(available: boolean): void {
  state.redisAvailable = available;
}

export function setDatabaseHealth(available: boolean): void {
  state.databaseAvailable = available;
}

// ============================================================
// Health Check Routes
// ============================================================

export async function healthCheckRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health — Liveness probe
   * Returns 200 if the application process is running.
   * Used by container orchestrators to determine if the process should be restarted.
   */
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - state.startedAt.getTime()) / 1000),
    });
  });

  /**
   * GET /ready — Readiness probe
   * Returns 200 only if the application can serve traffic.
   * Returns 503 if critical dependencies are unavailable.
   * Used by load balancers to route traffic.
   */
  app.get('/ready', async (_request, reply) => {
    state.lastHealthCheck = new Date();

    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Check Redis
    const redisStart = Date.now();
    try {
      const env = getEnv();
      const redis = new Redis(env.REDIS_URL, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 0,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
      state.redisAvailable = true;
    } catch {
      checks.redis = { status: 'unavailable', latencyMs: Date.now() - redisStart };
      state.redisAvailable = false;
    }

    // Check Database (basic connectivity)
    // In production, this would ping the actual database
    checks.database = { status: state.databaseAvailable ? 'ok' : 'unavailable' };

    // Determine overall readiness
    // Redis is optional in dev but required in production
    const isProd = getEnv().NODE_ENV === 'production';
    const ready = state.databaseAvailable && (isProd ? state.redisAvailable : true);

    const response = {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    };

    return reply.status(ready ? 200 : 503).send(response);
  });
}
