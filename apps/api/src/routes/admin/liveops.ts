/**
 * GTX Rush — Admin LiveOps Routes v1.0
 *
 * Admin routes for managing all Live Operations:
 * - Season management (create, schedule, activate, end, archive)
 * - Event management
 * - Battle pass management
 * - Mission template management
 * - Community goal management
 * - Reward budget management
 * - LiveOps dashboard
 * - Audit log
 *
 * SECURITY:
 * - All routes require admin authentication
 * - RBAC: different permissions for different actions
 * - All changes are audited
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';
import {
  createLiveOpsSeason,
  getActiveSeason,
  getLiveOpsSeasonById,
  getAllLiveOpsSeasons,
  transitionSeason,
  createCommunityGoal,
  getActiveCommunityGoals,
  updateCommunityGoalProgress,
  createRewardBudget,
  checkRewardBudget,
  getAuditLog,
  addAuditEntry as addLiveOpsAuditEntry,
} from '../../services/liveops-engine';
import {
  createBattlePass,
  getBattlePassBySeason,
  getBattlePass,
  _clearBattlePassEngine,
} from '../../services/battle-pass-engine';
import {
  createEvent,
  getEvent,
  updateEventStatus,
  getEventsByStatus,
  getActiveEvents,
} from '../../services/event-engine';
import {
  runLiveOpsJobs,
  getRecentJobResults,
} from '../../services/liveops-scheduler';
import {
  DEFAULT_BATTLE_PASS_CONFIG,
  DEFAULT_MISSION_CONFIG,
  DEFAULT_REWARD_BUDGET_CONFIG,
} from '@gtx-rush/config';

export async function adminLiveOpsRoutes(app: FastifyInstance) {
  // ============================================================
  // Dashboard
  // ============================================================

  /**
   * GET /api/admin/liveops/dashboard
   * LiveOps Center dashboard overview
   */
  app.get('/dashboard', {
    preHandler: [requirePermission('liveops.view')],
  }, async () => {
    const activeSeason = getActiveSeason();
    const liveEvents = getActiveEvents();
    const upcomingEvents = getEventsByStatus('scheduled');
    const activeGoals = getActiveCommunityGoals();

    return {
      success: true,
      data: {
        activeSeason: activeSeason ? {
          id: activeSeason.id,
          name: activeSeason.name,
          theme: activeSeason.theme,
          status: activeSeason.status,
          startTime: activeSeason.startTime,
          endTime: activeSeason.endTime,
        } : null,
        liveEvents: liveEvents.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          status: e.status,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
        })),
        upcomingEvents: upcomingEvents.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
        })),
        missionPools: {
          daily: DEFAULT_MISSION_CONFIG.dailyMissionCount,
          weekly: DEFAULT_MISSION_CONFIG.weeklyMissionCount,
          seasonal: DEFAULT_MISSION_CONFIG.seasonalMissionCount,
        },
        communityGoals: activeGoals.map((g) => ({
          id: g.id,
          name: g.name,
          progress: g.progressPercentage,
          currentValue: g.currentValue,
          targetValue: g.targetValue,
        })),
        battlePass: {
          enabled: DEFAULT_BATTLE_PASS_CONFIG.premiumEnabled,
          maxLevel: DEFAULT_BATTLE_PASS_CONFIG.maxLevel,
          autoClaim: DEFAULT_BATTLE_PASS_CONFIG.autoClaimEnabled,
        },
        scheduledJobs: getRecentJobResults(5),
      },
    };
  });

  // ============================================================
  // Season Management
  // ============================================================

  /**
   * GET /api/admin/liveops/seasons
   * List all seasons
   */
  app.get('/seasons', {
    preHandler: [requirePermission('liveops.view')],
  }, async () => {
    return { success: true, data: getAllLiveOpsSeasons() };
  });

  /**
   * GET /api/admin/liveops/seasons/current
   * Get current active season
   */
  app.get('/seasons/current', {
    preHandler: [requirePermission('liveops.view')],
  }, async () => {
    return { success: true, data: getActiveSeason() };
  });

  /**
   * GET /api/admin/liveops/seasons/:id
   * Get season details
   */
  app.get('/seasons/:id', {
    preHandler: [requirePermission('liveops.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const season = getLiveOpsSeasonById(id);
    if (!season) {
      return reply.status(404).send({
        success: false,
        error: { code: 'SEASON_NOT_FOUND', message: 'Season not found' },
      });
    }
    return { success: true, data: season };
  });

  /**
   * POST /api/admin/liveops/seasons
   * Create a new season
   */
  app.post('/seasons', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description: string;
      startTime: string;
      endTime: string;
      theme: string;
      bannerUrl?: string;
    };

    if (!body.name || !body.startTime || !body.endTime) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'name, startTime, and endTime are required' },
      });
    }

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (startTime >= endTime) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_DATES', message: 'startTime must be before endTime' },
      });
    }

    const season = createLiveOpsSeason({
      name: body.name,
      description: body.description ?? '',
      startTime,
      endTime,
      theme: body.theme ?? 'default',
      bannerUrl: body.bannerUrl,
    });

    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;
    addLiveOpsAuditEntry(
      adminUser?.id ?? 'unknown',
      'SEASON_CREATED',
      'season',
      season.id,
      null,
      { name: season.name, theme: season.theme },
    );

    return reply.status(201).send({ success: true, data: season });
  });

  /**
   * POST /api/admin/liveops/seasons/:id/transition
   * Transition a season to a new status
   */
  app.post('/seasons/:id/transition', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const validStatuses = ['draft', 'scheduled', 'active', 'ending', 'ended', 'archived'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` },
      });
    }

    const success = transitionSeason(id, status as any, adminUser?.id ?? 'unknown');
    if (!success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'TRANSITION_FAILED', message: 'Invalid season transition' },
      });
    }

    return { success: true, data: { message: `Season transitioned to ${status}` } };
  });

  // ============================================================
  // Battle Pass Management
  // ============================================================

  /**
   * POST /api/admin/liveops/battle-pass
   * Create a battle pass for a season
   */
  app.post('/battle-pass', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      seasonId: string;
      name: string;
      description: string;
      priceStars?: number;
      startTime: string;
      endTime: string;
    };

    if (!body.seasonId || !body.name || !body.startTime || !body.endTime) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'seasonId, name, startTime, and endTime are required' },
      });
    }

    const existing = getBattlePassBySeason(body.seasonId);
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_EXISTS', message: 'Battle pass already exists for this season' },
      });
    }

    const battlePass = createBattlePass({
      seasonId: body.seasonId,
      name: body.name,
      description: body.description ?? '',
      priceStars: body.priceStars,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    });

    return reply.status(201).send({ success: true, data: battlePass });
  });

  /**
   * GET /api/admin/liveops/battle-pass/:seasonId
   * Get battle pass for a season
   */
  app.get('/battle-pass/:seasonId', {
    preHandler: [requirePermission('liveops.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { seasonId } = request.params as { seasonId: string };
    const battlePass = getBattlePassBySeason(seasonId);
    if (!battlePass) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle pass not found for this season' },
      });
    }
    return { success: true, data: battlePass };
  });

  // ============================================================
  // Event Management
  // ============================================================

  /**
   * POST /api/admin/liveops/events
   * Create a new LiveOps event
   */
  app.post('/events', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description: string;
      type: string;
      gameId: string;
      startsAt: string;
      endsAt: string;
    };

    if (!body.name || !body.type || !body.gameId || !body.startsAt || !body.endsAt) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'name, type, gameId, startsAt, and endsAt are required' },
      });
    }

    const event = createEvent({
      name: body.name,
      description: body.description ?? '',
      type: body.type as any,
      gameId: body.gameId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });

    return reply.status(201).send({ success: true, data: event });
  });

  /**
   * POST /api/admin/liveops/events/:id/status
   * Update event status
   */
  app.post('/events/:id/status', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const success = updateEventStatus(id, status as any);
    if (!success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update event status' },
      });
    }

    return { success: true, data: { message: `Event status updated to ${status}` } };
  });

  // ============================================================
  // Community Goals
  // ============================================================

  /**
   * POST /api/admin/liveops/community-goals
   * Create a community goal
   */
  app.post('/community-goals', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      description: string;
      type: string;
      targetValue: number;
      startTime: string;
      endTime: string;
      reward: { type: string; value: string | number; name: string; description: string; rarity: string; itemId: string | null };
    };

    if (!body.name || !body.targetValue || !body.startTime || !body.endTime) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'name, targetValue, startTime, and endTime are required' },
      });
    }

    const goal = createCommunityGoal({
      name: body.name,
      description: body.description ?? '',
      type: body.type ?? 'games_played',
      targetValue: body.targetValue,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      reward: body.reward as any,
    });

    return reply.status(201).send({ success: true, data: goal });
  });

  /**
   * GET /api/admin/liveops/community-goals
   * List active community goals
   */
  app.get('/community-goals', {
    preHandler: [requirePermission('liveops.view')],
  }, async () => {
    return { success: true, data: getActiveCommunityGoals() };
  });

  // ============================================================
  // Reward Budget
  // ============================================================

  /**
   * POST /api/admin/liveops/reward-budgets
   * Create a reward budget
   */
  app.post('/reward-budgets', {
    preHandler: [requirePermission('liveops.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      totalBudget: number;
      userCap: number;
      dailyCap: number;
    };

    if (!body.name || !body.totalBudget) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'name and totalBudget are required' },
      });
    }

    const budget = createRewardBudget({
      name: body.name,
      totalBudget: body.totalBudget,
      userCap: body.userCap ?? DEFAULT_REWARD_BUDGET_CONFIG.perUserDailyCap,
      dailyCap: body.dailyCap ?? DEFAULT_REWARD_BUDGET_CONFIG.globalDailyBudget,
    });

    return reply.status(201).send({ success: true, data: budget });
  });

  /**
   * GET /api/admin/liveops/reward-budgets/:id/check
   * Check reward budget status
   */
  app.get('/reward-budgets/:id/check', {
    preHandler: [requirePermission('liveops.view')],
  }, async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    return { success: true, data: checkRewardBudget(id) };
  });

  // ============================================================
  // Scheduled Jobs
  // ============================================================

  /**
   * POST /api/admin/liveops/jobs/run
   * Manually trigger LiveOps scheduled jobs
   */
  app.post('/jobs/run', {
    preHandler: [requirePermission('liveops.manage')],
  }, async () => {
    const results = runLiveOpsJobs();
    return { success: true, data: results };
  });

  /**
   * GET /api/admin/liveops/jobs/history
   * Get recent job execution history
   */
  app.get('/jobs/history', {
    preHandler: [requirePermission('liveops.view')],
  }, async (request: FastifyRequest) => {
    const { limit } = request.query as { limit?: string };
    return {
      success: true,
      data: getRecentJobResults(limit ? parseInt(limit) : 20),
    };
  });

  // ============================================================
  // Audit Log
  // ============================================================

  /**
   * GET /api/admin/liveops/audit
   * Get audit log entries
   */
  app.get('/audit', {
    preHandler: [requirePermission('liveops.view')],
  }, async (request: FastifyRequest) => {
    const { targetType, limit, offset } = request.query as {
      targetType?: string;
      limit?: string;
      offset?: string;
    };
    return {
      success: true,
      data: getAuditLog(targetType ?? 'season', {
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      }),
    };
  });

  // ============================================================
  // Mission Configuration
  // ============================================================

  /**
   * GET /api/admin/liveops/missions/config
   * Get current mission configuration
   */
  app.get('/missions/config', {
    preHandler: [requirePermission('liveops.view')],
  }, async () => {
    return {
      success: true,
      data: DEFAULT_MISSION_CONFIG,
    };
  });
}
