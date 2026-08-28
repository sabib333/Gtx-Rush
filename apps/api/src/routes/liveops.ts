/**
 * GTX Rush — LiveOps Player Routes v1.0
 *
 * Player-facing routes for the LiveOps system:
 * - Home feed (LIVE NOW, UPCOMING, missions, battle pass)
 * - Season info and progression
 * - Battle pass view and purchase
 * - Mission listing, progress, claim, reroll
 * - Event listing and joining
 * - Daily login rewards
 * - Community goals
 * - Notifications
 *
 * SECURITY:
 * - All user-specific data is authenticated
 * - Server-authoritative responses
 * - No client-provided progress or scores
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getActiveSeason,
  getLiveOpsHome,
  processDailyLogin,
  claimDailyLoginReward,
  generateMissionsForUser,
  getUserMissionsByCategory,
  processMissionProgressEvent,
  claimMissionReward,
  rerollMission,
  getUserNotifications,
  createLiveOpsNotification,
  getActiveCommunityGoals,
  addAuditEntry,
} from '../services/liveops-engine';
import {
  getBattlePassProgress,
  claimBattlePassReward,
  purchaseBattlePass,
  ownsPremiumPass,
} from '../services/battle-pass-engine';
import {
  getOrCreateProgression,
  awardSeasonXp,
  getLevelDetails,
} from '../services/season-progression-engine';
import {
  getActiveEvents,
  getEvent,
  joinEvent,
} from '../services/event-engine';
import { DEFAULT_BATTLE_PASS_CONFIG } from '@gtx-rush/config';

export async function liveOpsRoutes(app: FastifyInstance) {
  // ============================================================
  // LiveOps Home Feed
  // ============================================================

  /**
   * GET /api/v1/liveops/home
   * Get the LiveOps home feed: LIVE NOW, missions, battle pass, season
   */
  app.get('/liveops/home', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Get user's season XP (would come from database in production)
    const activeSeason = getActiveSeason();
    const seasonXp = 0; // Would fetch from user's season progression
    const userLevel = 1; // Would fetch from user profile

    const home = getLiveOpsHome({ userId, userLevel, seasonXp });

    return { success: true, data: home };
  });

  // ============================================================
  // Season Routes
  // ============================================================

  /**
   * GET /api/v1/liveops/season
   * Get current active season
   */
  app.get('/liveops/season', async () => {
    const season = getActiveSeason();
    return { success: true, data: season };
  });

  /**
   * GET /api/v1/liveops/season/progression
   * Get user's season progression
   */
  app.get('/liveops/season/progression', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const activeSeason = getActiveSeason();
    if (!activeSeason) {
      return { success: true, data: null };
    }

    const progression = getOrCreateProgression(userId, activeSeason.id);
    const levelDetails = getLevelDetails(progression.seasonXp);

    return {
      success: true,
      data: {
        seasonId: activeSeason.id,
        seasonName: activeSeason.name,
        theme: activeSeason.theme,
        ...levelDetails,
        totalXpEarned: progression.totalXpEarned,
      },
    };
  });

  // ============================================================
  // Battle Pass Routes
  // ============================================================

  /**
   * GET /api/v1/liveops/battle-pass
   * Get battle pass progress for current season
   */
  app.get('/liveops/battle-pass', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const activeSeason = getActiveSeason();
    if (!activeSeason) {
      return { success: true, data: null };
    }

    const progression = getOrCreateProgression(userId, activeSeason.id);
    const progress = getBattlePassProgress({
      userId,
      seasonId: activeSeason.id,
      seasonXp: progression.seasonXp,
    });

    return { success: true, data: progress };
  });

  /**
   * POST /api/v1/liveops/battle-pass/purchase
   * Purchase the premium battle pass
   */
  app.post('/liveops/battle-pass/purchase', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const activeSeason = getActiveSeason();
    if (!activeSeason) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_ACTIVE_SEASON', message: 'No active season' },
      });
    }

    if (!DEFAULT_BATTLE_PASS_CONFIG.premiumEnabled) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PREMIUM_DISABLED', message: 'Premium pass is not currently available' },
      });
    }

    // Check if already purchased
    if (ownsPremiumPass(userId, activeSeason.id)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ALREADY_PURCHASED', message: 'You already own the premium pass' },
      });
    }

    // In production, this would:
    // 1. Create a Telegram Stars payment request
    // 2. Wait for webhook confirmation
    // 3. Verify payment server-side
    // 4. Activate the pass

    return {
      success: true,
      data: {
        message: 'Payment flow initiated',
        requiresPayment: true,
        // Would include Telegram payment link/data
      },
    };
  });

  /**
   * POST /api/v1/liveops/battle-pass/claim/:level
   * Claim a battle pass reward for a specific level
   */
  app.post('/liveops/battle-pass/claim/:level', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { level } = request.params as { level: string };
    const { track } = request.body as { track?: string };

    const activeSeason = getActiveSeason();
    if (!activeSeason) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_ACTIVE_SEASON', message: 'No active season' },
      });
    }

    const levelNum = parseInt(level);
    if (isNaN(levelNum) || levelNum < 1) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_LEVEL', message: 'Invalid level number' },
      });
    }

    const result = claimBattlePassReward({
      userId,
      seasonId: activeSeason.id,
      level: levelNum,
      track: (track as 'free' | 'premium') ?? 'free',
    });

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        reward: result.reward,
        transactionId: result.transactionId,
      },
    };
  });

  // ============================================================
  // Mission Routes
  // ============================================================

  /**
   * GET /api/v1/liveops/missions
   * Get user's missions grouped by category
   */
  app.get('/liveops/missions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { category } = request.query as { category?: string };

    if (category) {
      const missions = getUserMissionsByCategory(userId, category as any);
      return { success: true, data: { category, missions } };
    }

    // Get all categories
    const daily = getUserMissionsByCategory(userId, 'daily');
    const weekly = getUserMissionsByCategory(userId, 'weekly');
    const seasonal = getUserMissionsByCategory(userId, 'seasonal');

    return {
      success: true,
      data: {
        daily: { missions: daily, completedCount: daily.filter((m) => m.status === 'completed').length, totalCount: daily.length },
        weekly: { missions: weekly, completedCount: weekly.filter((m) => m.status === 'completed').length, totalCount: weekly.length },
        seasonal: { missions: seasonal, completedCount: seasonal.filter((m) => m.status === 'completed').length, totalCount: seasonal.length },
      },
    };
  });

  /**
   * POST /api/v1/liveops/missions/generate
   * Generate new missions for the user
   */
  app.post('/liveops/missions/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { category } = request.body as { category?: string };
    const userLevel = 1; // Would fetch from profile

    const missions = generateMissionsForUser(
      userId,
      (category as 'daily' | 'weekly' | 'seasonal') ?? 'daily',
      userLevel,
    );

    return { success: true, data: { missions, count: missions.length } };
  });

  /**
   * POST /api/v1/liveops/missions/:id/claim
   * Claim a mission reward
   */
  app.post('/liveops/missions/:id/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = request.params as { id: string };
    const result = claimMissionReward(userId, id);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return { success: true, data: { reward: result.reward } };
  });

  /**
   * POST /api/v1/liveops/missions/:id/reroll
   * Reroll a mission
   */
  app.post('/liveops/missions/:id/reroll', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = request.params as { id: string };
    const result = rerollMission(userId, id);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        previousMissionId: result.previousMissionId,
        newMissionId: result.newMissionId,
        remainingRerolls: result.remainingRerolls,
      },
    };
  });

  // ============================================================
  // Event Routes
  // ============================================================

  /**
   * GET /api/v1/liveops/events
   * Get all events: live, upcoming, completed
   */
  app.get('/liveops/events', async () => {
    const events = getActiveEvents();
    return {
      success: true,
      data: events.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        type: e.type,
        status: e.status,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        timeRemaining: e.endsAt.getTime() - Date.now(),
        totalParticipants: 0, // Would query participant count
      })),
    };
  });

  /**
   * GET /api/v1/liveops/events/:id
   * Get event details
   */
  app.get('/liveops/events/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const event = getEvent(id);

    if (!event) {
      return reply.status(404).send({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    return { success: true, data: event };
  });

  /**
   * POST /api/v1/liveops/events/:id/join
   * Join an event
   */
  app.post('/liveops/events/:id/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id } = request.params as { id: string };
    const result = joinEvent(id, userId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return { success: true, data: { participant: result.participant } };
  });

  // ============================================================
  // Daily Login Routes
  // ============================================================

  /**
   * GET /api/v1/liveops/daily-login
   * Get daily login status and rewards
   */
  app.get('/liveops/daily-login', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const result = processDailyLogin(userId, today);

    return {
      success: true,
      data: {
        day: result.day,
        reward: result.reward,
        isStreakBonus: result.isStreakBonus,
        claimed: result.claimed,
      },
    };
  });

  /**
   * POST /api/v1/liveops/daily-login/claim
   * Claim daily login reward
   */
  app.post('/liveops/daily-login/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const result = claimDailyLoginReward(userId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return { success: true, data: { reward: result.reward } };
  });

  // ============================================================
  // Community Goals
  // ============================================================

  /**
   * GET /api/v1/liveops/community-goals
   * Get active community goals
   */
  app.get('/liveops/community-goals', async () => {
    const goals = getActiveCommunityGoals();
    return { success: true, data: goals };
  });

  // ============================================================
  // Notifications
  // ============================================================

  /**
   * GET /api/v1/liveops/notifications
   * Get user's LiveOps notifications
   */
  app.get('/liveops/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const notifs = getUserNotifications(userId);
    return {
      success: true,
      data: {
        notifications: notifs,
        unreadCount: notifs.filter((n) => !n.read).length,
      },
    };
  });

  // ============================================================
  // Season End Warning
  // ============================================================

  /**
   * GET /api/v1/liveops/season/warning
   * Get season end warning if applicable
   */
  app.get('/liveops/season/warning', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const season = getActiveSeason();
    if (!season) {
      return { success: true, data: null };
    }

    const timeUntilEnd = season.endTime.getTime() - Date.now();
    const hoursUntilEnd = timeUntilEnd / (1000 * 60 * 60);

    // Check if we should show a warning
    const warningHours = [168, 72, 48, 24, 12, 6, 1];
    const shouldWarn = warningHours.some((h) => hoursUntilEnd <= h && hoursUntilEnd > 0);

    if (!shouldWarn) {
      return { success: true, data: null };
    }

    const progression = getOrCreateProgression(userId, season.id);
    const levelDetails = getLevelDetails(progression.seasonXp);

    return {
      success: true,
      data: {
        seasonName: season.name,
        theme: season.theme,
        timeRemaining: timeUntilEnd,
        hoursRemaining: Math.round(hoursUntilEnd),
        currentLevel: levelDetails.currentLevel,
        xpToNextLevel: levelDetails.xpToNextLevel,
        message: `⏳ SEASON ENDS IN ${hoursUntilEnd < 24 ? `${Math.round(hoursUntilEnd)}H` : `${Math.round(hoursUntilEnd / 24)}D`}`,
      },
    };
  });
}
