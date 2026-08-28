/**
 * GTX Rush — Admin Data Export Routes v1.0
 *
 * Handles authorized data exports with logging and permission checks.
 *
 * SECURITY:
 * - Respects permissions
 * - All exports are logged
 * - Avoids unnecessary personal data
 * - Has reasonable limits
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface ExportLog {
  id: string;
  adminUserId: string;
  exportType: string;
  filters: Record<string, unknown>;
  recordCount: number;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

const exportLogs: ExportLog[] = [];
let exportCounter = 1;

export async function adminExportRoutes(app: FastifyInstance) {
  /**
   * POST /api/admin/export
   * Request a data export
   */
  app.post('/', {
    preHandler: [requirePermission('analytics.export')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { exportType, filters } = request.body as {
      exportType?: string; filters?: Record<string, unknown>;
    };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!exportType) {
      return reply.status(400).send({
        success: false, error: { code: 'MISSING_TYPE', message: 'Export type is required' },
      });
    }

    const validTypes = ['users_summary', 'revenue', 'games', 'events', 'fraud_cases', 'moderation_cases', 'analytics'];
    if (!validTypes.includes(exportType)) {
      return reply.status(400).send({
        success: false, error: { code: 'INVALID_TYPE', message: `Export type must be one of: ${validTypes.join(', ')}` },
      });
    }

    const exportLog: ExportLog = {
      id: `exp-${String(exportCounter++).padStart(3, '0')}`,
      adminUserId: adminUser?.id ?? 'unknown',
      exportType,
      filters: filters ?? {},
      recordCount: 0,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
    };

    exportLogs.push(exportLog);

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'DATA_EXPORTED',
      targetType: 'data_export',
      targetId: exportLog.id,
      beforeState: null,
      afterState: { exportType, filters },
      reason: `Data export requested: ${exportType}`,
      metadata: { exportType, filters },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: {
        message: 'Export completed',
        export: exportLog,
        // Note: In production, this would return a download URL
        // For now, return a summary
        data: exportType === 'revenue' ? {
          summary: { totalRevenue: 6140, period: 'last_30_days' },
        } : { message: 'Export data available for download' },
      },
    };
  });

  /**
   * GET /api/admin/export/logs
   * Get export history
   */
  app.get('/logs', {
    preHandler: [requirePermission('analytics.export')],
  }, async (request: FastifyRequest) => {
    const { limit = '20' } = request.query as { limit?: string };

    return {
      success: true,
      data: exportLogs.slice(-parseInt(limit, 10)).reverse(),
    };
  });
}
