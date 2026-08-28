/**
 * Growth Engine — API Routes v1.0
 *
 * Handles:
 * - GET  /api/referrals/me           → Get referral dashboard
 * - GET  /api/referrals/code         → Get/generate referral code
 * - POST /api/referrals/link         → Generate share link
 * - GET  /api/referrals/stats        → Get referral stats
 * - POST /api/referrals/resolve      → Resolve deep link
 * - GET  /api/campaigns/:id          → Get campaign info
 * - POST /api/campaigns/:id/claim    → Claim campaign reward
 * - GET  /api/growth/share/:type     → Generate share content
 *
 * SECURITY:
 * - Referral attribution is server-authoritative
 * - Deep links are validated
 * - Share messages do not expose private data
 * - Campaign configuration is server-side
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  generateReferralCode,
  getUserReferralCode,
  getReferralCodeByCode,
  resolveDeepLink,
  createReferral,
  getReferralDashboard,
  getReferralStats,
} from '../services/referral-engine';
import {
  generateShareLink,
  generateChallengeShareLink,
  generateScoreShareLink,
  generateBadgeShareLink,
  generatePersonalBestShareLink,
} from '../services/share-engine';
import {
  getCampaign,
  isCampaignActive,
  recordCampaignAttribution,
} from '../services/campaign-service';
import {
  trackReferralLinkCreated,
  trackReferralLinkOpened,
  trackShareScore,
  trackShareBadge,
  trackShareChallenge,
  trackSharePersonalBest,
  trackCampaignOpened,
} from '../services/growth-analytics';
import { generalRateLimit } from '../middleware/rate-limiter';

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

export async function growthRoutes(app: FastifyInstance) {
  // Apply rate limiting to all growth routes
  await app.addHook('onRequest', generalRateLimit);

  /**
   * GET /api/referrals/me
   *
   * Get the referral dashboard for the current user.
   * Returns referral stats, milestones, and recent referrals.
   */
  app.get('/referrals/me', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const dashboard = getReferralDashboard(userId);
    const stats = getReferralStats(userId);

    return {
      success: true,
      data: {
        dashboard,
        stats,
      },
    };
  });

  /**
   * GET /api/referrals/code
   *
   * Get or generate a referral code for the current user.
   */
  app.get('/referrals/code', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    let code = getUserReferralCode(userId);
    if (!code) {
      code = generateReferralCode(userId);
    }

    // Generate deep link
    const { generateReferralDeepLink } = await import('@gtx-rush/config');
    const deepLink = generateReferralDeepLink(code.code);

    // Track analytics
    trackReferralLinkCreated(userId, code.code, 'manual');

    return {
      success: true,
      data: {
        code: code.code,
        deepLink,
        usageCount: code.usageCount,
        createdAt: code.createdAt.toISOString(),
      },
    };
  });

  /**
   * POST /api/referrals/link
   *
   * Generate a share link for content.
   */
  app.post('/referrals/link', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { type, gameId, score, challengeId, badgeId, achievementId } = request.body as {
      type: string;
      gameId?: string;
      score?: number;
      challengeId?: string;
      badgeId?: string;
      achievementId?: string;
    };

    if (!type) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'type is required' },
      });
    }

    const result = generateShareLink({
      type: type as any,
      userId,
      gameId,
      score,
      challengeId,
      badgeId,
      achievementId,
    });

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics based on type
    switch (type) {
      case 'score':
        trackShareScore(userId, gameId ?? '', score ?? 0);
        break;
      case 'badge':
        trackShareBadge(userId, badgeId ?? '');
        break;
      case 'challenge':
        trackShareChallenge(userId, challengeId ?? '', gameId ?? '');
        break;
      case 'personal_best':
        trackSharePersonalBest(userId, gameId ?? '', score ?? 0);
        break;
    }

    return {
      success: true,
      data: {
        shareLink: result.shareLink,
        message: result.message,
        deepLink: result.deepLink,
      },
    };
  });

  /**
   * GET /api/referrals/stats
   *
   * Get referral statistics for the current user.
   */
  app.get('/referrals/stats', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const stats = getReferralStats(userId);

    return {
      success: true,
      data: stats,
    };
  });

  /**
   * POST /api/referrals/resolve
   *
   * Resolve a deep link and return context.
   * Used when a user opens the app from a deep link.
   */
  app.post('/referrals/resolve', async (request, reply) => {
    const { startParam } = request.body as { startParam: string };

    if (!startParam) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'startParam is required' },
      });
    }

    const resolution = resolveDeepLink(startParam);

    if (!resolution.valid) {
      return {
        success: true,
        data: {
          valid: false,
          context: null,
          inviter: null,
          campaign: null,
          error: resolution.error,
        },
      };
    }

    // Track link opened
    if (resolution.context?.referralCode) {
      const code = getReferralCodeByCode(resolution.context.referralCode);
      if (code) {
        trackReferralLinkOpened(resolution.context.referralCode, code.userId, resolution.context.source);
      }
    }

    // Build landing experience
    let landingExperience = null;
    if (resolution.inviter) {
      landingExperience = {
        type: resolution.context?.challengeToken ? 'challenge' : 'referral',
        title: resolution.context?.challengeToken
          ? '⚡ YOUR FRIEND CHALLENGED YOU'
          : '⚡ YOUR FRIEND INVITED YOU',
        description: resolution.context?.challengeToken
          ? `${resolution.inviter.displayName} challenged you. Can you beat them?`
          : `${resolution.inviter.displayName} invited you to GTX Rush.`,
        inviterName: resolution.inviter.displayName,
        ctaText: resolution.context?.challengeToken ? 'ACCEPT CHALLENGE' : 'PLAY NOW',
        ctaDeepLink: resolution.context?.challengeToken
          ? `/challenge/${resolution.context.challengeToken}`
          : '/',
      };
    }

    return {
      success: true,
      data: {
        valid: resolution.valid,
        context: resolution.context,
        inviter: resolution.inviter,
        campaign: resolution.campaign,
        landingExperience,
      },
    };
  });

  /**
   * GET /api/campaigns/:id
   *
   * Get campaign information.
   */
  app.get('/campaigns/:id', async (request, reply) => {
    const { id: campaignId } = request.params as { id: string };

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' },
      });
    }

    // Track campaign view
    const userId = getUserId(request);
    if (userId) {
      trackCampaignOpened(campaignId, userId);
    }

    return {
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status,
          startsAt: campaign.startsAt.toISOString(),
          endsAt: campaign.endsAt.toISOString(),
          participantCount: campaign.configuration.participantCount,
        },
        isActive: isCampaignActive(campaignId),
      },
    };
  });

  /**
   * POST /api/campaigns/:id/claim
   *
   * Claim a campaign reward.
   */
  app.post('/campaigns/:id/claim', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: campaignId } = request.params as { id: string };

    const campaign = getCampaign(campaignId);
    if (!campaign) {
      return reply.status(404).send({
        success: false,
        error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found' },
      });
    }

    if (!isCampaignActive(campaignId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CAMPAIGN_NOT_ACTIVE', message: 'Campaign is not active' },
      });
    }

    // Record attribution
    recordCampaignAttribution(campaignId, userId, 'campaign', {
      claimed: true,
    });

    return {
      success: true,
      data: {
        claimed: true,
        campaignId,
        rewards: campaign.rewardConfiguration.inviter,
      },
    };
  });

  /**
   * GET /api/growth/share/:type
   *
   * Generate share content for a specific type.
   */
  app.get('/growth/share/:type', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { type } = request.params as { type: string };
    const { gameId, score, challengeId, badgeId } = request.query as {
      gameId?: string;
      score?: string;
      challengeId?: string;
      badgeId?: string;
    };

    const result = generateShareLink({
      type: type as any,
      userId,
      gameId,
      score: score ? parseInt(score, 10) : undefined,
      challengeId,
      badgeId,
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
        message: result.message,
        deepLink: result.deepLink,
      },
    };
  });
}
