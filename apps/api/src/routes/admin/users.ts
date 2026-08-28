/**
 * GTX Rush — Admin User Management Routes v1.0
 *
 * Handles user search, profile inspection, and admin actions.
 *
 * SECURITY:
 * - Never expose passwords, tokens, or secrets
 * - Dangerous actions require confirmation
 * - All actions are audit logged
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

// ============================================================
// Mock user data (production: database queries)
// ============================================================

interface MockUser {
  id: string;
  username: string;
  displayName: string;
  level: number;
  xpTotal: number;
  status: string;
  totalGamesPlayed: number;
  challenges: number;
  events: number;
  teams: number;
  isCreator: boolean;
  fraudFlags: number;
  createdAt: Date;
  lastActiveAt: Date | null;
}

const mockUsers: MockUser[] = [
  {
    id: 'usr-001', username: 'speedking', displayName: 'Speed King', level: 42,
    xpTotal: 125000, status: 'active', totalGamesPlayed: 1520, challenges: 89,
    events: 15, teams: 3, isCreator: true, fraudFlags: 0,
    createdAt: new Date('2024-01-15'), lastActiveAt: new Date(),
  },
  {
    id: 'usr-002', username: 'quizmaster', displayName: 'Quiz Master', level: 38,
    xpTotal: 98000, status: 'active', totalGamesPlayed: 980, challenges: 67,
    events: 12, teams: 2, isCreator: false, fraudFlags: 0,
    createdAt: new Date('2024-02-01'), lastActiveAt: new Date(),
  },
  {
    id: 'usr-003', username: 'taptitan', displayName: 'Tap Titan', level: 55,
    xpTotal: 210000, status: 'active', totalGamesPlayed: 2340, challenges: 120,
    events: 25, teams: 5, isCreator: true, fraudFlags: 1,
    createdAt: new Date('2024-01-05'), lastActiveAt: new Date(),
  },
  {
    id: 'usr-004', username: 'suspicious_user', displayName: 'Suspicious User', level: 5,
    xpTotal: 500000, status: 'active', totalGamesPlayed: 50, challenges: 0,
    events: 0, teams: 0, isCreator: false, fraudFlags: 5,
    createdAt: new Date('2024-08-01'), lastActiveAt: new Date(),
  },
];

export async function adminUserRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/users/search
   * Search users by ID, username, or display name
   */
  app.get('/search', {
    preHandler: [requirePermission('users.search')],
  }, async (request: FastifyRequest) => {
    const { q, status, limit = '20', offset = '0' } = request.query as {
      q?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    let results = [...mockUsers];

    if (q) {
      const query = q.toLowerCase();
      results = results.filter(
        (u) =>
          u.id.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          u.displayName.toLowerCase().includes(query),
      );
    }

    if (status) {
      results = results.filter((u) => u.status === status);
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;
    const paginatedResults = results.slice(offsetNum, offsetNum + limitNum);

    return {
      success: true,
      data: {
        users: paginatedResults,
        total: results.length,
        limit: limitNum,
        offset: offsetNum,
      },
    };
  });

  /**
   * GET /api/admin/users/:id
   * Get user profile (admin view)
   */
  app.get('/:id', {
    preHandler: [requirePermission('users.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = mockUsers.find((u) => u.id === id);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: {
        ...user,
        // Never expose sensitive data
        rewards: {
          totalXpEarned: user.xpTotal,
          totalItemsAcquired: 15,
          totalPurchases: 3,
        },
      },
    };
  });

  /**
   * POST /api/admin/users/:id/restrict
   * Restrict a user (requires confirmation)
   */
  app.post('/:id/restrict', {
    preHandler: [requirePermission('users.restrict')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!reason) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason is required for user restriction' },
      });
    }

    const user = mockUsers.find((u) => u.id === id);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const beforeState = { status: user.status };
    user.status = 'restricted';

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'USER_RESTRICTED',
      targetType: 'user',
      targetId: id,
      beforeState,
      afterState: { status: user.status },
      reason,
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: { message: 'User restricted successfully', userId: id },
    };
  });

  /**
   * POST /api/admin/users/:id/suspend
   * Suspend a user (requires confirmation)
   */
  app.post('/:id/suspend', {
    preHandler: [requirePermission('users.suspend')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!reason) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason is required for user suspension' },
      });
    }

    const user = mockUsers.find((u) => u.id === id);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const beforeState = { status: user.status };
    user.status = 'suspended';

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'USER_SUSPENDED',
      targetType: 'user',
      targetId: id,
      beforeState,
      afterState: { status: user.status },
      reason,
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: { message: 'User suspended successfully', userId: id },
    };
  });

  /**
   * POST /api/admin/users/:id/restore
   * Restore a restricted/suspended user
   */
  app.post('/:id/restore', {
    preHandler: [requirePermission('users.restore')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const user = mockUsers.find((u) => u.id === id);
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const beforeState = { status: user.status };
    user.status = 'active';

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'USER_RESTORED',
      targetType: 'user',
      targetId: id,
      beforeState,
      afterState: { status: user.status },
      reason: reason ?? 'Restored by admin',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: { message: 'User restored successfully', userId: id },
    };
  });

  /**
   * GET /api/admin/users/:id/rewards
   * View user reward history
   */
  app.get('/:id/rewards', {
    preHandler: [requirePermission('users.view_rewards')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = mockUsers.find((u) => u.id === id);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Mock reward data (production: database query)
    return {
      success: true,
      data: {
        userId: id,
        totalXpEarned: user.xpTotal,
        recentTransactions: [
          { id: 'txn-001', type: 'xp', amount: 150, source: 'game_play', date: new Date() },
          { id: 'txn-002', type: 'xp', amount: 50, source: 'daily_challenge', date: new Date() },
          { id: 'txn-003', type: 'badge', amount: 1, source: 'achievement', date: new Date() },
        ],
      },
    };
  });

  /**
   * GET /api/admin/users/:id/reports
   * View reports against a user
   */
  app.get('/:id/reports', {
    preHandler: [requirePermission('users.view_reports')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = mockUsers.find((u) => u.id === id);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: {
        userId: id,
        totalReports: user.fraudFlags,
        reports: [],
      },
    };
  });
}
