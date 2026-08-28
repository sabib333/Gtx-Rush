/**
 * Season — API Routes v1.0
 *
 * - GET  /api/seasons/current     → Get current active season
 * - GET  /api/seasons/history     → Get all seasons
 * - GET  /api/seasons/:id         → Get season by ID
 * - GET  /api/seasons/:id/rankings → Get season rankings
 * - GET  /api/seasons/:id/rewards → Get season rewards
 * - GET  /api/users/me/seasons    → Get user's season history
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getActiveSeason,
  getAllSeasons,
  getSeasonById,
  getSeasonRankings,
  getSeasonRanking,
} from '../services/season-engine';
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

export async function seasonRoutes(app: FastifyInstance) {
  /**
   * GET /api/seasons/current
   *
   * Get the current active season with user-specific data.
   */
  app.get('/seasons/current', async (request, reply) => {
    const season = getActiveSeason();

    if (!season) {
      return {
        success: true,
        data: {
          season: null,
          message: 'No active season',
        },
      };
    }

    const userId = getUserId(request);
    let userRank = null;
    let userTier = null;

    if (userId) {
      userRank = getSeasonRanking(userId, season.id);
      userTier = getUserTierWithDefinition(userId, season.id);
    }

    const now = new Date();
    const timeRemaining = Math.max(0, season.endsAt.getTime() - now.getTime());

    return {
      success: true,
      data: {
        season: {
          ...season,
          startsAt: season.startsAt.toISOString(),
          endsAt: season.endsAt.toISOString(),
          createdAt: season.createdAt.toISOString(),
          updatedAt: season.updatedAt.toISOString(),
        },
        userRank: userRank ? {
          score: userRank.score,
          rank: userRank.rank,
          breakdown: userRank.breakdown,
        } : null,
        userTier,
        timeRemaining,
      },
    };
  });

  /**
   * GET /api/seasons/history
   *
   * Get all seasons (including past).
   */
  app.get('/seasons/history', async (request, reply) => {
    const { limit: rawLimit } = request.query as { limit?: string };
    const limit = rawLimit ? parseInt(rawLimit, 10) : 20;

    const seasons = getAllSeasons().slice(0, limit);

    return {
      success: true,
      data: seasons.map((s) => ({
        ...s,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  });

  /**
   * GET /api/seasons/:id
   *
   * Get a specific season by ID.
   */
  app.get('/seasons/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const season = getSeasonById(id);
    if (!season) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SEASON_NOT_FOUND', message: 'Season not found' },
      });
    }

    return {
      success: true,
      data: {
        ...season,
        startsAt: season.startsAt.toISOString(),
        endsAt: season.endsAt.toISOString(),
        createdAt: season.createdAt.toISOString(),
        updatedAt: season.updatedAt.toISOString(),
      },
    };
  });

  /**
   * GET /api/seasons/:id/rankings
   *
   * Get season rankings (leaderboard).
   */
  app.get('/seasons/:id/rankings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { cursor, limit } = request.query as { cursor?: string; limit?: string };

    const season = getSeasonById(id);
    if (!season) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SEASON_NOT_FOUND', message: 'Season not found' },
      });
    }

    const rankings = getSeasonRankings(id, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return {
      success: true,
      data: {
        seasonId: id,
        seasonName: season.name,
        seasonNumber: season.number,
        status: season.status,
        entries: rankings.entries.map((r) => ({
          rank: r.rank,
          userId: r.userId,
          score: r.score,
          breakdown: r.breakdown,
        })),
        pagination: {
          nextCursor: rankings.nextCursor,
          hasMore: rankings.hasMore,
        },
      },
    };
  });

  /**
   * GET /api/seasons/:id/rewards
   *
   * Get season reward tiers.
   */
  app.get('/seasons/:id/rewards', async (request, reply) => {
    const { id } = request.params as { id: string };

    const season = getSeasonById(id);
    if (!season) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SEASON_NOT_FOUND', message: 'Season not found' },
      });
    }

    return {
      success: true,
      data: {
        seasonId: id,
        seasonName: season.name,
        rewards: season.rewardConfiguration.tiers,
      },
    };
  });

  /**
   * GET /api/users/me/seasons
   *
   * Get current user's season history.
   */
  app.get('/users/me/seasons', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const allSeasons = getAllSeasons();
    const seasonHistory = allSeasons.map((season) => {
      const ranking = getSeasonRanking(userId, season.id);
      const tier = getUserTierWithDefinition(userId, season.id);
      return {
        seasonId: season.id,
        seasonNumber: season.number,
        seasonName: season.name,
        status: season.status,
        score: ranking?.score ?? 0,
        rank: ranking?.rank ?? null,
        tier: tier?.tierName ?? 'bronze',
        division: tier?.division ?? 1,
      };
    });

    return {
      success: true,
      data: seasonHistory,
    };
  });
}
