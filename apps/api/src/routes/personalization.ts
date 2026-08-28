/**
 * GTX Rush — Personalization API Routes
 *
 * Endpoints for:
 * - Smart Home recommendations
 * - Player profile
 * - Goal system
 * - Adaptive difficulty
 * - Recommendation tracking
 *
 * Contract: AI Personalization Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import { PERSONALIZATION_FLAGS } from '@gtx-rush/config';
import {
  getHomeRecommendations,
  trackRecommendation,
} from '../services/recommendation-service';
import {
  getPlayerProfile,
  getGamePreferences,
} from '../services/preference-engine';
import {
  getPlayerGoals,
  getActiveGoals,
  createGoal,
  abandonGoal,
  getAllGoalProgress,
  generateSystemGoals,
} from '../services/goal-system';
import { getAdaptiveDifficultySummary } from '../services/adaptive-difficulty';
import { getSkillSummary, getUserSkillEstimates } from '../services/skill-estimation';

export async function personalizationRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Smart Home
  // ============================================================

  /**
   * GET /personalization/home
   * Get personalized home recommendations
   */
  app.get('/personalization/home', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.personalization_enabled || !PERSONALIZATION_FLAGS.smart_home_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'PERSONALIZATION_DISABLED',
        message: 'Personalization is currently disabled',
      });
    }

    // TODO: Extract userId from auth
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const recommendations = getHomeRecommendations(userId);

      return reply.send({
        success: true,
        data: {
          recommendations: recommendations.recommendations,
          personalBestCoach: recommendations.personalBestCoach,
          smartPlan: recommendations.smartPlan,
          welcomeMessage: recommendations.welcomeMessage,
          engagementLevel: 'active',
        },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to get home recommendations');
      // Fallback to non-personalized home
      return reply.send({
        success: true,
        data: {
          recommendations: [],
          personalBestCoach: null,
          smartPlan: null,
          welcomeMessage: 'Welcome to GTX Rush!',
          engagementLevel: 'active',
        },
      });
    }
  });

  // ============================================================
  // Player Profile
  // ============================================================

  /**
   * GET /personalization/profile
   * Get player preference profile
   */
  app.get('/personalization/profile', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.personalization_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'PERSONALIZATION_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const profile = getPlayerProfile(userId);
      const gamePreferences = getGamePreferences(userId);
      const skillEstimates = getUserSkillEstimates(userId);
      const activeGoals = getActiveGoals(userId);
      const skillSummary = getSkillSummary(userId);

      return reply.send({
        success: true,
        data: {
          profile,
          gamePreferences,
          skillEstimates,
          skillSummary,
          activeGoals,
        },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to get profile');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Goals
  // ============================================================

  /**
   * GET /personalization/goals
   * Get player goals
   */
  app.get('/personalization/goals', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.goal_system_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'GOAL_SYSTEM_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const goals = getPlayerGoals(userId);
      const progress = getAllGoalProgress(userId);

      return reply.send({
        success: true,
        data: {
          goals,
          progress,
        },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to get goals');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * POST /personalization/goals
   * Create a new goal
   */
  app.post('/personalization/goals', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.goal_system_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'GOAL_SYSTEM_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as {
      type?: string;
      target?: number;
      title?: string;
      description?: string;
    };

    if (!body.type || !body.target) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'type and target are required',
      });
    }

    try {
      const goal = createGoal(
        userId,
        body.type as any,
        body.target,
        body.title,
        body.description,
        'user',
      );

      if (!goal) {
        return reply.status(400).send({
          success: false,
          error: 'GOAL_CREATION_FAILED',
          message: 'Could not create goal (limit reached or similar goal exists)',
        });
      }

      return reply.send({
        success: true,
        data: { goal },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to create goal');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * POST /personalization/goals/suggest
   * Get system-suggested goals
   */
  app.post('/personalization/goals/suggest', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.goal_system_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'GOAL_SYSTEM_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const suggestedGoals = generateSystemGoals(userId);

      return reply.send({
        success: true,
        data: { suggestedGoals },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to suggest goals');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * POST /personalization/goals/:goalId/abandon
   * Abandon a goal
   */
  app.post('/personalization/goals/:goalId/abandon', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.goal_system_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'GOAL_SYSTEM_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const { goalId } = request.params as { goalId: string };

    try {
      const success = abandonGoal(userId, goalId);

      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'GOAL_NOT_FOUND',
        });
      }

      return reply.send({
        success: true,
        data: { message: 'Goal abandoned' },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to abandon goal');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Adaptive Difficulty
  // ============================================================

  /**
   * GET /personalization/difficulty
   * Get adaptive difficulty settings
   */
  app.get('/personalization/difficulty', async (request, reply) => {
    if (!PERSONALIZATION_FLAGS.adaptive_practice_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'ADAPTIVE_DIFFICULTY_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    try {
      const difficulty = getAdaptiveDifficultySummary(userId);

      return reply.send({
        success: true,
        data: difficulty,
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to get difficulty');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });

  // ============================================================
  // Recommendation Tracking
  // ============================================================

  /**
   * POST /personalization/track
   * Track recommendation interaction
   */
  app.post('/personalization/track', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as {
      recommendationId?: string;
      action?: string;
    };

    if (!body.recommendationId || !body.action) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'recommendationId and action are required',
      });
    }

    try {
      trackRecommendation(
        userId,
        body.recommendationId,
        body.action as 'shown' | 'clicked' | 'completed' | 'dismissed',
      );

      return reply.send({
        success: true,
        data: { message: 'Interaction tracked' },
      });
    } catch (error) {
      app.log.error('[Personalization] Failed to track interaction');
      return reply.status(500).send({
        success: false,
        error: 'INTERNAL_ERROR',
      });
    }
  });
}
