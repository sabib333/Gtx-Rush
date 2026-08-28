/**
 * Ranking — API Routes v1.0
 *
 * Unified leaderboard endpoints:
 * - GET /api/rankings/:scope        → Leaderboard for a scope
 * - GET /api/rankings/:scope/around → Around-me ranking
 * - GET /api/rankings/:scope/rank   → Current user's rank
 *
 * Scopes: global, country, game, weekly, season, friends
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getLeaderboard,
  getUserRank,
  getAroundMe,
  getUserAllRanks,
} from '../services/ranking-service';
import { getActiveSeason } from '../services/season-engine';
import { getUserTierWithDefinition } from '../services/tier-system';

// ============================================================
// Mock auth helper
// ============================================================
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) return 'dev-user-001';
  return 'dev-user-001';
}

// ============================================================
// Routes
// ============================================================

export async function rankingRoutes(app: FastifyInstance) {
  /**
   * GET /api/rankings/:scope
   *
   * Get leaderboard for a specific scope.
   * Supports query params: gameId, countryCode, seasonId, weekId, cursor, limit
   */
  app.get('/rankings/:scope', async (request, reply) => {
    const { scope } = request.params as { scope: string };
    const { gameId, countryCode, seasonId, weekId, cursor, limit, type = 'score' } = request.query as {
      gameId?: string;
      countryCode?: string;
      seasonId?: string;
      weekId?: string;
      cursor?: string;
      limit?: string;
      type?: string;
    };

    const validScopes = ['global', 'country', 'game', 'weekly', 'season', 'friends'];
    if (!validScopes.includes(scope)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_SCOPE', message: `Invalid scope: ${scope}` },
      });
    }

    // Default season to active season
    const actualSeasonId = seasonId ?? getActiveSeason()?.id;

    const response = getLeaderboard({
      scope: scope as 'global' | 'country' | 'game' | 'weekly' | 'season' | 'friends',
      type: type as 'score' | 'xp' | 'season',
      gameId,
      countryCode,
      seasonId: actualSeasonId,
      weekId,
      cursor,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    // Attach user rank if authenticated
    const userId = getUserId(request);
    if (userId) {
      response.userRank = getUserRank(
        userId,
        scope as 'global' | 'country' | 'game' | 'weekly' | 'season' | 'friends',
        type as 'score' | 'xp' | 'season',
        { gameId, countryCode, seasonId: actualSeasonId, weekId },
      );
    }

    return { success: true, data: response };
  });

  /**
   * GET /api/rankings/:scope/around
   *
   * Get "around me" ranking: top 3, user position, nearby entries.
   */
  app.get('/rankings/:scope/around', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { scope } = request.params as { scope: string };
    const { gameId, countryCode, seasonId, weekId, contextSize, type = 'score' } = request.query as {
      gameId?: string;
      countryCode?: string;
      seasonId?: string;
      weekId?: string;
      contextSize?: string;
      type?: string;
    };

    const actualSeasonId = seasonId ?? getActiveSeason()?.id;

    const response = getAroundMe(
      userId,
      scope as 'global' | 'country' | 'game' | 'weekly' | 'season' | 'friends',
      type as 'score' | 'xp' | 'season',
      {
        gameId,
        countryCode,
        seasonId: actualSeasonId,
        weekId,
        contextSize: contextSize ? parseInt(contextSize, 10) : 3,
      },
    );

    return { success: true, data: response };
  });

  /**
   * GET /api/rankings/:scope/rank
   *
   * Get current user's rank in a specific scope.
   */
  app.get('/rankings/:scope/rank', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { scope } = request.params as { scope: string };
    const { gameId, countryCode, seasonId, weekId, type = 'score' } = request.query as {
      gameId?: string;
      countryCode?: string;
      seasonId?: string;
      weekId?: string;
      type?: string;
    };

    const actualSeasonId = seasonId ?? getActiveSeason()?.id;

    const rank = getUserRank(
      userId,
      scope as 'global' | 'country' | 'game' | 'weekly' | 'season' | 'friends',
      type as 'score' | 'xp' | 'season',
      { gameId, countryCode, seasonId: actualSeasonId, weekId },
    );

    return {
      success: true,
      data: rank ?? { rank: null, score: 0, tier: null },
    };
  });

  /**
   * GET /api/users/me/ranks
   *
   * Get all ranks for the current user across all scopes.
   */
  app.get('/users/me/ranks', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const allRanks = getUserAllRanks(userId);
    const activeSeason = getActiveSeason();
    const userTier = activeSeason
      ? getUserTierWithDefinition(userId, activeSeason.id)
      : null;

    return {
      success: true,
      data: {
        ...allRanks,
        tier: userTier,
      },
    };
  });
}
