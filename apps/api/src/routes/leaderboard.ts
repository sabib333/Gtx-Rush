import type { FastifyInstance } from 'fastify';

export async function leaderboardRoutes(app: FastifyInstance) {
  /**
   * GET /api/leaderboards
   * List available leaderboards
   */
  app.get('/', async () => {
    return {
      success: true,
      data: [
        { type: 'global', name: 'Global All-Time' },
        { type: 'weekly', name: 'Weekly' },
      ],
    };
  });

  /**
   * GET /api/leaderboards/:type
   * Get leaderboard entries
   */
  app.get('/:type', async (request, reply) => {
    const { type } = request.params as { type: string };
    const { gameId, countryCode, cursor, limit } = request.query as {
      gameId?: string;
      countryCode?: string;
      cursor?: string;
      limit?: string;
    };

    // TODO: Query Redis/PostgreSQL for leaderboard data
    return {
      success: true,
      data: [],
      pagination: { nextCursor: null, hasMore: false },
    };
  });

  /**
   * GET /api/leaderboards/:type/rank
   * Get current user's rank
   */
  app.get('/:type/rank', async (request, reply) => {
    // TODO: Authenticate user and get their rank
    return {
      success: true,
      data: { rank: null, score: 0 },
    };
  });
}
