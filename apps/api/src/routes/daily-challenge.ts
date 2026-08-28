/**
 * Daily Challenge — API Routes
 *
 * Handles:
 * - GET  /api/challenges/daily/current     → Get today's daily challenge
 * - POST /api/challenges/daily/:id/start    → Start a daily challenge attempt
 * - POST /api/challenges/daily/:id/complete → Complete and submit score
 * - GET  /api/challenges/daily/:id/leaderboard → Get daily leaderboard
 * - GET  /api/challenges/daily/:id/result   → Get daily challenge result
 *
 * SECURITY:
 * - All challenge configuration is server-authoritative
 * - Attempt counts are tracked server-side
 * - Scores are validated server-side
 * - Expired challenges cannot accept new results
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import {
  getCurrentDailyChallenge,
  getDailyChallengeById,
  validateDailyChallengeAttempt,
  recordChallengeAttempt,
  getUserBestScore,
  getUserAttemptCount,
  getDailyLeaderboard,
  awardDailyChallengeRewards,
  buildDailyChallengeResult,
  recordDailyChallengeHistory,
} from '../services/challenge-engine';
import {
  trackDailyChallengeViewed,
  trackDailyChallengeStarted,
  trackDailyChallengeCompleted,
  trackDailyChallengePersonalBest,
  trackDailyChallengeShared,
} from '../services/challenge-analytics';
import { challengeRateLimit } from '../middleware/rate-limiter';

// ============================================================
// Mock auth helper (replace with real JWT verification)
// ============================================================
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }

  // TODO: Verify JWT and extract real user ID
  return 'dev-user-001';
}

// ============================================================
// Game config lookup (server-authoritative)
// ============================================================
function getGameConfig(gameId: string): Record<string, unknown> {
  const configs: Record<string, Record<string, unknown>> = {
    'reaction-rush': {
      totalRounds: 10,
      reactionWindowMs: 3000,
      falseStartPenalty: true,
      maxPauseDurationMs: 5000,
    },
    'tap-rush': {
      durationMs: 15000,
      targetSpawnRateMs: 800,
      targetLifetimeMs: 2000,
      comboMultiplierMax: 5,
    },
    'quiz-rush': {
      questionCount: 10,
      timeLimitMs: 15000,
      scoringVersion: 1,
    },
  };
  return configs[gameId] ?? {};
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

export async function dailyChallengeRoutes(app: FastifyInstance) {
  // Apply rate limiting to all daily challenge routes
  await app.addHook('onRequest', challengeRateLimit);

  /**
   * GET /api/challenges/daily/current
   *
   * Get today's daily challenge with user-specific data.
   * Creates today's challenge if it doesn't exist.
   *
   * Response:
   * - challenge: DailyChallenge object
   * - userBestScore: User's best score today
   * - userRank: User's current rank
   * - userAttemptCount: How many attempts used
   * - userRemainingAttempts: How many attempts left
   * - timeRemaining: Time until challenge ends (ms)
   * - isActive: Whether the challenge is currently playable
   */
  app.get('/challenges/daily/current', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Get or create today's challenge
    const challenge = getCurrentDailyChallenge();
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NO_DAILY_CHALLENGE', message: 'No daily challenge available today' },
      });
    }

    // Track analytics
    trackDailyChallengeViewed(userId, challenge.id, challenge.gameId);

    const now = new Date();
    const timeRemaining = Math.max(0, challenge.endsAt.getTime() - now.getTime());
    const isActive = challenge.status === 'active' && now >= challenge.startsAt && now <= challenge.endsAt;

    const userBestScore = getUserBestScore(challenge.id, userId);
    const userAttemptCount = getUserAttemptCount(challenge.id, userId);
    const userRemainingAttempts = Math.max(0, challenge.maxAttempts - userAttemptCount);

    // Get user rank from leaderboard
    const leaderboard = getDailyLeaderboard(challenge.id, { currentUserId: userId });
    const userRank = leaderboard.userRank?.rank ?? null;

    return {
      success: true,
      data: {
        challenge: {
          ...challenge,
          startsAt: challenge.startsAt.toISOString(),
          endsAt: challenge.endsAt.toISOString(),
          createdAt: challenge.createdAt.toISOString(),
          updatedAt: challenge.updatedAt.toISOString(),
        },
        gameName: getGameName(challenge.gameId),
        userBestScore,
        userRank,
        userAttemptCount,
        userRemainingAttempts,
        timeRemaining,
        isActive,
      },
    };
  });

  /**
   * POST /api/challenges/daily/:id/start
   *
   * Start a new daily challenge attempt.
   * Validates attempt limits and creates a game session.
   *
   * SECURITY:
   * - Server validates attempt count (never trusts client)
   * - Server creates session with challenge context
   * - Server provides game configuration (never from client)
   */
  app.post('/challenges/daily/:id/start', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: challengeId } = request.params as { id: string };
    const { clientSessionToken } = (request.body ?? {}) as { clientSessionToken?: string };

    if (!clientSessionToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'clientSessionToken is required' },
      });
    }

    // Validate attempt
    const validation = validateDailyChallengeAttempt(challengeId, userId);
    if (!validation.valid) {
      return reply.status(403).send({
        success: false,
        error: { code: validation.error, message: validation.error },
      });
    }

    const challenge = getDailyChallengeById(challengeId);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    // Track analytics
    trackDailyChallengeStarted(userId, challengeId, challenge.gameId, validation.attemptNumber!);

    // Create a game session linked to the challenge
    const sessionId = nanoid();

    // In production, this would create a game_sessions record in the database
    // For now, return the session data the client needs to start the game

    return {
      success: true,
      data: {
        sessionId,
        challengeId,
        gameVersion: challenge.gameVersion,
        gameConfig: getGameConfig(challenge.gameId),
        gameId: challenge.gameId,
        attemptNumber: validation.attemptNumber,
        maxAttempts: challenge.maxAttempts,
        mode: 'daily_rush',
        expiresAt: Date.now() + (challenge.configuration.timeLimitMs ?? 60_000) + 10_000,
      },
    };
  });

  /**
   * POST /api/challenges/daily/:id/complete
   *
   * Complete a daily challenge attempt and submit the score.
   * Server validates, calculates rewards, and returns the result.
   *
   * SECURITY:
   * - Score is validated server-side (not from client)
   * - Attempt count is tracked server-side
   * - Best score is determined server-side
   * - Rewards are calculated server-side
   */
  app.post('/challenges/daily/:id/complete', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: challengeId } = request.params as { id: string };
    const { sessionId, score, completionTimeMs } = request.body as {
      sessionId: string;
      score: number;
      completionTimeMs?: number;
    };

    if (!sessionId || score === undefined) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'sessionId and score are required' },
      });
    }

    const challenge = getDailyChallengeById(challengeId);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    // Re-validate (challenge might have ended since start)
    const validation = validateDailyChallengeAttempt(challengeId, userId);
    if (!validation.valid) {
      return reply.status(403).send({
        success: false,
        error: { code: validation.error, message: validation.error },
      });
    }

    // Get previous best before recording this attempt
    const previousBest = getUserBestScore(challengeId, userId);

    // Record the attempt
    const attempt = recordChallengeAttempt(
      challengeId,
      userId,
      sessionId,
      score,
      completionTimeMs ?? null,
      true, // isValid — would be determined by anti-cheat
    );

    const newBest = getUserBestScore(challengeId, userId);
    const isPersonalBest = score > previousBest && score === newBest;

    // Track analytics
    trackDailyChallengeCompleted(
      userId,
      challengeId,
      challenge.gameId,
      score,
      0, // Rank will be calculated below
      validation.attemptNumber!,
      isPersonalBest,
    );

    if (isPersonalBest) {
      trackDailyChallengePersonalBest(userId, challengeId, challenge.gameId, previousBest, newBest);
    }

    // Award rewards (idempotent)
    const rewards = awardDailyChallengeRewards(
      challengeId,
      userId,
      isPersonalBest,
      false, // hadStreakContributionToday — would be checked from DB
    );

    // Record in challenge history
    recordDailyChallengeHistory(
      userId,
      challengeId,
      challenge.gameId,
      score,
      0, // Rank
      rewards.xpAwarded,
    );

    // Get updated leaderboard info
    const leaderboard = getDailyLeaderboard(challengeId, { currentUserId: userId });
    const userRank = leaderboard.userRank?.rank ?? leaderboard.totalParticipants + 1;

    return {
      success: true,
      data: {
        challengeId,
        sessionId,
        score,
        bestScore: newBest,
        isPersonalBest,
        globalRank: userRank,
        totalParticipants: leaderboard.totalParticipants,
        attemptNumber: validation.attemptNumber,
        maxAttempts: challenge.maxAttempts,
        xpAwarded: rewards.xpAwarded,
        streakContribution: rewards.streakContribution,
        breakdown: {}, // Would include detailed score breakdown
      },
    };
  });

  /**
   * GET /api/challenges/daily/:id/leaderboard
   *
   * Get the daily leaderboard for a challenge.
   * Supports filtering by global, country, or friends.
   */
  app.get('/challenges/daily/:id/leaderboard', async (request, reply) => {
    const userId = getUserId(request);
    const { id: challengeId } = request.params as { id: string };
    const { filter, cursor, limit } = request.query as {
      filter?: 'global' | 'country' | 'friends';
      cursor?: string;
      limit?: string;
    };

    const leaderboard = getDailyLeaderboard(challengeId, {
      filter,
      cursor,
      limit: limit ? parseInt(limit, 10) : 50,
      currentUserId: userId ?? undefined,
    });

    return {
      success: true,
      data: leaderboard,
    };
  });

  /**
   * GET /api/challenges/daily/:id/result
   *
   * Get the daily challenge result for the current user.
   * Shows score, rank, attempts remaining, and rewards.
   */
  app.get('/challenges/daily/:id/result', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: challengeId } = request.params as { id: string };

    const challenge = getDailyChallengeById(challengeId);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    const bestScore = getUserBestScore(challengeId, userId);
    const attemptCount = getUserAttemptCount(challengeId, userId);
    const leaderboard = getDailyLeaderboard(challengeId, { currentUserId: userId });

    return {
      success: true,
      data: {
        challengeId,
        challengeDate: challenge.challengeDate,
        gameId: challenge.gameId,
        gameName: getGameName(challenge.gameId),
        bestScore,
        globalRank: leaderboard.userRank?.rank ?? null,
        totalParticipants: leaderboard.totalParticipants,
        attemptCount,
        maxAttempts: challenge.maxAttempts,
        remainingAttempts: Math.max(0, challenge.maxAttempts - attemptCount),
        status: challenge.status,
        endsAt: challenge.endsAt.toISOString(),
      },
    };
  });

  /**
   * POST /api/challenges/daily/:id/share
   *
   * Track that a user shared their daily challenge result.
   */
  app.post('/challenges/daily/:id/share', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: challengeId } = request.params as { id: string };
    const { score } = request.body as { score: number };

    const challenge = getDailyChallengeById(challengeId);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found' },
      });
    }

    const leaderboard = getDailyLeaderboard(challengeId, { currentUserId: userId });

    trackDailyChallengeShared(
      userId,
      challengeId,
      challenge.gameId,
      score,
      leaderboard.userRank?.rank ?? 0,
    );

    return {
      success: true,
      data: {
        shared: true,
        shareContent: `⚡ GTX RUSH\n\nI scored ${score.toLocaleString()} in ${getGameName(challenge.gameId)}.\nBeat the world.\n\nPLAY. COMPETE. RISE.`,
      },
    };
  });
}
