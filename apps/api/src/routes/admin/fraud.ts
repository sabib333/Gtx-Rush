/**
 * GTX Rush — Admin Fraud Center Routes v1.0
 *
 * Handles fraud detection review, actions, and case management.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface FraudCaseData {
  id: string;
  caseNumber: number;
  userId: string;
  username: string;
  flagType: string;
  severity: string;
  description: string;
  evidence: Record<string, unknown>;
  status: string;
  action: string | null;
  actionReason: string | null;
  reviewedBy: string | null;
  createdAt: Date;
}

const fraudCases: FraudCaseData[] = [
  {
    id: 'fc-001', caseNumber: 1, userId: 'usr-004', username: 'suspicious_user',
    flagType: 'impossible_score', severity: 'high',
    description: 'Score 10x higher than any recorded score in Reaction Rush',
    evidence: { reportedScore: 99999, maxExpected: 9500, sessions: 3 },
    status: 'detected', action: null, actionReason: null, reviewedBy: null,
    createdAt: new Date('2024-08-20'),
  },
  {
    id: 'fc-002', caseNumber: 2, userId: 'usr-005', username: 'bot_player',
    flagType: 'bot_behavior', severity: 'critical',
    description: 'Inhumanly consistent timing between inputs',
    evidence: { avgTiming: 50, stddev: 0.1, sessionCount: 50 },
    status: 'reviewing', action: null, actionReason: null, reviewedBy: 'adm-001',
    createdAt: new Date('2024-08-19'),
  },
  {
    id: 'fc-003', caseNumber: 3, userId: 'usr-006', username: 'referral_abuser',
    flagType: 'referral_abuse', severity: 'medium',
    description: 'Multiple accounts from same device fingerprint',
    evidence: { deviceFingerprint: 'fp-abc123', accountCount: 12 },
    status: 'detected', action: null, actionReason: null, reviewedBy: null,
    createdAt: new Date('2024-08-18'),
  },
];

let fraudCounter = 4;

export async function adminFraudRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/fraud
   * List fraud cases with filters
   */
  app.get('/', {
    preHandler: [requirePermission('fraud.view')],
  }, async (request: FastifyRequest) => {
    const { status, severity, flagType } = request.query as {
      status?: string; severity?: string; flagType?: string;
    };

    let result = [...fraudCases];
    if (status) result = result.filter((c) => c.status === status);
    if (severity) result = result.filter((c) => c.severity === severity);
    if (flagType) result = result.filter((c) => c.flagType === flagType);

    return {
      success: true,
      data: {
        cases: result,
        summary: {
          total: fraudCases.length,
          detected: fraudCases.filter((c) => c.status === 'detected').length,
          reviewing: fraudCases.filter((c) => c.status === 'reviewing').length,
          resolved: fraudCases.filter((c) => c.status === 'resolved').length,
        },
      },
    };
  });

  /**
   * GET /api/admin/fraud/:id
   * Get fraud case details
   */
  app.get('/:id', {
    preHandler: [requirePermission('fraud.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const fraudCase = fraudCases.find((c) => c.id === id);
    if (!fraudCase) {
      return reply.status(404).send({
        success: false, error: { code: 'CASE_NOT_FOUND', message: 'Fraud case not found' },
      });
    }
    return { success: true, data: fraudCase };
  });

  /**
   * POST /api/admin/fraud/:id/action
   * Take action on a fraud case
   */
  app.post('/:id/action', {
    preHandler: [requirePermission('fraud.mark_review')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { action, reason } = request.body as { action?: string; reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!action || !reason) {
      return reply.status(400).send({
        success: false, error: { code: 'MISSING_FIELDS', message: 'Action and reason are required' },
      });
    }

    const validActions = ['mark_review', 'freeze_reward', 'restrict', 'suspend', 'clear_flag'];
    if (!validActions.includes(action)) {
      return reply.status(400).send({
        success: false, error: { code: 'INVALID_ACTION', message: `Action must be one of: ${validActions.join(', ')}` },
      });
    }

    const fraudCase = fraudCases.find((c) => c.id === id);
    if (!fraudCase) {
      return reply.status(404).send({
        success: false, error: { code: 'CASE_NOT_FOUND', message: 'Fraud case not found' },
      });
    }

    const beforeState = { status: fraudCase.status, action: fraudCase.action };
    fraudCase.status = action === 'clear_flag' ? 'dismissed' : 'action_taken';
    fraudCase.action = action;
    fraudCase.actionReason = reason;
    fraudCase.reviewedBy = adminUser?.id ?? 'unknown';

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'FRAUD_ACTION',
      targetType: 'fraud_case',
      targetId: id,
      beforeState,
      afterState: { status: fraudCase.status, action: fraudCase.action },
      reason,
      metadata: { userId: fraudCase.userId, flagType: fraudCase.flagType, severity: fraudCase.severity },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: `Fraud action '${action}' applied`, fraudCase } };
  });
}
