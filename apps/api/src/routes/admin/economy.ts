/**
 * GTX Rush — Admin Economy Operations Routes v1.0
 *
 * Handles economy inspection, reward adjustment, and transaction review.
 *
 * SECURITY:
 * - No arbitrary balance editing
 * - Corrections use formal adjustment workflow
 * - All adjustments are audit logged
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

export async function adminEconomyRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/economy/overview
   * Get economy overview stats
   */
  app.get('/overview', {
    preHandler: [requirePermission('economy.view')],
  }, async () => {
    return {
      success: true,
      data: {
        dailyXpIssued: 250000,
        dailyRewardsIssued: 1200,
        dailyItemsAcquired: 350,
        totalOutstandingXp: 15000000,
        purchaseVolume: 4250,
        anomalyCount: 2,
        topXpSources: [
          { source: 'game_play', amount: 150000 },
          { source: 'daily_challenge', amount: 50000 },
          { source: 'achievements', amount: 30000 },
          { source: 'streak_bonus', amount: 20000 },
        ],
      },
    };
  });

  /**
   * GET /api/admin/economy/transactions
   * View XP transactions
   */
  app.get('/transactions', {
    preHandler: [requirePermission('economy.inspect_transactions')],
  }, async (request: FastifyRequest) => {
    const { userId, source, limit = '50', offset = '0' } = request.query as {
      userId?: string; source?: string; limit?: string; offset?: string;
    };

    // Mock transaction data (production: database query)
    const transactions = [
      { id: 'txn-001', userId: 'usr-001', amount: 150, source: 'game_play', balanceAfter: 125150, createdAt: new Date() },
      { id: 'txn-002', userId: 'usr-002', amount: 50, source: 'daily_challenge', balanceAfter: 98050, createdAt: new Date() },
      { id: 'txn-003', userId: 'usr-003', amount: 200, source: 'achievement', balanceAfter: 210200, createdAt: new Date() },
    ];

    let result = transactions;
    if (userId) result = result.filter((t) => t.userId === userId);
    if (source) result = result.filter((t) => t.source === source);

    return {
      success: true,
      data: {
        transactions: result.slice(0, parseInt(limit, 10)),
        total: result.length,
      },
    };
  });

  /**
   * POST /api/admin/economy/adjust
   * Create a formal reward adjustment
   */
  app.post('/adjust', {
    preHandler: [requirePermission('economy.adjust_reward')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, originalTransactionId, adjustment, reason, evidence } = request.body as {
      userId?: string; originalTransactionId?: string; adjustment?: number;
      reason?: string; evidence?: string;
    };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!userId || adjustment === undefined || !reason) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'userId, adjustment, and reason are required',
        },
      });
    }

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'REWARD_ADJUSTMENT',
      targetType: 'user',
      targetId: userId,
      beforeState: { originalTransaction: originalTransactionId ?? null },
      afterState: { adjustment },
      reason,
      metadata: { evidence: evidence ?? null, adjustment },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: {
        message: 'Reward adjustment created',
        adjustment: {
          userId,
          originalTransaction: originalTransactionId,
          adjustment,
          reason,
          evidence,
          admin: adminUser?.id,
          timestamp: new Date(),
        },
      },
    };
  });
}
