/**
 * Social Engine — API Routes v1.0
 *
 * Handles:
 * - GET  /api/social/friends          → Get friends list
 * - POST /api/social/friends/request  → Send friend request
 * - POST /api/social/friends/accept   → Accept friend request
 * - POST /api/social/friends/decline  → Decline friend request
 * - POST /api/social/friends/block    → Block a user
 * - POST /api/social/friends/unblock  → Unblock a user
 *
 * - GET  /api/teams                   → List teams
 * - POST /api/teams                   → Create team
 * - GET  /api/teams/:id               → Get team details
 * - POST /api/teams/:id/join          → Join team
 * - POST /api/teams/:id/leave         → Leave team
 * - POST /api/teams/:id/invite        → Create team invite
 * - POST /api/teams/invite/:code      → Accept team invite
 * - GET  /api/teams/:id/members       → Get team members
 * - GET  /api/teams/:id/leaderboard   → Get team leaderboard
 *
 * - GET  /api/feed                    → Get user feed
 * - POST /api/feed/:id/react          → React to feed event
 *
 * SECURITY:
 * - Social permissions are server-authoritative
 * - Private information is never exposed
 * - Rate limiting prevents spam
 * - Block system prevents unwanted interactions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getUserFriends,
  getPendingFriendRequests,
  areFriends,
  isBlocked,
  _clearFriendSystem,
} from '../services/friend-system';
import {
  createTeam,
  getTeam,
  getUserTeam,
  joinTeam,
  leaveTeam,
  createTeamInvite,
  acceptTeamInvite,
  getTeamMembers,
  getTeamLeaderboard,
  updateTeam,
  awardTeamXp,
  _clearTeamEngine,
} from '../services/team-engine';
import {
  getUserFeed,
  getTeamFeed,
  getFeedEvent,
  addReaction,
  removeReaction,
  createLevelUpEvent,
  createRankChangeEvent,
  createChallengeWonEvent,
  createBadgeUnlockedEvent,
  _clearSocialFeed,
} from '../services/social-feed';
import {
  trackFriendProfileViewed,
  trackFriendRequestSent,
  trackFriendRequestAccepted,
  trackTeamViewed,
  trackTeamCreated,
  trackTeamJoined,
  trackFeedViewed,
  trackFeedReaction,
} from '../services/social-analytics';
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

export async function socialRoutes(app: FastifyInstance) {
  // Apply rate limiting to all social routes
  await app.addHook('onRequest', generalRateLimit);

  // ============================================================
  // Friend Routes
  // ============================================================

  /**
   * GET /api/social/friends
   *
   * Get the user's friends list.
   */
  app.get('/social/friends', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const friends = getUserFriends(userId);
    const pendingRequests = getPendingFriendRequests(userId);

    return {
      success: true,
      data: {
        friends,
        totalCount: friends.length,
        pendingRequests: pendingRequests.received.length,
      },
    };
  });

  /**
   * POST /api/social/friends/request
   *
   * Send a friend request.
   */
  app.post('/social/friends/request', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { toUserId, message } = request.body as {
      toUserId: string;
      message?: string;
    };

    if (!toUserId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'toUserId is required' },
      });
    }

    const result = sendFriendRequest(userId, toUserId, message ?? null);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackFriendRequestSent(userId, toUserId);

    return {
      success: true,
      data: {
        request: result.request ? {
          id: result.request.id,
          toUserId: result.request.toUserId,
          status: result.request.status,
          createdAt: result.request.createdAt.toISOString(),
        } : null,
      },
    };
  });

  /**
   * POST /api/social/friends/accept
   *
   * Accept a friend request.
   */
  app.post('/social/friends/accept', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { requestId } = request.body as { requestId: string };

    if (!requestId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'requestId is required' },
      });
    }

    const result = acceptFriendRequest(userId, requestId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackFriendRequestAccepted(userId, requestId);

    return {
      success: true,
      data: { accepted: true },
    };
  });

  /**
   * POST /api/social/friends/decline
   *
   * Decline a friend request.
   */
  app.post('/social/friends/decline', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { requestId } = request.body as { requestId: string };

    const result = declineFriendRequest(userId, requestId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: { declined: true },
    };
  });

  /**
   * POST /api/social/friends/block
   *
   * Block a user.
   */
  app.post('/social/friends/block', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { blockedUserId, reason } = request.body as {
      blockedUserId: string;
      reason?: string;
    };

    if (!blockedUserId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'blockedUserId is required' },
      });
    }

    const result = blockUser(userId, blockedUserId, reason ?? null);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: { blocked: true },
    };
  });

  /**
   * POST /api/social/friends/unblock
   *
   * Unblock a user.
   */
  app.post('/social/friends/unblock', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { blockedUserId } = request.body as { blockedUserId: string };

    const result = unblockUser(userId, blockedUserId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: { unblocked: true },
    };
  });

  // ============================================================
  // Team Routes
  // ============================================================

  /**
   * GET /api/teams
   *
   * List teams.
   */
  app.get('/teams', async (request, reply) => {
    const { search, privacy, limit, cursor } = request.query as {
      search?: string;
      privacy?: string;
      limit?: string;
      cursor?: string;
    };

    // In production, query database with filters
    // For MVP, return empty list
    return {
      success: true,
      data: {
        teams: [],
        totalCount: 0,
        pagination: { nextCursor: null, hasMore: false },
      },
    };
  });

  /**
   * POST /api/teams
   *
   * Create a new team.
   */
  app.post('/teams', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { name, tag, description, privacy, maxMembers } = request.body as {
      name: string;
      tag: string;
      description?: string;
      privacy?: string;
      maxMembers?: number;
    };

    if (!name || !tag) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'name and tag are required' },
      });
    }

    const result = createTeam(userId, {
      name,
      tag,
      description,
      privacy: privacy as any,
      maxMembers,
    });

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackTeamCreated(userId, result.team!.id, name);

    return {
      success: true,
      data: {
        team: result.team ? {
          id: result.team.id,
          name: result.team.name,
          tag: result.team.tag,
          description: result.team.description,
          privacy: result.team.privacy,
          maxMembers: result.team.maxMembers,
          currentMembers: result.team.currentMembers,
          createdAt: result.team.createdAt.toISOString(),
        } : null,
      },
    };
  });

  /**
   * GET /api/teams/:id
   *
   * Get team details.
   */
  app.get('/teams/:id', async (request, reply) => {
    const userId = getUserId(request);
    const { id: teamId } = request.params as { id: string };

    const team = getTeam(teamId);
    if (!team) {
      return reply.status(404).send({
        success: false,
        error: { code: 'TEAM_NOT_FOUND', message: 'Team not found' },
      });
    }

    // Track analytics
    if (userId) {
      trackTeamViewed(userId, teamId);
    }

    return {
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          tag: team.tag,
          description: team.description,
          avatarUrl: team.avatarUrl,
          privacy: team.privacy,
          maxMembers: team.maxMembers,
          currentMembers: team.currentMembers,
          teamLevel: team.teamLevel,
          teamXp: team.teamXp,
          teamRank: team.teamRank,
          createdAt: team.createdAt.toISOString(),
        },
        isMember: userId ? getUserTeam(userId)?.id === teamId : false,
      },
    };
  });

  /**
   * POST /api/teams/:id/join
   *
   * Join a public team.
   */
  app.post('/teams/:id/join', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: teamId } = request.params as { id: string };

    const result = joinTeam(teamId, userId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackTeamJoined(userId, teamId, null);

    return {
      success: true,
      data: { joined: true },
    };
  });

  /**
   * POST /api/teams/:id/leave
   *
   * Leave a team.
   */
  app.post('/teams/:id/leave', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: teamId } = request.params as { id: string };

    const result = leaveTeam(teamId, userId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: { left: true },
    };
  });

  /**
   * POST /api/teams/:id/invite
   *
   * Create a team invite.
   */
  app.post('/teams/:id/invite', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: teamId } = request.params as { id: string };
    const { invitedUserId, message } = request.body as {
      invitedUserId?: string;
      message?: string;
    };

    const result = createTeamInvite(teamId, userId, invitedUserId ?? null, message ?? null);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    return {
      success: true,
      data: {
        invite: result.invite ? {
          id: result.invite.id,
          inviteCode: result.invite.inviteCode,
          expiresAt: result.invite.expiresAt.toISOString(),
        } : null,
      },
    };
  });

  /**
   * POST /api/teams/invite/:code
   *
   * Accept a team invite.
   */
  app.post('/teams/invite/:code', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { code: inviteCode } = request.params as { code: string };

    const result = acceptTeamInvite(userId, inviteCode);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackTeamJoined(userId, result.team!.id, inviteCode);

    return {
      success: true,
      data: {
        team: result.team ? {
          id: result.team.id,
          name: result.team.name,
        } : null,
      },
    };
  });

  /**
   * GET /api/teams/:id/members
   *
   * Get team members.
   */
  app.get('/teams/:id/members', async (request, reply) => {
    const { id: teamId } = request.params as { id: string };

    const members = getTeamMembers(teamId);

    return {
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          contributionXp: m.contributionXp,
          joinedAt: m.joinedAt.toISOString(),
          profile: m.profile,
        })),
        totalCount: members.length,
      },
    };
  });

  /**
   * GET /api/teams/:id/leaderboard
   *
   * Get team leaderboard.
   */
  app.get('/teams/:id/leaderboard', async (request, reply) => {
    const { id: teamId } = request.params as { id: string };

    const leaderboard = getTeamLeaderboard(teamId);

    return {
      success: true,
      data: {
        entries: leaderboard,
        totalMembers: leaderboard.length,
      },
    };
  });

  // ============================================================
  // Feed Routes
  // ============================================================

  /**
   * GET /api/feed
   *
   * Get user's activity feed.
   */
  app.get('/feed', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { cursor, limit } = request.query as { cursor?: string; limit?: string };

    const feed = getUserFeed(userId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    // Track analytics
    trackFeedViewed(userId, 'personal');

    return {
      success: true,
      data: feed,
    };
  });

  /**
   * POST /api/feed/:id/react
   *
   * React to a feed event.
   */
  app.post('/feed/:id/react', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: feedEventId } = request.params as { id: string };
    const { type } = request.body as { type: string };

    if (!type) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'type is required' },
      });
    }

    const result = addReaction(feedEventId, userId, type as any);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackFeedReaction(userId, feedEventId, type);

    return {
      success: true,
      data: {
        reaction: result.reaction ? {
          id: result.reaction.id,
          type: result.reaction.type,
          createdAt: result.reaction.createdAt.toISOString(),
        } : null,
      },
    };
  });
}
