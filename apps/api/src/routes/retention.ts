/**
 * Retention Engine — API Routes v1.0
 *
 * Handles:
 * - GET  /api/retention/home          → Retention home data
 * - GET  /api/missions/daily          → Get daily missions
 * - GET  /api/missions/weekly         → Get weekly missions
 * - GET  /api/missions/progress       → Get mission progress
 * - POST /api/missions/:id/claim      → Claim mission reward
 * - GET  /api/streak                  → Get streak info
 * - GET  /api/rewards                 → Get reward inventory
 * - GET  /api/rewards/history         → Get reward history
 *
 * SECURITY:
 * - All progress updates are server-authoritative
 * - Reward claiming is idempotent
 * - Mission generation is server-controlled
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  generateDailyMissions,
  generateWeeklyMissions,
  getUserDailyMissions,
  getUserWeeklyMissions,
  getMissionProgress,
  claimMissionReward,
  initializeMissionDefinitions,
} from '../services/mission-engine';
import {
  getStreakResponse,
  recordStreakActivity,
} from '../services/streak-engine';
import {
  getUserInventory,
  getRewardHistory,
  grantReward,
  initializeRewardItems,
} from '../services/reward-inventory';
import {
  trackRetentionHomeViewed,
  trackMissionViewed,
  trackMissionClaimed,
  trackStreakExtended,
  trackStreakMilestone,
  trackRewardClaimed,
} from '../services/retention-analytics';
import { awardXP, getXPToNextLevel } from '../services/level-service';
import { generalRateLimit } from '../middleware/rate-limiter';

// ============================================================
// Initialization
// ============================================================

// Initialize mission definitions and reward items on module load
initializeMissionDefinitions();
initializeRewardItems();

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
// Routes
// ============================================================

export async function retentionRoutes(app: FastifyInstance) {
  // Apply rate limiting to all retention routes
  await app.addHook('onRequest', generalRateLimit);

  /**
   * GET /api/retention/home
   *
   * Get the retention home data for the current user.
   * Returns daily rush, streak, missions, level, and rank info.
   */
  app.get('/retention/home', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    // Get streak data
    const streak = getStreakResponse(userId);

    // Get daily missions (generate if needed)
    const dailyMissions = getUserDailyMissions(userId);
    const weeklyMissions = getUserWeeklyMissions(userId);

    // Calculate level info
    const xpTotal = 0; // Would be fetched from user record
    const levelInfo = getXPToNextLevel(xpTotal);

    // Track analytics
    trackRetentionHomeViewed(
      userId,
      streak.currentStreak,
      dailyMissions.filter((m) => m.status === 'completed' || m.status === 'claimed').length,
      levelInfo.currentLevel,
    );

    return {
      success: true,
      data: {
        streak: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          status: streak.status,
          lastActiveDate: streak.lastActiveDate,
          daysUntilNextMilestone: streak.daysUntilNextMilestone,
          nextMilestone: streak.nextMilestone,
          weekActivity: streak.weekActivity,
          todayCompleted: streak.todayCompleted,
        },
        dailyMissions: {
          missions: dailyMissions.map((m) => ({
            id: m.id,
            missionId: m.missionId,
            name: m.mission.name,
            description: m.mission.description,
            type: m.mission.type,
            difficulty: m.mission.difficulty,
            progress: m.progress,
            target: m.target,
            status: m.status,
            rewardConfiguration: m.mission.rewardConfiguration,
            completedAt: m.completedAt?.toISOString() ?? null,
            rewardClaimedAt: m.rewardClaimedAt?.toISOString() ?? null,
          })),
          completedCount: dailyMissions.filter((m) => m.status === 'completed' || m.status === 'claimed').length,
          totalCount: dailyMissions.length,
          period: streak.lastActiveDate,
        },
        weeklyMissions: {
          missions: weeklyMissions.map((m) => ({
            id: m.id,
            missionId: m.missionId,
            name: m.mission.name,
            description: m.mission.description,
            type: m.mission.type,
            difficulty: m.mission.difficulty,
            progress: m.progress,
            target: m.target,
            status: m.status,
            rewardConfiguration: m.mission.rewardConfiguration,
            completedAt: m.completedAt?.toISOString() ?? null,
            rewardClaimedAt: m.rewardClaimedAt?.toISOString() ?? null,
          })),
          completedCount: weeklyMissions.filter((m) => m.status === 'completed' || m.status === 'claimed').length,
          totalCount: weeklyMissions.length,
        },
        level: {
          current: levelInfo.currentLevel,
          xpTotal,
          xpToNextLevel: levelInfo.xpNeeded,
          progress: levelInfo.progress,
        },
      },
    };
  });

  /**
   * GET /api/missions/daily
   *
   * Get the current user's daily missions.
   * Generates missions if none exist for today.
   */
  app.get('/missions/daily', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const userLevel = 1; // Would be fetched from user record
    const missions = generateDailyMissions(userId, userLevel);

    // Track analytics for each mission
    for (const mission of missions) {
      trackMissionViewed(userId, mission.missionId, mission.period);
    }

    return {
      success: true,
      data: {
        missions: missions.map((m) => ({
          id: m.id,
          missionId: m.missionId,
          name: m.mission.name,
          description: m.mission.description,
          type: m.mission.type,
          difficulty: m.mission.difficulty,
          progress: m.progress,
          target: m.target,
          status: m.status,
          rewardConfiguration: m.mission.rewardConfiguration,
          completedAt: m.completedAt?.toISOString() ?? null,
          rewardClaimedAt: m.rewardClaimedAt?.toISOString() ?? null,
        })),
        completedCount: missions.filter((m) => m.status === 'completed' || m.status === 'claimed').length,
        totalCount: missions.length,
        period: missions[0]?.period ?? new Date().toISOString().slice(0, 10),
      },
    };
  });

  /**
   * GET /api/missions/weekly
   *
   * Get the current user's weekly missions.
   * Generates missions if none exist for this week.
   */
  app.get('/missions/weekly', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const userLevel = 1; // Would be fetched from user record
    const missions = generateWeeklyMissions(userId, userLevel);

    return {
      success: true,
      data: {
        missions: missions.map((m) => ({
          id: m.id,
          missionId: m.missionId,
          name: m.mission.name,
          description: m.mission.description,
          type: m.mission.type,
          difficulty: m.mission.difficulty,
          progress: m.progress,
          target: m.target,
          status: m.status,
          rewardConfiguration: m.mission.rewardConfiguration,
          completedAt: m.completedAt?.toISOString() ?? null,
          rewardClaimedAt: m.rewardClaimedAt?.toISOString() ?? null,
        })),
        completedCount: missions.filter((m) => m.status === 'completed' || m.status === 'claimed').length,
        totalCount: missions.length,
        period: missions[0]?.period ?? '',
      },
    };
  });

  /**
   * GET /api/missions/progress
   *
   * Get progress for a specific mission.
   */
  app.get('/missions/progress', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { missionId } = request.query as { missionId?: string };
    if (!missionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'missionId is required' },
      });
    }

    const progress = getMissionProgress(userId, missionId);
    if (!progress) {
      return reply.status(404).send({
        success: false,
        error: { code: 'MISSION_NOT_FOUND', message: 'Mission not found' },
      });
    }

    return {
      success: true,
      data: progress,
    };
  });

  /**
   * POST /api/missions/:id/claim
   *
   * Claim a mission reward.
   * Idempotent: repeated calls return the same result.
   */
  app.post('/missions/:id/claim', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: userMissionId } = request.params as { id: string };

    const result = claimMissionReward(userId, userMissionId);

    if (!result.success) {
      const statusCode = result.error === 'ALREADY_CLAIMED' ? 200 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Grant the reward
    if (result.reward) {
      const grantResult = grantReward(
        userId,
        result.reward,
        'mission_reward',
        userMissionId,
        'user_mission',
      );

      // Award XP if present
      let xpAwarded = 0;
      let levelUp = false;
      let newLevel = 0;

      if (result.reward.xp > 0) {
        const xpResult = awardXP(userId, result.reward.xp, 'achievement', {
          referenceId: userMissionId,
          referenceType: 'user_mission',
        });
        xpAwarded = xpResult.xpAwarded;
        levelUp = xpResult.levelUp;
        newLevel = xpResult.level;
      }

      // Track analytics
      trackMissionClaimed(userId, userMissionId, 'xp', result.reward.xp);

      return {
        success: true,
        data: {
          success: true,
          reward: {
            type: 'xp' as const,
            value: result.reward.xp,
            description: `+${result.reward.xp} XP`,
          },
          xpAwarded,
          levelUp,
          newLevel,
        },
      };
    }

    return {
      success: true,
      data: {
        success: true,
        reward: {
          type: 'xp' as const,
          value: 0,
          description: 'Reward claimed',
        },
        xpAwarded: 0,
        levelUp: false,
        newLevel: 0,
      },
    };
  });

  /**
   * GET /api/streak
   *
   * Get the current user's streak information.
   */
  app.get('/streak', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const streak = getStreakResponse(userId);

    return {
      success: true,
      data: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        status: streak.status,
        lastActiveDate: streak.lastActiveDate,
        todayCompleted: streak.todayCompleted,
        daysUntilNextMilestone: streak.daysUntilNextMilestone,
        nextMilestone: streak.nextMilestone,
        weekActivity: streak.weekActivity,
      },
    };
  });

  /**
   * GET /api/rewards
   *
   * Get the current user's reward inventory.
   */
  app.get('/rewards', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const inventory = getUserInventory(userId);

    return {
      success: true,
      data: {
        items: inventory.map((item) => ({
          id: item.id,
          itemId: item.itemId,
          itemType: item.itemType,
          source: item.source,
          grantedAt: item.grantedAt.toISOString(),
        })),
        totalCount: inventory.length,
      },
    };
  });

  /**
   * GET /api/rewards/history
   *
   * Get the current user's reward transaction history.
   */
  app.get('/rewards/history', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { cursor, limit, source, rewardType } = request.query as {
      cursor?: string;
      limit?: string;
      source?: string;
      rewardType?: string;
    };

    const history = getRewardHistory(userId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      source: source as any,
      rewardType: rewardType as any,
    });

    return {
      success: true,
      data: {
        transactions: history.transactions.map((t) => ({
          id: t.id,
          source: t.source,
          referenceId: t.referenceId,
          rewardType: t.rewardType,
          rewardValue: t.rewardValue,
          createdAt: t.createdAt.toISOString(),
        })),
        pagination: history.pagination,
      },
    };
  });
}
