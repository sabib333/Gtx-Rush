/**
 * Friend Challenge — API Routes v2.0
 *
 * Handles:
 * - POST /api/challenges/friend/create          → Create a new friend challenge
 * - GET  /api/challenges/friend/:token          → Get challenge details by token
 * - POST /api/challenges/friend/:token/accept   → Accept a challenge
 * - POST /api/challenges/friend/:token/score    → Submit score
 * - GET  /api/challenges/friend/:token/result   → Get challenge result
 * - POST /api/challenges/friend/:id/rematch     → Create rematch
 * - POST /api/challenges/friend/:id/share       → Track share
 * - GET  /api/users/me/challenges               → Get user's challenge history
 *
 * SECURITY:
 * - Challenge tokens are cryptographically random (12-char nanoid)
 * - Server validates all challenge properties
 * - Expired challenges cannot accept new results
 * - Duplicate completions are prevented
 * - Self-challenges are prevented
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createFriendChallenge,
  getFriendChallengeByToken,
  getFriendChallengeById,
  acceptFriendChallenge,
  submitFriendChallengeScore,
  createRematch,
  generateShareContent,
  generateDeepLink,
  getUserFriendChallengeHistory,
  getUserFriendChallenges,
  calculateFriendChallengeXP,
} from '../services/friend-challenge';
import {
  recordFriendChallengeHistory,
} from '../services/friend-challenge';
import {
  trackFriendChallengeCreated,
  trackFriendChallengeOpened,
  trackFriendChallengeStarted,
  trackFriendChallengeCompleted,
  trackFriendChallengeWon,
  trackFriendChallengeLost,
  trackFriendChallengeShared,
} from '../services/challenge-analytics';
import { challengeRateLimit } from '../middleware/rate-limiter';

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
// Routes
// ============================================================

export async function friendChallengeRoutes(app: FastifyInstance) {
  // Apply rate limiting
  await app.addHook('onRequest', challengeRateLimit);

  /**
   * POST /api/challenges/friend/create
   *
   * Create a new friend challenge.
   * Returns a challenge token and deep link for sharing.
   *
   * SECURITY:
   * - Self-challenges are prevented
   * - Creation is rate-limited
   * - Challenge token is cryptographically random
   */
  app.post('/challenges/friend/create', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { gameId, mode } = request.body as {
      gameId: string;
      mode?: string;
    };

    if (!gameId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'gameId is required' },
      });
    }

    const result = createFriendChallenge(userId, gameId, (mode as 'friend') ?? 'friend');

    if (!result.success || !result.challenge) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackFriendChallengeCreated(userId, result.challenge.id, gameId);

    return {
      success: true,
      data: {
        challengeId: result.challenge.id,
        challengeToken: result.challenge.challengeToken,
        gameId: result.challenge.gameId,
        gameName: getGameName(result.challenge.gameId),
        deepLink: generateDeepLink(result.challenge.challengeToken),
        expiresAt: result.challenge.expiresAt.toISOString(),
      },
    };
  });

  /**
   * GET /api/challenges/friend/:token
   *
   * Get challenge details by token.
   * Used when a user opens a challenge deep link.
   *
   * SECURITY: Token is validated server-side.
   */
  app.get('/challenges/friend/:token', async (request, reply) => {
    const { token } = request.params as { token: string };

    const challenge = getFriendChallengeByToken(token);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    // Track analytics if opened by a different user
    const userId = getUserId(request);
    if (userId && userId !== challenge.challengerId) {
      trackFriendChallengeOpened(userId, challenge.id, challenge.gameId);
    }

    return {
      success: true,
      data: {
        challengeId: challenge.id,
        challengeToken: challenge.challengeToken,
        gameId: challenge.gameId,
        gameName: getGameName(challenge.gameId),
        type: challenge.type,
        challengerId: challenge.challengerId,
        opponentId: challenge.opponentId,
        targetScore: challenge.targetScore,
        status: challenge.status,
        expiresAt: challenge.expiresAt.toISOString(),
        createdAt: challenge.createdAt.toISOString(),
        completedAt: challenge.completedAt?.toISOString() ?? null,
      },
    };
  });

  /**
   * POST /api/challenges/friend/:token/accept
   *
   * Accept a friend challenge (user B joins).
   *
   * SECURITY:
   * - Cannot accept own challenge
   * - Cannot accept expired challenges
   * - Same-opponent rate limiting
   */
  app.post('/challenges/friend/:token/accept', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { token } = request.params as { token: string };

    const result = acceptFriendChallenge(token, userId);
    if (!result.success || !result.challenge) {
      const statusCode = result.error?.includes('NOT_FOUND') ? 404
        : result.error?.includes('EXPIRED') ? 410
        : 400;

      return reply.status(statusCode).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        challengeId: result.challenge.id,
        challengeToken: result.challenge.challengeToken,
        gameId: result.challenge.gameId,
        gameName: getGameName(result.challenge.gameId),
        status: result.challenge.status,
        expiresAt: result.challenge.expiresAt.toISOString(),
      },
    };
  });

  /**
   * POST /api/challenges/friend/:token/score
   *
   * Submit a score for a friend challenge.
   * Either the challenger or opponent can submit their score.
   *
   * SECURITY:
   * - Only participants can submit scores
   * - Cannot submit for expired challenges
   * - Duplicate completion is prevented
   */
  app.post('/challenges/friend/:token/score', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { token } = request.params as { token: string };
    const { score, sessionId } = request.body as {
      score: number;
      sessionId: string;
    };

    if (score === undefined || !sessionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'score and sessionId are required' },
      });
    }

    const challenge = getFriendChallengeByToken(token);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    // Track start analytics
    trackFriendChallengeStarted(userId, challenge.id, challenge.gameId);

    const result = submitFriendChallengeScore(
      challenge.id,
      userId,
      score,
      sessionId,
    );

    if (!result.success || !result.challenge) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // If completed, record history and calculate XP
    if (result.completed && result.winner) {
      const isChallenger = userId === result.challenge.challengerId;
      const xp = calculateFriendChallengeXP(result.winner, isChallenger);

      // Track completion analytics
      trackFriendChallengeCompleted(
        userId,
        challenge.id,
        challenge.gameId,
        score,
        result.winner,
      );

      if (result.winner !== 'tie') {
        const isWinner = (result.winner === 'challenger' && isChallenger) ||
          (result.winner === 'opponent' && !isChallenger);

        if (isWinner) {
          trackFriendChallengeWon(userId, challenge.id, challenge.gameId, score, result.challenge.opponentScore ?? 0);
        } else {
          trackFriendChallengeLost(userId, challenge.id, challenge.gameId, score, result.challenge.opponentScore ?? 0);
        }
      }

      // Record history for both users
      const challengerResult = result.winner === 'challenger' ? 'won'
        : result.winner === 'opponent' ? 'lost' : 'tie';
      const opponentResult = result.winner === 'opponent' ? 'won'
        : result.winner === 'challenger' ? 'lost' : 'tie';

      const challengerXP = calculateFriendChallengeXP(result.winner, true);
      const opponentXP = calculateFriendChallengeXP(result.winner, false);

      recordFriendChallengeHistory(
        result.challenge.challengerId,
        result.challenge,
        challengerResult,
        challengerXP,
      );

      if (result.challenge.opponentId) {
        recordFriendChallengeHistory(
          result.challenge.opponentId,
          result.challenge,
          opponentResult,
          opponentXP,
        );
      }
    }

    return {
      success: true,
      data: {
        token,
        challengeId: challenge.id,
        status: result.challenge.status,
        challengerScore: result.challenge.challengerScore,
        opponentScore: result.challenge.opponentScore,
        winner: result.winner,
        completed: result.completed,
        completedAt: result.challenge.completedAt?.toISOString() ?? null,
      },
    };
  });

  /**
   * GET /api/challenges/friend/:token/result
   *
   * Get the result of a completed friend challenge.
   */
  app.get('/challenges/friend/:token/result', async (request, reply) => {
    const { token } = request.params as { token: string };

    const challenge = getFriendChallengeByToken(token);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    let winner: 'challenger' | 'opponent' | 'tie' | null = null;
    if (challenge.challengerScore != null && challenge.opponentScore != null) {
      if (challenge.challengerScore > challenge.opponentScore) {
        winner = 'challenger';
      } else if (challenge.opponentScore > challenge.challengerScore) {
        winner = 'opponent';
      } else {
        winner = 'tie';
      }
    }

    return {
      success: true,
      data: {
        challengeId: challenge.id,
        gameId: challenge.gameId,
        gameName: getGameName(challenge.gameId),
        type: challenge.type,
        status: challenge.status,
        challengerId: challenge.challengerId,
        opponentId: challenge.opponentId,
        challengerScore: challenge.challengerScore,
        opponentScore: challenge.opponentScore,
        winner,
        targetScore: challenge.targetScore,
        expiresAt: challenge.expiresAt.toISOString(),
        completedAt: challenge.completedAt?.toISOString() ?? null,
      },
    };
  });

  /**
   * POST /api/challenges/friend/:id/rematch
   *
   * Create a rematch (new challenge).
   * Does NOT mutate the original challenge.
   */
  app.post('/challenges/friend/:id/rematch', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: challengeId } = request.params as { id: string };

    const result = createRematch(challengeId, userId);
    if (!result.success || !result.challenge) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        challengeId: result.challenge.id,
        challengeToken: result.challenge.challengeToken,
        gameId: result.challenge.gameId,
        gameName: getGameName(result.challenge.gameId),
        deepLink: generateDeepLink(result.challenge.challengeToken),
        expiresAt: result.challenge.expiresAt.toISOString(),
      },
    };
  });

  /**
   * POST /api/challenges/friend/:id/share
   *
   * Track that a user shared a friend challenge result.
   */
  app.post('/challenges/friend/:id/share', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: challengeId } = request.params as { id: string };
    const { score } = request.body as { score: number };

    const challenge = getFriendChallengeById(challengeId);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    trackFriendChallengeShared(userId, challengeId, challenge.gameId, score);

    const userScore = userId === challenge.challengerId
      ? challenge.challengerScore
      : challenge.opponentScore;

    let result: 'won' | 'lost' | 'tie' | null = null;
    if (challenge.challengerScore != null && challenge.opponentScore != null) {
      const isChallenger = userId === challenge.challengerId;
      if (challenge.challengerScore > challenge.opponentScore) {
        result = isChallenger ? 'won' : 'lost';
      } else if (challenge.opponentScore > challenge.challengerScore) {
        result = isChallenger ? 'lost' : 'won';
      } else {
        result = 'tie';
      }
    }

    return {
      success: true,
      data: {
        shared: true,
        shareContent: generateShareContent(challenge, userScore ?? score, result),
      },
    };
  });

  /**
   * GET /api/users/me/challenges
   *
   * Get current user's challenge history.
   */
  app.get('/users/me/challenges', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { type, cursor, limit } = request.query as {
      type?: 'daily_rush' | 'friend';
      cursor?: string;
      limit?: string;
    };

    const history = getUserFriendChallengeHistory(userId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    // Also get active/pending friend challenges
    const activeChallenges = getUserFriendChallenges(userId, { limit: 10 });

    return {
      success: true,
      data: {
        history: history.entries,
        activeChallenges: activeChallenges.map((c) => ({
          id: c.id,
          gameId: c.gameId,
          gameName: getGameName(c.gameId),
          challengerId: c.challengerId,
          opponentId: c.opponentId,
          status: c.status,
          expiresAt: c.expiresAt.toISOString(),
          createdAt: c.createdAt.toISOString(),
        })),
        pagination: {
          nextCursor: history.nextCursor,
          hasMore: history.hasMore,
        },
      },
    };
  });
}
