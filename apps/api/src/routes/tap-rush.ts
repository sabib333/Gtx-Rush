/**
 * Tap Rush — API Routes
 *
 * Handles:
 * - Session creation (POST /api/games/tap-rush/session)
 * - Score submission (POST /api/games/tap-rush/session/:sessionId/complete)
 * - Game stats (GET /api/games/tap-rush/stats)
 * - Game leaderboard (GET /api/games/tap-rush/leaderboard)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { TAP_RUSH_CONFIG, TAP_RUSH_VERSION } from '@gtx-rush/game-tap-rush';
import { calculateServerScore, validateInputSequence } from '@gtx-rush/game-tap-rush';
import type { GameInput } from '@gtx-rush/types';

// ── In-memory stores (replace with DB in production) ─────────────────

interface SessionRecord {
  id: string;
  userId: string;
  gameId: 'tap-rush';
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
  averageAccuracy: number;
  bestCombo: number;
  averageTapsPerSecond: number;
  totalValidTaps: number;
  totalInvalidTaps: number;
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
      averageAccuracy: 0,
      bestCombo: 0,
      averageTapsPerSecond: 0,
      totalValidTaps: 0,
      totalInvalidTaps: 0,
    });
  }
  return userStats.get(userId)!;
}

// ── Mock auth middleware (replace with real auth) ──────────────────────
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

// ── Routes ────────────────────────────────────────────────────────────

export async function tapRushRoutes(app: FastifyInstance) {
  /**
   * POST /api/games/tap-rush/session
   * Create a new game session.
   */
  app.post('/games/tap-rush/session', async (request, reply) => {
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
      gameId: 'tap-rush',
      gameVersion: TAP_RUSH_VERSION,
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
        gameVersion: TAP_RUSH_VERSION,
        config: TAP_RUSH_CONFIG,
        mode: mode ?? 'normal',
        challengeId: challengeId ?? null,
        opponentUserId: opponentUserId ?? null,
        targetScore: targetScore ?? null,
        expiresAt: now + TAP_RUSH_CONFIG.durationMs + 10_000,
      },
    };
  });

  /**
   * POST /api/games/tap-rush/session/:sessionId/complete
   * Submit game results and calculate score server-side.
   */
  app.post('/games/tap-rush/session/:sessionId/complete', async (request, reply) => {
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
        targetId?: string;
        targetType?: string;
        targetX?: number;
        targetY?: number;
        tapX?: number;
        tapY?: number;
        combo?: number;
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
    if (elapsed > (TAP_RUSH_CONFIG.durationMs + 10_000) * 2) {
      session.status = 'expired';
      return reply.status(410).send({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
      });
    }

    // 5. Convert events to GameInput format
    const inputs: GameInput[] = events.map((e, i) => ({
      sequence: i,
      timestamp: e.timestamp,
      type: e.type,
      data: {
        targetId: e.targetId,
        targetType: e.targetType,
        targetX: e.targetX,
        targetY: e.targetY,
        tapX: e.tapX,
        tapY: e.tapY,
        combo: e.combo,
        ...e.data,
      },
    }));

    // 6. Validate input sequence structure
    const validation = validateInputSequence(inputs, durationMs);
    if (!validation.valid) {
      return reply.status(422).send({
        success: false,
        error: { code: 'INVALID_INPUTS', message: validation.error },
      });
    }

    // 7. Calculate score server-side
    const result = calculateServerScore(inputs, durationMs);

    // 8. Anti-cheat — run basic checks
    const antiCheatFlags: string[] = [];

    // Check tap rate
    const tapInputs = inputs.filter(
      (i) => i.type === 'target_hit' || i.type === 'invalid_tap'
    );
    if (tapInputs.length > 1) {
      const timeSpan =
        tapInputs[tapInputs.length - 1]!.timestamp - tapInputs[0]!.timestamp;
      if (timeSpan > 0) {
        const rate = tapInputs.length / (timeSpan / 1000);
        if (rate > TAP_RUSH_CONFIG.maxTapRatePerSecond) {
          antiCheatFlags.push('TAP_RATE_EXCEEDED');
        }
      }
    }

    // Check impossible score
    const maxPossibleScore = TAP_RUSH_CONFIG.durationMs / 1000 * 20 * TAP_RUSH_CONFIG.normalTargetPoints * TAP_RUSH_CONFIG.comboMultiplierMax;
    if (result.score > maxPossibleScore) {
      antiCheatFlags.push('IMPOSSIBLE_SCORE');
    }

    // Check impossible taps
    const validTaps = (result.metadata as Record<string, unknown>).validTaps as number;
    const maxPossibleTaps = TAP_RUSH_CONFIG.durationMs / 1000 * TAP_RUSH_CONFIG.maxTapRatePerSecond;
    if (validTaps > maxPossibleTaps) {
      antiCheatFlags.push('IMPOSSIBLE_TAPS');
    }

    const verdict = antiCheatFlags.some((f) =>
      ['IMPOSSIBLE_SCORE', 'IMPOSSIBLE_TAPS'].includes(f)
    )
      ? ('rejected' as const)
      : antiCheatFlags.length > 0
        ? ('suspicious' as const)
        : ('valid' as const);

    // 9. Mark session as completed
    session.status = verdict === 'rejected' ? 'disqualified' : 'completed';
    session.completedAt = Date.now();

    // 10. Check personal best
    const existingScores = Array.from(scores.values()).filter(
      (s) => s.userId === userId && s.gameId === 'tap-rush' && s.verdict === 'valid'
    );
    const previousBest = existingScores.reduce((max, s) => Math.max(max, s.score), 0);
    const isPersonalBest = verdict === 'valid' && result.score > previousBest;

    // 11. Store score
    const scoreId = nanoid();
    const scoreRecord: ScoreRecord = {
      id: scoreId,
      sessionId,
      userId,
      gameId: 'tap-rush',
      score: result.score,
      breakdown: result.breakdown as unknown as Record<string, unknown>,
      metadata: result.metadata as unknown as Record<string, unknown>,
      antiCheatFlags,
      verdict,
      isPersonalBest,
      createdAt: Date.now(),
    };
    scores.set(scoreId, scoreRecord);

    // 12. Update user stats
    const stats = getOrCreateUserStats(userId);
    stats.gamesPlayed++;
    if (verdict === 'valid') {
      stats.totalScore += result.score;
      stats.bestScore = Math.max(stats.bestScore, result.score);
      const accuracy = (result.metadata as Record<string, unknown>).accuracy as number;
      stats.averageAccuracy =
        stats.gamesPlayed > 0
          ? (stats.averageAccuracy * (stats.gamesPlayed - 1) + accuracy) / stats.gamesPlayed
          : accuracy;
      const highestCombo = (result.metadata as Record<string, unknown>).highestCombo as number;
      stats.bestCombo = Math.max(stats.bestCombo, highestCombo);
      const tapsPerSecond = (result.metadata as Record<string, unknown>).tapsPerSecond as number;
      stats.averageTapsPerSecond =
        stats.gamesPlayed > 0
          ? (stats.averageTapsPerSecond * (stats.gamesPlayed - 1) + tapsPerSecond) /
            stats.gamesPlayed
          : tapsPerSecond;
      stats.totalValidTaps += validTaps;
      stats.totalInvalidTaps += (result.metadata as Record<string, unknown>).invalidTaps as number;
    }

    // 13. Calculate XP
    const xpBase = verdict === 'valid' ? 10 : 0;
    const xpBonus = isPersonalBest ? 15 : 0;
    const accuracy = (result.metadata as Record<string, unknown>).accuracy as number;
    const xpAccuracy = accuracy >= 80 ? 5 : 0;
    const xpAwarded = xpBase + xpBonus + xpAccuracy;

    // 14. Calculate approximate global rank
    const allScores = Array.from(scores.values())
      .filter((s) => s.gameId === 'tap-rush' && s.verdict === 'valid')
      .sort((a, b) => b.score - a.score);
    const rank =
      allScores.findIndex((s) => s.sessionId === sessionId) + 1 || allScores.length + 1;

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
   * GET /api/games/tap-rush/stats
   * Get user's Tap Rush statistics.
   */
  app.get('/games/tap-rush/stats', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const stats = getOrCreateUserStats(userId);
    const recentScores = Array.from(scores.values())
      .filter((s) => s.userId === userId && s.gameId === 'tap-rush')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    return {
      success: true,
      data: {
        gamesPlayed: stats.gamesPlayed,
        totalScore: stats.totalScore,
        bestScore: stats.bestScore,
        averageAccuracy: Math.round(stats.averageAccuracy),
        bestCombo: stats.bestCombo,
        averageTapsPerSecond: Math.round(stats.averageTapsPerSecond * 10) / 10,
        totalValidTaps: stats.totalValidTaps,
        totalInvalidTaps: stats.totalInvalidTaps,
        recentScores: recentScores.map((s) => ({
          score: s.score,
          isPersonalBest: s.isPersonalBest,
          createdAt: s.createdAt,
        })),
      },
    };
  });

  /**
   * GET /api/games/tap-rush/leaderboard
   * Get game-specific leaderboard.
   */
  app.get('/games/tap-rush/leaderboard', async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query as {
      limit?: number;
      offset?: number;
    };

    const allScores = Array.from(scores.values())
      .filter((s) => s.gameId === 'tap-rush' && s.verdict === 'valid')
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
