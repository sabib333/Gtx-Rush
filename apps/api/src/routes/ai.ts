/**
 * GTX Rush — AI Intelligence API Routes v1.0
 *
 * Player-facing AI endpoints (§55):
 * - GET  /api/v1/ai/home            → personalized home feed
 * - GET  /api/v1/ai/recommendations → ranked recommendations (filterable by kind)
 * - GET  /api/v1/ai/difficulty      → advisory difficulty suggestion
 * - POST /api/v1/ai/track           → recommendation interaction tracking
 *
 * SECURITY (§55):
 * - Internal risk scores are NEVER exposed on these routes
 * - Model internals are NEVER exposed; reasons use friendly reason codes (§35)
 * - AI failure never blocks the endpoint — safe fallbacks served instead (§39, §40)
 *
 * Contract: AI Intelligence Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import type { RecommendationKind } from '@gtx-rush/types';
import {
  getPersonalizedHomeSafe,
  generateRecommendations,
  getTrendingFallback,
  recommendDifficulty,
  trackRecommendationInteraction,
} from '../services/ai/recommendation-engine';

const VALID_KINDS: RecommendationKind[] = ['game', 'challenge', 'creator', 'event', 'mission'];
const VALID_ACTIONS = ['impression', 'click', 'start', 'complete', 'dismiss'];

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /ai/home — personalized home feed (§8).
   * Falls back to trending content on any internal failure (§39).
   */
  app.get('/ai/home', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId;
    if (!userId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_USER_ID', message: 'userId is required' },
      });
    }

    // getPersonalizedHomeSafe never throws — fallback feed guaranteed
    const feed = getPersonalizedHomeSafe(userId);
    return reply.send({ success: true, data: feed });
  });

  /**
   * GET /ai/recommendations — ranked recommendations (§4-7, §11).
   */
  app.get('/ai/recommendations', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const userId = query.userId;
    if (!userId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_USER_ID', message: 'userId is required' },
      });
    }

    let kinds: RecommendationKind[] | undefined;
    if (query.kinds) {
      const requested = query.kinds.split(',') as RecommendationKind[];
      kinds = requested.filter((k) => VALID_KINDS.includes(k));
    }

    try {
      const recommendations = generateRecommendations(userId, {
        kinds,
        limit: query.limit ? Math.min(20, Math.max(1, Number(query.limit) || 5)) : undefined,
      });
      return reply.send({ success: true, data: { recommendations } });
    } catch {
      // Safe fallback rules (§39): trending content when AI is unavailable
      return reply.send({
        success: true,
        data: { recommendations: getTrendingFallback(), fallbackUsed: true },
      });
    }
  });

  /**
   * GET /ai/difficulty — advisory difficulty suggestion (§9).
   * Does NOT change official competitive rules.
   */
  app.get('/ai/difficulty', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const userId = query.userId;
    const gameId = query.gameId;

    if (!userId || !gameId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'userId and gameId are required' },
      });
    }

    const suggestion = recommendDifficulty(userId, gameId);
    return reply.send({ success: true, data: suggestion });
  });

  /**
   * POST /ai/track — recommendation analytics (§44).
   */
  app.post('/ai/track', async (request, reply) => {
    const body = request.body as {
      userId?: string;
      recommendationId?: string;
      kind?: string;
      action?: string;
    };

    if (
      !body.userId ||
      !body.recommendationId ||
      !body.kind ||
      !body.action ||
      !VALID_KINDS.includes(body.kind as RecommendationKind) ||
      !VALID_ACTIONS.includes(body.action)
    ) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: `userId, recommendationId, kind (${VALID_KINDS.join('|')}) and action (${VALID_ACTIONS.join('|')}) are required`,
        },
      });
    }

    trackRecommendationInteraction({
      userId: body.userId,
      recommendationId: body.recommendationId,
      kind: body.kind as RecommendationKind,
      action: body.action as never,
    });

    return reply.send({ success: true, data: { message: 'Interaction tracked' } });
  });
}
