import type { FastifyInstance } from 'fastify';
import { GAME_LIST } from '@gtx-rush/config';

export async function gameRoutes(app: FastifyInstance) {
  /**
   * GET /api/games
   * List all active games
   */
  app.get('/games', async () => {
    return {
      success: true,
      data: GAME_LIST.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
      })),
    };
  });

  /**
   * GET /api/games/:slug
   * Get game details
   */
  app.get('/games/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const game = GAME_LIST.find((g) => g.id === slug);

    if (!game) {
      return reply.status(404).send({
        success: false,
        error: { code: 'GAME_NOT_FOUND', message: `Game "${slug}" not found` },
      });
    }

    return { success: true, data: game };
  });

  /**
   * POST /api/sessions/start
   * Start a new game session
   */
  app.post('/sessions/start', async (request, reply) => {
    // TODO: Authenticate user
    // TODO: Create session in database
    const { gameId, clientSessionToken } = request.body as {
      gameId: string;
      clientSessionToken: string;
    };

    if (!gameId || !clientSessionToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'gameId and clientSessionToken required' },
      });
    }

    // Placeholder response
    return {
      success: true,
      data: {
        sessionId: 'placeholder_session_id',
        gameConfig: {},
      },
    };
  });

  /**
   * POST /api/sessions/:id/finish
   * Finish session and calculate score
   */
  app.post('/sessions/:id/finish', async (request, reply) => {
    // TODO: Validate session, calculate score server-side, run anti-cheat
    const { clientCalculatedScore } = request.body as { clientCalculatedScore: number };

    // Placeholder — server will recalculate from inputs
    return {
      success: true,
      data: {
        sessionId: (request.params as { id: string }).id,
        score: clientCalculatedScore, // Will be replaced with server-calculated score
        rank: null,
        isPersonalBest: true,
        xpAwarded: 10,
        breakdown: {},
      },
    };
  });
}
