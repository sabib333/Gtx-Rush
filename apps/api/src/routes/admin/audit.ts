/**
 * GTX Rush — Admin Audit Log Routes v1.0
 *
 * Provides read-only access to the admin audit log.
 * The audit log is immutable — entries cannot be modified or deleted.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '../../middleware/admin-auth';
import { adminAuditLog } from '../../middleware/admin-auth';

export async function adminAuditRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/audit
   * Get audit log entries with filters
   */
  app.get('/', {
    preHandler: [requirePermission('audit.view')],
  }, async (request: FastifyRequest) => {
    const { action, targetType, adminUserId, limit = '50', offset = '0' } = request.query as {
      action?: string; targetType?: string; adminUserId?: string;
      limit?: string; offset?: string;
    };

    let result = [...adminAuditLog];

    if (action) result = result.filter((e) => e.action === action);
    if (targetType) result = result.filter((e) => e.targetType === targetType);
    if (adminUserId) result = result.filter((e) => e.adminUserId === adminUserId);

    // Sort by newest first
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = parseInt(offset, 10) || 0;
    const paginatedResult = result.slice(offsetNum, offsetNum + limitNum);

    return {
      success: true,
      data: {
        entries: paginatedResult.map((e) => ({
          id: e.id,
          adminUserId: e.adminUserId,
          action: e.action,
          targetType: e.targetType,
          targetId: e.targetId,
          beforeState: e.beforeState,
          afterState: e.afterState,
          reason: e.reason,
          metadata: e.metadata,
          ipAddress: e.ipAddress,
          createdAt: e.createdAt,
        })),
        total: result.length,
        limit: limitNum,
        offset: offsetNum,
      },
    };
  });

  /**
   * GET /api/admin/audit/:id
   * Get a specific audit log entry
   */
  app.get('/:id', {
    preHandler: [requirePermission('audit.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const entry = adminAuditLog.find((e) => e.id === id);

    if (!entry) {
      return reply.status(404).send({
        success: false, error: { code: 'ENTRY_NOT_FOUND', message: 'Audit entry not found' },
      });
    }

    return {
      success: true,
      data: {
        id: entry.id,
        adminUserId: entry.adminUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        beforeState: entry.beforeState,
        afterState: entry.afterState,
        reason: entry.reason,
        metadata: entry.metadata,
        requestId: entry.requestId,
        ipAddress: entry.ipAddress,
        createdAt: entry.createdAt,
      },
    };
  });

  /**
   * GET /api/admin/audit/stats
   * Get audit statistics
   */
  app.get('/stats', {
    preHandler: [requirePermission('audit.view')],
  }, async () => {
    const actionCounts: Record<string, number> = {};
    for (const entry of adminAuditLog) {
      actionCounts[entry.action] = (actionCounts[entry.action] ?? 0) + 1;
    }

    return {
      success: true,
      data: {
        totalEntries: adminAuditLog.length,
        actionCounts,
        oldestEntry: adminAuditLog[0]?.createdAt ?? null,
        newestEntry: adminAuditLog[adminAuditLog.length - 1]?.createdAt ?? null,
      },
    };
  });
}
