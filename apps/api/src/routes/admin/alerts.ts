/**
 * GTX Rush — Admin Alerts Routes v1.0
 *
 * Handles alert management, acknowledgment, and notification.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface AlertData {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  category: string;
  status: 'active' | 'acknowledged' | 'resolved';
  source: string | null;
  metadata: Record<string, unknown>;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

const alerts: AlertData[] = [
  {
    id: 'alert-001', title: 'Fraud Spike Detected',
    message: '15 fraud flags detected in the last hour, exceeding threshold of 10',
    severity: 'critical', category: 'fraud', status: 'active',
    source: 'anti-cheat', metadata: { count: 15, threshold: 10 },
    acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null,
    createdAt: new Date('2024-08-20T14:30:00'),
  },
  {
    id: 'alert-002', title: 'Payment Processing Slow',
    message: 'Payment processing latency increased to 2.5s (threshold: 1s)',
    severity: 'warning', category: 'payments', status: 'acknowledged',
    source: 'payment-service', metadata: { latency: 2500, threshold: 1000 },
    acknowledgedBy: 'adm-001', acknowledgedAt: new Date('2024-08-20T15:00:00'), resolvedAt: null,
    createdAt: new Date('2024-08-20T14:45:00'),
  },
  {
    id: 'alert-003', title: 'DAU Milestone',
    message: 'Daily Active Users reached 12,500 (new record)',
    severity: 'info', category: 'analytics', status: 'active',
    source: 'analytics', metadata: { dau: 12500, previousRecord: 12200 },
    acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null,
    createdAt: new Date('2024-08-20T12:00:00'),
  },
];

let alertCounter = 4;

export async function adminAlertRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/alerts
   * List alerts with filters
   */
  app.get('/', {
    preHandler: [requirePermission('alerts.view')],
  }, async (request: FastifyRequest) => {
    const { status, severity, category } = request.query as {
      status?: string; severity?: string; category?: string;
    };

    let result = [...alerts];
    if (status) result = result.filter((a) => a.status === status);
    if (severity) result = result.filter((a) => a.severity === severity);
    if (category) result = result.filter((a) => a.category === category);

    return {
      success: true,
      data: {
        alerts: result,
        summary: {
          active: alerts.filter((a) => a.status === 'active').length,
          acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
          resolved: alerts.filter((a) => a.status === 'resolved').length,
        },
      },
    };
  });

  /**
   * POST /api/admin/alerts
   * Create a new alert
   */
  app.post('/', {
    preHandler: [requirePermission('alerts.create')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<AlertData>;
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!body.title || !body.message || !body.severity || !body.category) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'title, message, severity, and category are required' },
      });
    }

    const alert: AlertData = {
      id: `alert-${String(alertCounter++).padStart(3, '0')}`,
      title: body.title,
      message: body.message,
      severity: body.severity,
      category: body.category,
      status: 'active',
      source: body.source ?? null,
      metadata: body.metadata ?? {},
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: new Date(),
    };

    alerts.push(alert);

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'ALERT_CREATED',
      targetType: 'alert',
      targetId: alert.id,
      beforeState: null,
      afterState: { title: alert.title, severity: alert.severity },
      reason: 'Alert created',
      metadata: { category: alert.category },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return reply.status(201).send({ success: true, data: alert });
  });

  /**
   * POST /api/admin/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  app.post('/:id/acknowledge', {
    preHandler: [requirePermission('alerts.acknowledge')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const alert = alerts.find((a) => a.id === id);
    if (!alert) {
      return reply.status(404).send({
        success: false, error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found' },
      });
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = adminUser?.id ?? 'unknown';
    alert.acknowledgedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'ALERT_ACKNOWLEDGED',
      targetType: 'alert',
      targetId: id,
      beforeState: { status: 'active' },
      afterState: { status: 'acknowledged' },
      reason: 'Alert acknowledged',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Alert acknowledged', alert } };
  });

  /**
   * POST /api/admin/alerts/:id/resolve
   * Resolve an alert
   */
  app.post('/:id/resolve', {
    preHandler: [requirePermission('alerts.acknowledge')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const alert = alerts.find((a) => a.id === id);
    if (!alert) {
      return reply.status(404).send({
        success: false, error: { code: 'ALERT_NOT_FOUND', message: 'Alert not found' },
      });
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    return { success: true, data: { message: 'Alert resolved', alert } };
  });
}
