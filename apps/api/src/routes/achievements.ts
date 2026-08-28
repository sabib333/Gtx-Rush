/**
 * Achievements — API Routes v1.0
 *
 * - GET  /api/users/me/badges      → Get user's earned badges
 * - POST /api/users/me/badges/:slug/view → Mark badge as viewed
 * - GET  /api/users/me/titles      → Get user's unlocked titles
 * - POST /api/users/me/titles/:slug/equip → Equip a title
 * - GET  /api/users/me/profile     → Full user profile with all competition data
 * - GET  /api/users/:id/profile    → Public user profile
 * - GET  /api/badges               → List all available badges
 * - GET  /api/titles               → List all available titles
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserBadges, hasBadge, getBadgeCount } from '../services/badge-engine';
import {
  getUserTitles,
  equipTitle,
  getEquippedTitle,
  getTitleDefinition,
} from '../services/title-system';
import { getUserXP, getCurrentLevel, getXPToNextLevel } from '../services/level-service';
import { getActiveSeason } from '../services/season-engine';
import { getUserTierWithDefinition } from '../services/tier-system';
import { getUserRank, getUserAllRanks } from '../services/ranking-service';
import { BADGE_DEFINITIONS } from '@gtx-rush/config';
import { TITLE_DEFINITIONS } from '@gtx-rush/config';

// ============================================================
// Mock auth helper
// ============================================================
function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) return 'dev-user-001';
  return 'dev-user-001';
}

// ============================================================
// Routes
// ============================================================

export async function achievementRoutes(app: FastifyInstance) {
  /**
   * GET /api/users/me/badges
   *
   * Get current user's earned badges.
   */
  app.get('/users/me/badges', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const badges = getUserBadges(userId);
    const count = getBadgeCount(userId);

    return {
      success: true,
      data: {
        badges,
        count,
        totalAvailable: BADGE_DEFINITIONS.length,
      },
    };
  });

  /**
   * POST /api/users/me/badges/:slug/view
   *
   * Mark a badge as viewed (for notification dismissal).
   */
  app.post('/users/me/badges/:slug/view', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { slug } = request.params as { slug: string };

    if (!hasBadge(userId, slug)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'BADGE_NOT_FOUND', message: 'Badge not earned' },
      });
    }

    return { success: true, data: { viewed: true } };
  });

  /**
   * GET /api/users/me/titles
   *
   * Get current user's unlocked titles.
   */
  app.get('/users/me/titles', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const titles = getUserTitles(userId);
    const equipped = getEquippedTitle(userId);

    return {
      success: true,
      data: {
        titles,
        equipped,
        totalAvailable: TITLE_DEFINITIONS.length,
      },
    };
  });

  /**
   * POST /api/users/me/titles/:slug/equip
   *
   * Equip a title for the user's profile.
   */
  app.post('/users/me/titles/:slug/equip', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { slug } = request.params as { slug: string };

    // Check if user has this title
    const titles = getUserTitles(userId);
    const hasTitle = titles.some((t) => t.titleId === slug);

    if (!hasTitle) {
      return reply.status(404).send({
        success: false,
        error: { code: 'TITLE_NOT_UNLOCKED', message: 'Title not unlocked' },
      });
    }

    const result = equipTitle(userId, slug);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: { code: 'TITLE_NOT_FOUND', message: 'Title not found' },
      });
    }

    return { success: true, data: { equipped: slug } };
  });

  /**
   * GET /api/users/me/profile
   *
   * Full user profile with all competition data.
   */
  app.get('/users/me/profile', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const xp = getUserXP(userId);
    const level = getCurrentLevel(xp);
    const levelInfo = getXPToNextLevel(xp);
    const allRanks = getUserAllRanks(userId);
    const activeSeason = getActiveSeason();
    const userTier = activeSeason ? getUserTierWithDefinition(userId, activeSeason.id) : null;
    const badges = getUserBadges(userId);
    const equippedTitle = getEquippedTitle(userId);
    const titles = getUserTitles(userId);
    const badgeCount = getBadgeCount(userId);

    return {
      success: true,
      data: {
        id: userId,
        displayName: `Player ${userId.slice(0, 8)}`,
        level,
        xp,
        levelInfo,
        globalRank: allRanks.global?.rank ?? null,
        seasonRank: allRanks.season?.rank ?? null,
        tier: userTier,
        badges: badges.slice(0, 20), // Limit for profile view
        badgeCount,
        equippedTitle,
        titles,
        topScores: [], // Would be populated from game scores
        seasonHistory: [], // Would be populated from season data
      },
    };
  });

  /**
   * GET /api/users/:id/profile
   *
   * Public user profile (respects privacy settings).
   */
  app.get('/users/:id/profile', async (request, reply) => {
    const { id } = request.params as { id: string };

    // In production, check privacy settings
    const xp = getUserXP(id);
    const level = getCurrentLevel(xp);
    const allRanks = getUserAllRanks(id);
    const badges = getUserBadges(id);
    const equippedTitle = getEquippedTitle(id);

    return {
      success: true,
      data: {
        id,
        displayName: `Player ${id.slice(0, 8)}`,
        level,
        globalRank: allRanks.global?.rank ?? null,
        badges: badges.slice(0, 10),
        equippedTitle,
      },
    };
  });

  /**
   * GET /api/badges
   *
   * List all available badges (definitions).
   */
  app.get('/badges', async () => {
    return {
      success: true,
      data: BADGE_DEFINITIONS.map((b) => ({
        slug: b.slug,
        name: b.name,
        description: b.description,
        iconUrl: b.iconUrl,
        category: b.category,
        rarity: b.rarity,
        criteriaType: b.criteriaType,
        threshold: b.threshold,
        gameId: b.gameId,
      })),
    };
  });

  /**
   * GET /api/titles
   *
   * List all available titles (definitions).
   */
  app.get('/titles', async () => {
    return {
      success: true,
      data: TITLE_DEFINITIONS.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        category: t.category,
        rarity: t.rarity,
        iconUrl: t.iconUrl,
      })),
    };
  });

  /**
   * GET /api/competition/scheduler/status
   *
   * Get competition scheduler job status.
   */
  app.get('/competition/scheduler/status', async (request, reply) => {
    const { getCompetitionJobStatus } = await import('../services/competition-scheduler');
    const jobs = getCompetitionJobStatus();

    return {
      success: true,
      data: {
        jobs: jobs.map((j) => ({
          ...j,
          lastRunAt: j.lastRunAt?.toISOString() ?? null,
        })),
      },
    };
  });
}
