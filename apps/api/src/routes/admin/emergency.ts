/**
 * GTX Rush — Admin Emergency Controls Routes v1.0
 *
 * Handles emergency kill switches with explicit confirmation workflow.
 *
 * SECURITY:
 * - Every kill-switch action requires: admin, reason, confirmation, audit
 * - Only for emergencies
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry, killSwitches } from '../../middleware/admin-auth';
import { EMERGENCY_KILL_SWITCHES } from '@gtx-rush/config';

export async function adminEmergencyRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/emergency/kill-switches
   * Get status of all emergency kill switches
   */
  app.get('/kill-switches', {
    preHandler: [requirePermission('emergency.view')],
  }, async () => {
    const switches = Object.entries(EMERGENCY_KILL_SWITCHES).map(([key, config]) => ({
      id: key,
      label: config.label,
      description: config.description,
      enabled: killSwitches.get(key) ?? false,
      requiresConfirmation: config.requiresConfirmation,
    }));

    return { success: true, data: switches };
  });

  /**
   * POST /api/admin/emergency/kill-switches/:id
   * Toggle an emergency kill switch (requires explicit confirmation)
   */
  app.post('/kill-switches/:id', {
    preHandler: [requirePermission('emergency.activate_kill_switch')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { enabled, reason, confirmation } = request.body as {
      enabled?: boolean; reason?: string; confirmation?: string;
    };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const switchConfig = EMERGENCY_KILL_SWITCHES[id as keyof typeof EMERGENCY_KILL_SWITCHES];
    if (!switchConfig) {
      return reply.status(404).send({
        success: false, error: { code: 'SWITCH_NOT_FOUND', message: 'Kill switch not found' },
      });
    }

    if (enabled === undefined || !reason) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'enabled and reason are required' },
      });
    }

    // Require explicit confirmation for activation
    if (switchConfig.requiresConfirmation && enabled) {
      if (confirmation !== `CONFIRM_${id.toUpperCase()}`) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: `Confirmation required. Send confirmation: "CONFIRM_${id.toUpperCase()}"`,
          },
        });
      }
    }

    const beforeState = { enabled: killSwitches.get(id) ?? false };
    killSwitches.set(id, enabled);

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EMERGENCY_KILL_SWITCH',
      targetType: 'kill_switch',
      targetId: id,
      beforeState,
      afterState: { enabled },
      reason,
      metadata: { switchLabel: switchConfig.label },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return {
      success: true,
      data: {
        message: `Kill switch '${switchConfig.label}' ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`,
        switch: { id, enabled, label: switchConfig.label },
      },
    };
  });
}
