/**
 * ⚠️ DEPRECATED — Legacy Challenge Routes
 *
 * This file is replaced by:
 * - daily-challenge.ts (Daily Rush endpoints)
 * - friend-challenge.ts (Friend Challenge endpoints)
 * - challenge-scheduler.ts (Scheduler endpoints)
 *
 * All challenge functionality has been moved to the Challenge Engine services.
 * This file is kept temporarily for backwards compatibility during migration.
 *
 * The routes below are preserved as thin wrappers that delegate to the new services.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createFriendChallenge,
  getFriendChallengeByToken,
  acceptFriendChallenge,
  submitFriendChallengeScore,
  generateDeepLink,
} from '../services/friend-challenge';

// ============================================================
// Mock auth helper
// ============================================================
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }

  return 'dev-user-001';
}

function getGameName(gameId: string): string {
  const names: Record<string, string> = {
    'reaction-rush': 'Reaction Rush',
    'tap-rush': 'Tap Rush',
    'quiz-rush': 'Quiz Rush',
  };
  return names[gameId] ?? gameId;
}

// ============================================================
// Legacy Routes (delegating to new services)
// ============================================================

export async function challengeRoutes(app: FastifyInstance) {
  /**
   * POST /api/challenges/friend/create
   * @deprecated Use POST /api/challenges/friend/create from friend-challenge.ts
   */
  app.post('/challenges/friend/create', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { gameId, challengerId, challengerName } = request.body as {
      gameId: string;
      challengerId: string;
      challengerName: string;
    };

    if (!gameId || !challengerId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'gameId and challengerId required' },
      });
    }

    const result = createFriendChallenge(challengerId, gameId);
    if (!result.success || !result.challenge) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        id: result.challenge.id,
        token: result.challenge.challengeToken,
        gameId: result.challenge.gameId,
        gameName: getGameName(result.challenge.gameId),
        deepLink: `chal_${result.challenge.challengeToken}`,
        expiresAt: result.challenge.expiresAt.toISOString(),
      },
    };
  });

  /**
   * GET /api/challenges/friend/:token
   * @deprecated Use GET /api/challenges/friend/:token from friend-challenge.ts
   */
  app.get('/challenges/friend/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const challenge = getFriendChallengeByToken(token);

    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Challenge not found' },
      });
    }

    return {
      success: true,
      data: {
        ...challenge,
        gameName: getGameName(challenge.gameId),
        createdAt: challenge.createdAt.toISOString(),
        expiresAt: challenge.expiresAt.toISOString(),
        completedAt: challenge.completedAt?.toISOString() ?? null,
      },
    };
  });

  /**
   * POST /api/challenges/friend/:token/accept
   * @deprecated Use POST /api/challenges/friend/:token/accept from friend-challenge.ts
   */
  app.post('/challenges/friend/:token/accept', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { opponentId, opponentName } = request.body as {
      opponentId: string;
      opponentName: string;
    };

    const result = acceptFriendChallenge(token, opponentId);
    if (!result.success || !result.challenge) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        ...result.challenge,
        gameName: getGameName(result.challenge.gameId),
      },
    };
  });

  /**
   * POST /api/challenges/friend/:token/score
   * @deprecated Use POST /api/challenges/friend/:token/score from friend-challenge.ts
   */
  app.post('/challenges/friend/:token/score', async (request, reply) => {
    const { token } = request.params as { token: string };
    const { userId, score } = request.body as {
      userId: string;
      score: number;
    };

    const challenge = getFriendChallengeByToken(token);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Challenge not found' },
      });
    }

    const result = submitFriendChallengeScore(
      challenge.id,
      userId,
      score,
      `session_${challenge.id}_${userId}`, // Placeholder session ID
    );

    return {
      success: true,
      data: {
        token,
        status: result.challenge?.status ?? challenge.status,
        challengerScore: result.challenge?.challengerScore ?? null,
        opponentScore: result.challenge?.opponentScore ?? null,
        winner: result.winner ?? null,
        completed: result.completed ?? false,
      },
    };
  });
}
