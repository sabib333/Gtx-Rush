/**
 * GTX Rush API Server v1.0
 *
 * Central API server for the GTX Rush platform.
 * Handles authentication, games, leaderboards, challenges, competition, and bot webhooks.
 *
 * Contract: Production Infrastructure Contract v1.0
 */

import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { getEnv, isProduction } from '@gtx-rush/config';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/games';
import { leaderboardRoutes } from './routes/leaderboard';
import { userRoutes } from './routes/users';
import { dailyChallengeRoutes } from './routes/daily-challenge';
import { friendChallengeRoutes } from './routes/friend-challenge';
import { challengeSchedulerRoutes } from './routes/challenge-scheduler';
import { rankingRoutes } from './routes/ranking';
import { seasonRoutes } from './routes/season';
import { achievementRoutes } from './routes/achievements';
import { botWebhookRoute } from './routes/bot-webhook';
import { reactionRushRoutes } from './routes/reaction-rush';
import { tapRushRoutes } from './routes/tap-rush';
import { quizRushRoutes } from './routes/quiz-rush';
import { retentionRoutes } from './routes/retention';
import { storeRoutes } from './routes/store';
import { growthRoutes } from './routes/growth';
import { eventRoutes } from './routes/events';
import { socialRoutes } from './routes/social';
import { personalizationRoutes } from './routes/personalization';
import { aiRoutes } from './routes/ai';
import { creatorRoutes } from './routes/creator';
import { economyRoutes } from './routes/economy';
import { marketplaceRoutes } from './routes/marketplace';
import { liveOpsRoutes } from './routes/liveops';
import { adminRoutes } from './routes/admin';
import { seedDefaultAdmin } from './middleware/admin-auth';
import { authRateLimit, generalRateLimit, adminRateLimit } from './middleware/rate-limiter';
import { requestIdPlugin } from './middleware/request-id';
import { securityHeaders } from './middleware/security-headers';
import { errorHandler } from './middleware/error-handler';
import { healthCheckRoutes } from './middleware/health-check';
import { logger, createRequestLogger } from './infrastructure/logger';
import { queue } from './infrastructure/queue';
import { runScheduledJobs } from './services/challenge-scheduler';
import { runCompetitionJobs } from './services/competition-scheduler';
import { runRetentionJobs } from './services/retention-scheduler';
import { runLiveOpsJobs } from './services/liveops-scheduler';

async function main() {
  const env = getEnv();

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL ?? (isProduction() ? 'info' : 'debug'),
      // Never log sensitive headers
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
    // Trust proxy for correct IP resolution behind load balancers
    trustProxy: isProduction(),
    // Request ID generation
    genReqId: () => `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  });

  // --- Security Middleware ---
  await app.register(requestIdPlugin);
  await app.register(securityHeaders);
  await app.register(errorHandler);

  // --- CORS Configuration ---
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  });

  // --- Health Check Routes ---
  await healthCheckRoutes(app);

  // --- Global rate limiter ---
  await app.addHook('onRequest', generalRateLimit);

  // --- Request logging hook ---
  app.addHook('onRequest', async (request) => {
    const reqLogger = createRequestLogger(
      request.id,
      request.method,
      request.url,
      request.ip ?? undefined,
    );
    // Attach structured logger for use in route handlers
    (request as FastifyRequest & { structuredLog: typeof reqLogger.log }).structuredLog = reqLogger.log;
  });

  // --- Routes ---

  // --- API v1 Routes ---
  // All routes under /api/v1/ prefix for versioning
  await app.register(async (v1App) => {
    // Auth routes with stricter rate limiting
    await v1App.register(async (authApp) => {
      await authApp.addHook('onRequest', authRateLimit);
      await authApp.register(authRoutes);
    }, { prefix: '/auth' });

    // Core routes
    await v1App.register(gameRoutes);
    await v1App.register(leaderboardRoutes, { prefix: '/leaderboards' });
    await v1App.register(userRoutes, { prefix: '/users' });

    // Challenge Engine routes
    await v1App.register(dailyChallengeRoutes);
    await v1App.register(friendChallengeRoutes);
    await v1App.register(challengeSchedulerRoutes);

    // Competition System routes
    await v1App.register(rankingRoutes);
    await v1App.register(seasonRoutes);
    await v1App.register(achievementRoutes);

    // Game routes
    await v1App.register(reactionRushRoutes);
    await v1App.register(tapRushRoutes);
    await v1App.register(quizRushRoutes);

    // Retention Engine routes
    await v1App.register(retentionRoutes);

    // Monetization / Store routes
    await v1App.register(storeRoutes);

    // Growth Engine routes
    await v1App.register(growthRoutes);

    // Live Events & Tournament routes
    await v1App.register(eventRoutes);

    // Social & Community routes
    await v1App.register(socialRoutes);

    // AI Personalization & Smart Game Director routes
    await v1App.register(personalizationRoutes);

    // AI Intelligence Engine routes (recommendations, home feed)
    await v1App.register(aiRoutes);

    // Creator & UGC Engine routes
    await v1App.register(creatorRoutes);

    // Economy, Rewards & Inventory Engine routes
    await v1App.register(economyRoutes);

    // Marketplace & Digital Items routes (§53)
    await v1App.register(marketplaceRoutes);

    // LiveOps Engine routes
    await v1App.register(liveOpsRoutes);
  }, { prefix: '/api/v1' });

  // --- Bot Webhook (outside versioned routes) ---
  await app.register(botWebhookRoute);

  // --- Admin Command Center Routes ---
  // Completely separate from player application
  // All routes require admin authentication and RBAC
  await app.register(async (adminApp) => {
    await adminApp.addHook('onRequest', adminRateLimit);
    await adminApp.register(adminRoutes);
  }, { prefix: '/api/admin' });

  // --- Seed Default Admin ---
  seedDefaultAdmin();

  // --- Scheduled Jobs ---
  // Run initial job check on startup
  try {
    const challengeResults = runScheduledJobs();
    if (challengeResults.length > 0) {
      app.log.info(`[Challenge Scheduler] Executed ${challengeResults.length} job(s) on startup`);
    }

    const competitionResults = runCompetitionJobs();
    if (competitionResults.length > 0) {
      app.log.info(`[Competition Scheduler] Executed ${competitionResults.length} job(s) on startup`);
    }

    const retentionResults = runRetentionJobs();
    if (retentionResults.length > 0) {
      app.log.info(`[Retention Scheduler] Executed ${retentionResults.length} job(s) on startup`);
    }

    const liveOpsResults = runLiveOpsJobs();
    if (liveOpsResults.length > 0) {
      app.log.info(`[LiveOps Scheduler] Executed ${liveOpsResults.length} job(s) on startup`);
    }
  } catch (err: unknown) {
    app.log.warn('[Scheduler] Failed to run startup jobs: %s', err instanceof Error ? err.message : String(err));
  }

  // Set up periodic schedulers
  const schedulerInterval = setInterval(() => {
    try {
      runScheduledJobs();
      runCompetitionJobs();
      runRetentionJobs();
      runLiveOpsJobs();
    } catch (err: unknown) {
      app.log.warn('[Scheduler] Job execution failed: %s', err instanceof Error ? err.message : String(err));
    }
  }, 60_000);

  // --- Graceful Shutdown ---
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new requests
    await app.close();

    // Stop schedulers
    clearInterval(schedulerInterval);

    // Shutdown infrastructure
    await queue.close();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // --- Start ---
  const port = Number(env.API_PORT);
  await app.listen({ port, host: '0.0.0.0' });

  logger.info('GTX Rush API started', {
    port,
    env: env.NODE_ENV,
    version: '1.0.0',
    apiPrefix: '/api/v1',
    adminPrefix: '/api/admin',
  });

  if (env.DEV_TELEGRAM_MOCK === 'true') {
    logger.warn('DEV_TELEGRAM_MOCK is enabled — mock authentication active');
  }
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
