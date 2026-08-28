/**
 * GTX Rush — Admin Payment Operations Routes v1.0
 *
 * Shows payment data from authoritative backend state.
 * Never exposes payment secrets.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

export async function adminPaymentRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/payments
   * List payments with filters
   */
  app.get('/', {
    preHandler: [requirePermission('payments.view')],
  }, async (request: FastifyRequest) => {
    const { status, limit = '50' } = request.query as { status?: string; limit?: string };

    // Mock payment data (production: server-verified transaction state)
    const payments = [
      {
        id: 'pay-001', userId: 'usr-001', username: 'speedking',
        product: '50 Stars Pack', amount: 50, currency: 'XTR',
        status: 'completed', transactionRef: 'tg_pay_abc123',
        createdAt: new Date('2024-08-20'),
      },
      {
        id: 'pay-002', userId: 'usr-002', username: 'quizmaster',
        product: '100 Stars Pack', amount: 100, currency: 'XTR',
        status: 'completed', transactionRef: 'tg_pay_def456',
        createdAt: new Date('2024-08-19'),
      },
      {
        id: 'pay-003', userId: 'usr-003', username: 'taptitan',
        product: '50 Stars Pack', amount: 50, currency: 'XTR',
        status: 'failed', transactionRef: 'tg_pay_ghi789',
        createdAt: new Date('2024-08-18'),
      },
    ];

    let result = payments;
    if (status) result = result.filter((p) => p.status === status);

    addAuditEntry({
      adminUserId: 'system',
      action: 'PAYMENT_INSPECTED',
      targetType: 'payments',
      targetId: null,
      beforeState: null,
      afterState: { filters: { status } },
      reason: 'Payment list viewed',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: { payments: result.slice(0, parseInt(limit, 10)), total: result.length },
    };
  });

  /**
   * GET /api/admin/payments/revenue
   * Get revenue summary
   */
  app.get('/revenue', {
    preHandler: [requirePermission('payments.view')],
  }, async () => {
    return {
      success: true,
      data: {
        starsRevenue: 4250.00,
        adRevenue: 1890.00,
        totalRevenue: 6140.00,
        purchases: 1280,
        arpu: 0.034,
        conversionRate: 0.042,
        // Clearly distinguish revenue types
        gross: { stars: 4500.00, ads: 2100.00, total: 6600.00 },
        net: { stars: 3825.00, ads: 1680.00, total: 5505.00 },
        estimated: { tomorrowStars: 4400.00, tomorrowAds: 1950.00 },
      },
    };
  });

  /**
   * GET /api/admin/payments/ad-operations
   * Get ad operations data
   */
  app.get('/ad-operations', {
    preHandler: [requirePermission('payments.view')],
  }, async () => {
    return {
      success: true,
      data: {
        adImpressions: 45000,
        rewardedAdCompletions: 12000,
        fillRate: 0.92,
        estimatedRevenue: 1890.00,
        rewardCost: 600.00,
        netAdRevenue: 1290.00,
      },
    };
  });
}
