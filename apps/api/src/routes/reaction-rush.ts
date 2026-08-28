/**
 * Reaction Rush — API Routes
 *
 * Handles:
 * - Session creation (POST /api/games/reaction-rush/session)
 * - Score submission (POST /api/games/reaction-rush/session/:sessionId/complete)
 * - Game stats (GET /api/games/reaction-rush/stats)
 * - Game leaderboard (GET /api/games/reaction-rush/leaderboard)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { REACTION_RUSH_CONFIG, REACTION_RUSH_VERSION } from '@gtx-rush/game-reaction-rush';
import { calculateServerScore, validateInputSequence } from '@gtx-rush/game-reaction-rush';
import type { GameInput } from '@gtx-rush/types';

// ── In-memory stores (replace with DB in production) ──────────────────

interface SessionRecord {
  id: string;
  userId: string;
  gameId: 'reaction-rush';
  gameVersion: string;
  status: 'active' | 'completed' | 'expired' | 'disqualified';
  startedAt: number;
  completedAt: number | null;
  clientSessionToken: string;
}

interface ScoreRecord {
  id: string;
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  breakdown: Record<string, unknown>;
  metadata: Record<string, unknown>;
  antiCheatFlags: string[];
  verdict: 'valid' | 'suspicious' | 'rejected';
  isPersonalBest: boolean;
  createdAt: number;
}

interface UserStats {
  userId: string;
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  averageReactionTime: number;
  totalFalseStarts: number;
  averageAccuracy: number;
}

const sessions = new Map<string, SessionRecord>();
const scores = new Map<string, ScoreRecord>();
const userStats = new Map<string, UserStats>();

// ── Helper: get or create user stats ──────────────────────────────────
function getOrCreateUserStats(userId: string): UserStats {
  if (!userStats.has(userId)) {
    userStats.set(userId, {
      userId,
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageReactionTime: 0,
      totalFalseStarts: 0,
      averageAccuracy: 0,
    });
  }
  return userStats.get(userId)!;
}

// ── Mock auth middleware (replace with real auth) ──────────────────────
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  // In dev mode, accept any token and use a mock user
  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }

  // TODO: Verify JWT and extract real user ID
  return 'dev-user-001';
}

// ── Routes ────────────────────────────────────────────────────────────

export async function reactionRushRoutes(app: FastifyInstance) {
  /**
   * POST /api/games/reaction-rush/session
   * Create a new game session.
   */
  app.post('/games/reaction-rush/session', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { clientSessionToken, mode, challengeId, opponentUserId, targetScore } = request.body as {
      clientSessionToken?: string;
      mode?: string;
      challengeId?: string;
      opponentUserId?: string;
      targetScore?: number;
    };

    if (!clientSessionToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'clientSessionToken is required' },
      });
    }

    // Check for active sessions (rate limiting)
    const activeSessions = Array.from(sessions.values()).filter(
      (s) => s.userId === userId && s.status === 'active'
    );
    if (activeSessions.length >= 2) {
      return reply.status(429).send({
        success: false,
        error: { code: 'TOO_MANY_SESSIONS', message: 'You have too many active sessions' },
      });
    }

    const sessionId = nanoid();
    const now = Date.now();

    const session: SessionRecord = {
      id: sessionId,
      userId,
      gameId: 'reaction-rush',
      gameVersion: REACTION_RUSH_VERSION,
      status: 'active',
      startedAt: now,
      completedAt: null,
      clientSessionToken,
    };

    sessions.set(sessionId, session);

    return {
      success: true,
      data: {
        sessionId,
        gameVersion: REACTION_RUSH_VERSION,
        config: REACTION_RUSH_CONFIG,
        mode: mode ?? 'normal',
        challengeId: challengeId ?? null,
        opponentUserId: opponentUserId ?? null,
        targetScore: targetScore ?? null,
        expiresAt: now + REACTION_RUSH_CONFIG.maxPauseDurationMs,
      },
    };
  });

  /**
   * POST /api/games/reaction-rush/session/:sessionId/complete
   * Submit game results and calculate score server-side.
   */
  app.post('/games/reaction-rush/session/:sessionId/complete', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { sessionId } = request.params as { sessionId: string };
    const { events, durationMs } = request.body as {
      events: Array<{
        type: string;
        timestamp: number;
        roundNumber: number;
        data?: Record<string, unknown>;
      }>;
      durationMs: number;
    };

    // 1. Validate session exists
    const session = sessions.get(sessionId);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    // 2. Validate session belongs to user
    if (session.userId !== userId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Session does not belong to you' },
      });
    }

    // 3. Validate session is active
    if (session.status !== 'active') {
      return reply.status(409).send({
        success: false,
        error: { code: 'SESSION_NOT_ACTIVE', message: 'Session is not active' },
      });
    }

    // 4. Validate session not expired
    const elapsed = Date.now() - session.startedAt;
    if (elapsed > REACTION_RUSH_CONFIG.maxPauseDurationMs * 2) {
      session.status = 'expired';
      return reply.status(410).send({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
      });
    }

    // 5. Validate input sequence
    const inputs: GameInput[] = events.map((e, i) => ({
      sequence: i,
      timestamp: e.timestamp,
      type: e.type,
      data: e.data ?? { roundNumber: e.roundNumber },
    }));

    const validation = validateInputSequence(inputs, REACTION_RUSH_CONFIG.totalRounds);
    if (!validation.valid) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_INPUTS', message: validation.error },
      });
    }

    // 6. Calculate score server-side
    const result = calculateServerScore(inputs, durationMs);

    // 7. Anti-cheat verdict (simplified for MVP)
    const antiCheatFlags: string[] = [];
    if (result.bestReactionTime < REACTION_RUSH_CONFIG.minReactionTimeMs) {
      antiCheatFlags.push('REACTION_TOO_FAST');
    }
    if (result.falseStarts > REACTION_RUSH_CONFIG.totalRounds * 0.8) {
      antiCheatFlags.push('EXCESSIVE_FALSE_STARTS');
    }

    const verdict = antiCheatFlags.some((f) => ['REACTION_TOO_FAST'].includes(f))
      ? 'rejected' as const
      : antiCheatFlags.length > 0
        ? 'suspicious' as const
        : 'valid' as const;

    // 8. Mark session as completed
    session.status = verdict === 'rejected' ? 'disqualified' : 'completed';
    session.completedAt = Date.now();

    // 9. Check personal best
    const existingScores = Array.from(scores.values()).filter(
      (s) => s.userId === userId && s.gameId === 'reaction-rush' && s.verdict === 'valid'
    );
    const previousBest = existingScores.reduce((max, s) => Math.max(max, s.score), 0);
    const isPersonalBest = verdict === 'valid' && result.score > previousBest;

    // 10. Store score
    const scoreId = nanoid();
    const scoreRecord: ScoreRecord = {
      id: scoreId,
      sessionId,
      userId,
      gameId: 'reaction-rush',
      score: result.score,
      breakdown: result.breakdown as unknown as Record<string, unknown>,
      metadata: result.metadata as unknown as Record<string, unknown>,
      antiCheatFlags,
      verdict,
      isPersonalBest,
      createdAt: Date.now(),
    };
    scores.set(scoreId, scoreRecord);

    // 11. Update user stats
    const stats = getOrCreateUserStats(userId);
    stats.gamesPlayed++;
    if (verdict === 'valid') {
      stats.totalScore += result.score;
      stats.bestScore = Math.max(stats.bestScore, result.score);
      stats.averageReactionTime = stats.gamesPlayed > 0
        ? (stats.averageReactionTime * (stats.gamesPlayed - 1) + result.averageReactionTime) / stats.gamesPlayed
        : result.averageReactionTime;
      stats.totalFalseStarts += result.falseStarts;
      stats.averageAccuracy = stats.gamesPlayed > 0
        ? (stats.averageAccuracy * (stats.gamesPlayed - 1) + result.accuracy) / stats.gamesPlayed
        : result.accuracy;
    }

    // 12. Calculate XP
    const xpBase = verdict === 'valid' ? 10 : 0;
    const xpBonus = isPersonalBest ? 15 : 0;
    const xpAccuracy = result.accuracy >= 80 ? 5 : 0;
    const xpAwarded = xpBase + xpBonus + xpAccuracy;

    // 13. Calculate approximate global rank
    const allScores = Array.from(scores.values())
      .filter((s) => s.gameId === 'reaction-rush' && s.verdict === 'valid')
      .sort((a, b) => b.score - a.score);
    const rank = allScores.findIndex((s) => s.sessionId === sessionId) + 1 || allScores.length + 1;

    return {
      success: true,
      data: {
        sessionId,
        score: result.score,
        personalBest: previousBest,
        isPersonalBest,
        globalRank: rank,
        xpAwarded,
        breakdown: result.breakdown,
        metadata: result.metadata,
        antiCheatFlags,
        verdict,
      },
    };
  });

  /**
   * GET /api/games/reaction-rush/stats
   * Get user's Reaction Rush statistics.
   */
  app.get('/games/reaction-rush/stats', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const stats = getOrCreateUserStats(userId);
    const recentScores = Array.from(scores.values())
      .filter((s) => s.userId === userId && s.gameId === 'reaction-rush')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    return {
      success: true,
      data: {
        gamesPlayed: stats.gamesPlayed,
        totalScore: stats.totalScore,
        bestScore: stats.bestScore,
        averageReactionTime: Math.round(stats.averageReactionTime),
        totalFalseStarts: stats.totalFalseStarts,
        averageAccuracy: Math.round(stats.averageAccuracy),
        recentScores: recentScores.map((s) => ({
          score: s.score,
          isPersonalBest: s.isPersonalBest,
          createdAt: s.createdAt,
        })),
      },
    };
  });

  /**
   * GET /api/games/reaction-rush/leaderboard
   * Get game-specific leaderboard.
   */
  app.get('/games/reaction-rush/leaderboard', async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query as {
      limit?: number;
      offset?: number;
    };

    const allScores = Array.from(scores.values())
      .filter((s) => s.gameId === 'reaction-rush' && s.verdict === 'valid')
      .sort((a, b) => b.score - a.score);

    const entries = allScores.slice(offset, offset + limit).map((s, i) => ({
      rank: offset + i + 1,
      userId: s.userId,
      score: s.score,
      createdAt: s.createdAt,
    }));

    return {
      success: true,
      data: {
        entries,
        total: allScores.length,
        limit,
        offset,
      },
    };
  });
}
