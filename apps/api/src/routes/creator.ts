/**
 * GTX Rush — Creator & UGC API Routes
 *
 * Endpoints for:
 * - Creator profiles
 * - Custom challenges
 * - Community discovery
 * - Creator following
 * - Content reporting
 *
 * Contract: Creator Engine Contract v1.0
 */

import type { FastifyInstance } from 'fastify';
import { CREATOR_FLAGS } from '@gtx-rush/config';
import {
  createChallenge,
  updateChallenge,
  publishChallenge,
  archiveChallenge,
  getChallenge,
  getCreatorChallenges,
  getChallengeDeepLink,
} from '../services/custom-challenge-engine';
import {
  getCreatorProfile,
  getCreatorProfileWithStats,
  updateCreatorProfile,
  followCreator,
  unfollowCreator,
  getCreatorAnalytics,
} from '../services/creator-profile';
import {
  getCommunityFeed,
  getChallengeWithCreator,
  getCreatorPublicChallenges,
  searchChallenges,
} from '../services/community-discovery';
import {
  validateContent,
  submitReport,
  getContentReports,
} from '../services/content-validation';
import {
  trackCreatorEvent,
  trackChallengeEvent,
} from '../services/creator-analytics';

export async function creatorRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Creator Profile
  // ============================================================

  /**
   * GET /creator/profile
   * Get creator profile
   */
  app.get('/creator/profile', async (request, reply) => {
    if (!CREATOR_FLAGS.creator_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'CREATOR_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const profile = getCreatorProfile(userId);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: 'CREATOR_NOT_FOUND',
      });
    }

    trackCreatorEvent(userId, 'profile_viewed');

    return reply.send({
      success: true,
      data: { profile },
    });
  });

  /**
   * GET /creator/profile/:userId
   * Get public creator profile
   */
  app.get('/creator/profile/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const viewerId = (request.query as Record<string, string>).viewerId;

    const profile = getCreatorProfileWithStats(userId, viewerId);

    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: 'CREATOR_NOT_FOUND',
      });
    }

    return reply.send({
      success: true,
      data: { profile },
    });
  });

  /**
   * PUT /creator/profile
   * Update creator profile
   */
  app.put('/creator/profile', async (request, reply) => {
    if (!CREATOR_FLAGS.creator_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'CREATOR_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
    };

    const profile = updateCreatorProfile(userId, body);
    if (!profile) {
      return reply.status(400).send({
        success: false,
        error: 'UPDATE_FAILED',
      });
    }

    return reply.send({
      success: true,
      data: { profile },
    });
  });

  // ============================================================
  // Custom Challenges
  // ============================================================

  /**
   * POST /creator/challenges
   * Create a new custom challenge
   */
  app.post('/creator/challenges', async (request, reply) => {
    if (!CREATOR_FLAGS.custom_challenges_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'CUSTOM_CHALLENGES_DISABLED',
      });
    }

    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as any;

    trackCreatorEvent(userId, 'create_clicked');

    const result = createChallenge(userId, body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    trackCreatorEvent(userId, 'challenge_created', { challengeId: result.challenge?.id });

    return reply.send({
      success: true,
      data: { challenge: result.challenge },
    });
  });

  /**
   * GET /creator/challenges
   * Get creator's challenges
   */
  app.get('/creator/challenges', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const status = (request.query as Record<string, string>).status;
    const limit = parseInt((request.query as Record<string, string>).limit ?? '20');
    const offset = parseInt((request.query as Record<string, string>).offset ?? '0');

    const challenges = getCreatorChallenges(userId, { status: status as any, limit, offset });

    return reply.send({
      success: true,
      data: { challenges },
    });
  });

  /**
   * PUT /creator/challenges/:challengeId
   * Update a custom challenge
   */
  app.put('/creator/challenges/:challengeId', async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as any;

    const result = updateChallenge(challengeId, userId, body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    return reply.send({
      success: true,
      data: { challenge: result.challenge },
    });
  });

  /**
   * POST /creator/challenges/:challengeId/publish
   * Publish a challenge
   */
  app.post('/creator/challenges/:challengeId/publish', async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    const result = publishChallenge(challengeId, userId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    trackCreatorEvent(userId, 'challenge_published', { challengeId });

    return reply.send({
      success: true,
      data: { challenge: result.challenge },
    });
  });

  /**
   * POST /creator/challenges/:challengeId/archive
   * Archive a challenge
   */
  app.post('/creator/challenges/:challengeId/archive', async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    const result = archiveChallenge(challengeId, userId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    return reply.send({
      success: true,
      data: { message: 'Challenge archived' },
    });
  });

  /**
   * GET /creator/challenges/:challengeId/link
   * Get challenge deep link
   */
  app.get('/creator/challenges/:challengeId/link', async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };

    const link = getChallengeDeepLink(challengeId);

    return reply.send({
      success: true,
      data: { link },
    });
  });

  // ============================================================
  // Creator Analytics
  // ============================================================

  /**
   * GET /creator/analytics
   * Get creator analytics
   */
  app.get('/creator/analytics', async (request, reply) => {
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const period = (request.query as Record<string, string>).period ?? 'week';

    const analytics = getCreatorAnalytics(userId, period as any);

    return reply.send({
      success: true,
      data: { analytics },
    });
  });

  // ============================================================
  // Creator Following
  // ============================================================

  /**
   * POST /creator/follow/:creatorId
   * Follow a creator
   */
  app.post('/creator/follow/:creatorId', async (request, reply) => {
    const { creatorId } = request.params as { creatorId: string };
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    const result = followCreator(userId, creatorId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    trackCreatorEvent(creatorId, 'follower_gained', { followerId: userId });

    return reply.send({
      success: true,
      data: {
        isFollowing: true,
        followerCount: result.followerCount,
      },
    });
  });

  /**
   * POST /creator/unfollow/:creatorId
   * Unfollow a creator
   */
  app.post('/creator/unfollow/:creatorId', async (request, reply) => {
    const { creatorId } = request.params as { creatorId: string };
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';

    const result = unfollowCreator(userId, creatorId);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    return reply.send({
      success: true,
      data: {
        isFollowing: false,
        followerCount: result.followerCount,
      },
    });
  });

  // ============================================================
  // Community Discovery
  // ============================================================

  /**
   * GET /community/challenges
   * Get community challenge feed
   */
  app.get('/community/challenges', async (request, reply) => {
    if (!CREATOR_FLAGS.community_discovery_enabled) {
      return reply.status(503).send({
        success: false,
        error: 'COMMUNITY_DISABLED',
      });
    }

    const query = request.query as Record<string, string>;

    const feed = getCommunityFeed({
      sort: query.sort as any,
      gameId: query.gameId as any,
      cursor: query.cursor,
      limit: parseInt(query.limit ?? '20'),
      userId: query.userId,
    });

    return reply.send({
      success: true,
      data: feed,
    });
  });

  /**
   * GET /community/challenges/trending
   * Get trending challenges
   */
  app.get('/community/challenges/trending', async (request, reply) => {
    const query = request.query as Record<string, string>;

    const feed = getCommunityFeed({
      sort: 'trending',
      gameId: query.gameId as any,
      limit: parseInt(query.limit ?? '20'),
    });

    return reply.send({
      success: true,
      data: feed,
    });
  });

  /**
   * GET /community/challenges/search
   * Search challenges
   */
  app.get('/community/challenges/search', async (request, reply) => {
    const query = request.query as Record<string, string>;

    if (!query.q) {
      return reply.status(400).send({
        success: false,
        error: 'QUERY_REQUIRED',
      });
    }

    const challenges = searchChallenges(query.q, {
      gameId: query.gameId as any,
      limit: parseInt(query.limit ?? '20'),
    });

    return reply.send({
      success: true,
      data: { challenges },
    });
  });

  /**
   * GET /community/challenges/:challengeId
   * Get challenge details
   */
  app.get('/community/challenges/:challengeId', async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };

    const challenge = getChallengeWithCreator(challengeId);
    if (!challenge) {
      return reply.status(404).send({
        success: false,
        error: 'CHALLENGE_NOT_FOUND',
      });
    }

    trackChallengeEvent(challengeId, (request.query as Record<string, string>).userId ?? 'anonymous', 'challenge_viewed');

    return reply.send({
      success: true,
      data: { challenge },
    });
  });

  /**
   * GET /creators/:creatorId/challenges
   * Get creator's public challenges
   */
  app.get('/creators/:creatorId/challenges', async (request, reply) => {
    const { creatorId } = request.params as { creatorId: string };
    const query = request.query as Record<string, string>;

    const challenges = getCreatorPublicChallenges(creatorId, {
      limit: parseInt(query.limit ?? '20'),
      offset: parseInt(query.offset ?? '0'),
    });

    return reply.send({
      success: true,
      data: { challenges },
    });
  });

  // ============================================================
  // Reporting
  // ============================================================

  /**
   * POST /community/challenges/:challengeId/report
   * Report a challenge
   */
  app.post('/community/challenges/:challengeId/report', async (request, reply) => {
    const { challengeId } = request.params as { challengeId: string };
    const userId = (request.query as Record<string, string>).userId ?? 'anonymous';
    const body = request.body as {
      reason?: string;
      description?: string;
    };

    if (!body.reason) {
      return reply.status(400).send({
        success: false,
        error: 'REASON_REQUIRED',
      });
    }

    const result = submitReport(
      userId,
      'challenge',
      challengeId,
      body.reason as any,
      body.description,
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    trackChallengeEvent(challengeId, userId, 'challenge_reported');

    return reply.send({
      success: true,
      data: { report: result.report },
    });
  });
}
