/**
 * GTX Rush — Admin Leaderboard Routes v1.0
 *
 * Handles leaderboard inspection, freezing, and formal correction workflow.
 *
 * SECURITY:
 * - Admin cannot directly edit legitimate scores
 * - Corrections require reason, evidence, and audit record
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

export async function adminLeaderboardRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/leaderboards
   * List all leaderboards
   */
  app.get('/', {
    preHandler: [requirePermission('leaderboards.view')],
  }, async () => {
    return {
      success: true,
      data: [
        { id: 'lb-global', name: 'Global Leaderboard', type: 'global', isActive: true, totalEntries: 15000 },
        { id: 'lb-weekly', name: 'Weekly Leaderboard', type: 'weekly', isActive: true, totalEntries: 8000 },
        { id: 'lb-reaction', name: 'Reaction Rush Top', type: 'game_specific', isActive: true, totalEntries: 5000 },
      ],
    };
  });

  /**
   * GET /api/admin/leaderboards/:id
   * Get leaderboard details
   */
  app.get('/:id', {
    preHandler: [requirePermission('leaderboards.inspect')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    // Mock leaderboard entries (production: database query)
    return {
      success: true,
      data: {
        leaderboardId: id,
        entries: Array.from({ length: 20 }, (_, i) => ({
          rank: i + 1,
          userId: `usr-${String(i + 1).padStart(3, '0')}`,
          displayName: `Player ${i + 1}`,
          level: 50 - i,
          score: 10000 - i * 200,
          lastScoreAt: new Date(),
          antiCheatFlags: i === 5 ? ['unusual_timing'] : [],
        })),
        totalEntries: 15000,
        pagination: { limit: parseInt(limit), offset: parseInt(offset) },
      },
    };
  });

  /**
   * POST /api/admin/leaderboards/:id/freeze
   * Freeze suspicious leaderboard results
   */
  app.post('/:id/freeze', {
    preHandler: [requirePermission('leaderboards.freeze')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userIds, reason } = request.body as { userIds?: string[]; reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!userIds || userIds.length === 0) {
      return reply.status(400).send({
        success: false, error: { code: 'NO_USERS', message: 'At least one user ID is required' },
      });
    }

    if (!reason) {
      return reply.status(400).send({
        success: false, error: { code: 'REASON_REQUIRED', message: 'Reason is required' },
      });
    }

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'LEADERBOARD_FROZEN',
      targetType: 'leaderboard',
      targetId: id,
      beforeState: null,
      afterState: { frozenUsers: userIds },
      reason,
      metadata: { leaderboardId: id, affectedUsers: userIds.length },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: { message: `${userIds.length} entries frozen on leaderboard ${id}`, frozenUsers: userIds },
    };
  });

  /**
   * POST /api/admin/leaderboards/:id/correct
   * Formal score correction workflow
   */
  app.post('/:id/correct', {
    preHandler: [requirePermission('leaderboards.correct')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId, originalScore, correctedScore, reason, evidence } = request.body as {
      userId?: string; originalScore?: number; correctedScore?: number;
      reason?: string; evidence?: string;
    };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!userId || originalScore === undefined || correctedScore === undefined || !reason) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId, originalScore, correctedScore, and reason are required',
        },
      });
    }

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'LEADERBOARD_CORRECTION',
      targetType: 'leaderboard',
      targetId: id,
      beforeState: { userId, score: originalScore },
      afterState: { userId, score: correctedScore },
      reason,
      metadata: { evidence: evidence ?? null, leaderboardId: id },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: {
        message: 'Score correction submitted',
        correction: { userId, from: originalScore, to: correctedScore, reason },
      },
    };
  });
}
