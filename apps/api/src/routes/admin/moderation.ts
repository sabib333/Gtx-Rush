/**
 * GTX Rush — Admin Moderation Center Routes v1.0
 *
 * Handles moderation queues, reports, creator content, and profile moderation.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface ModerationCaseData {
  id: string;
  caseNumber: number;
  targetType: string;
  targetId: string;
  reportedUserId: string | null;
  reporterUserId: string | null;
  reason: string;
  evidence: Record<string, unknown>;
  status: string;
  priority: number;
  assignedTo: string | null;
  resolutionAction: string | null;
  resolutionReason: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

const moderationCases: ModerationCaseData[] = [
  {
    id: 'mc-001', caseNumber: 1, targetType: 'challenge', targetId: 'ch-001',
    reportedUserId: 'usr-003', reporterUserId: 'usr-001',
    reason: 'Inappropriate challenge title', evidence: { title: 'Offensive text here' },
    status: 'new', priority: 1, assignedTo: null,
    resolutionAction: null, resolutionReason: null, resolvedBy: null, resolvedAt: null,
    createdAt: new Date('2024-08-20'),
  },
  {
    id: 'mc-002', caseNumber: 2, targetType: 'profile', targetId: 'usr-007',
    reportedUserId: 'usr-007', reporterUserId: 'usr-002',
    reason: 'Spam in profile bio', evidence: { bio: 'Buy cheap XP at spamlink.com' },
    status: 'reviewing', priority: 2, assignedTo: 'adm-002',
    resolutionAction: null, resolutionReason: null, resolvedBy: null, resolvedAt: null,
    createdAt: new Date('2024-08-19'),
  },
];

let moderationCounter = 3;

export async function adminModerationRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/moderation
   * List moderation cases with filters
   */
  app.get('/', {
    preHandler: [requirePermission('moderation.view')],
  }, async (request: FastifyRequest) => {
    const { status, type, priority } = request.query as {
      status?: string; type?: string; priority?: string;
    };

    let result = [...moderationCases];
    if (status) result = result.filter((c) => c.status === status);
    if (type) result = result.filter((c) => c.targetType === type);
    if (priority) result = result.filter((c) => c.priority === parseInt(priority, 10));

    return {
      success: true,
      data: {
        cases: result,
        queues: {
          new: moderationCases.filter((c) => c.status === 'new').length,
          reviewing: moderationCases.filter((c) => c.status === 'reviewing').length,
          actionTaken: moderationCases.filter((c) => c.status === 'action_taken').length,
          resolved: moderationCases.filter((c) => c.status === 'resolved').length,
        },
      },
    };
  });

  /**
   * GET /api/admin/moderation/:id
   * Get moderation case details
   */
  app.get('/:id', {
    preHandler: [requirePermission('moderation.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const modCase = moderationCases.find((c) => c.id === id);
    if (!modCase) {
      return reply.status(404).send({
        success: false, error: { code: 'CASE_NOT_FOUND', message: 'Moderation case not found' },
      });
    }
    return { success: true, data: modCase };
  });

  /**
   * POST /api/admin/moderation/:id/assign
   * Assign a case to a moderator
   */
  app.post('/:id/assign', {
    preHandler: [requirePermission('moderation.review')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const modCase = moderationCases.find((c) => c.id === id);
    if (!modCase) {
      return reply.status(404).send({
        success: false, error: { code: 'CASE_NOT_FOUND', message: 'Moderation case not found' },
      });
    }

    modCase.status = 'reviewing';
    modCase.assignedTo = adminUser?.id ?? 'unknown';

    return { success: true, data: { message: 'Case assigned', case: modCase } };
  });

  /**
   * POST /api/admin/moderation/:id/action
   * Take action on a moderation case
   */
  app.post('/:id/action', {
    preHandler: [requirePermission('moderation.action')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { action, reason } = request.body as { action?: string; reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!action || !reason) {
      return reply.status(400).send({
        success: false, error: { code: 'MISSING_FIELDS', message: 'Action and reason are required' },
      });
    }

    const validActions = ['no_action', 'warning', 'content_removed', 'user_restricted', 'user_suspended'];
    if (!validActions.includes(action)) {
      return reply.status(400).send({
        success: false, error: { code: 'INVALID_ACTION', message: `Action must be one of: ${validActions.join(', ')}` },
      });
    }

    const modCase = moderationCases.find((c) => c.id === id);
    if (!modCase) {
      return reply.status(404).send({
        success: false, error: { code: 'CASE_NOT_FOUND', message: 'Moderation case not found' },
      });
    }

    const beforeState = { status: modCase.status, action: modCase.resolutionAction };
    modCase.status = 'action_taken';
    modCase.resolutionAction = action;
    modCase.resolutionReason = reason;
    modCase.resolvedBy = adminUser?.id ?? 'unknown';
    modCase.resolvedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'MODERATION_ACTION',
      targetType: 'moderation_case',
      targetId: id,
      beforeState,
      afterState: { status: modCase.status, action },
      reason,
      metadata: { targetType: modCase.targetType, targetId: modCase.targetId },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: `Moderation action '${action}' applied`, case: modCase } };
  });

  /**
   * POST /api/admin/moderation/:id/resolve
   * Mark a moderation case as resolved
   */
  app.post('/:id/resolve', {
    preHandler: [requirePermission('moderation.action')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    const modCase = moderationCases.find((c) => c.id === id);
    if (!modCase) {
      return reply.status(404).send({
        success: false, error: { code: 'CASE_NOT_FOUND', message: 'Moderation case not found' },
      });
    }

    modCase.status = 'resolved';
    modCase.resolutionReason = reason ?? modCase.resolutionReason;
    modCase.resolvedAt = new Date();

    return { success: true, data: { message: 'Case resolved', case: modCase } };
  });
}
