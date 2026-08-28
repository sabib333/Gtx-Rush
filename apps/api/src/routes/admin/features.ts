/**
 * GTX Rush — Admin Feature Flags Routes v1.0
 *
 * Handles feature flag management with audit logging and gradual rollout.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';
import { ROLLOUT_PERCENTAGES } from '@gtx-rush/config';

interface FeatureFlagData {
  id: string;
  name: string;
  displayName: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  defaultValue: boolean;
  rolloutPercentage: number;
  rolloutStrategy: string;
  targetAudience: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const featureFlags: FeatureFlagData[] = [
  {
    id: 'ff-001', name: 'new_home', displayName: 'New Home Screen',
    description: 'Redesigned home screen layout', status: 'active',
    defaultValue: false, rolloutPercentage: 25, rolloutStrategy: 'percentage',
    targetAudience: {}, metadata: {}, createdBy: 'adm-001',
    createdAt: new Date('2024-07-01'), updatedAt: new Date(),
  },
  {
    id: 'ff-002', name: 'creator_engine', displayName: 'Creator Engine',
    description: 'UGC challenge creation system', status: 'active',
    defaultValue: true, rolloutPercentage: 100, rolloutStrategy: 'percentage',
    targetAudience: {}, metadata: {}, createdBy: 'adm-001',
    createdAt: new Date('2024-06-01'), updatedAt: new Date(),
  },
  {
    id: 'ff-003', name: 'smart_recommendations', displayName: 'Smart Recommendations',
    description: 'AI-powered game recommendations', status: 'active',
    defaultValue: false, rolloutPercentage: 50, rolloutStrategy: 'percentage',
    targetAudience: {}, metadata: {}, createdBy: 'adm-001',
    createdAt: new Date('2024-07-15'), updatedAt: new Date(),
  },
  {
    id: 'ff-004', name: 'team_events', displayName: 'Team Events',
    description: 'Team-based competitive events', status: 'draft',
    defaultValue: false, rolloutPercentage: 0, rolloutStrategy: 'percentage',
    targetAudience: {}, metadata: {}, createdBy: 'adm-001',
    createdAt: new Date('2024-08-01'), updatedAt: new Date(),
  },
  {
    id: 'ff-005', name: 'new_store', displayName: 'New Store',
    description: 'Redesigned cosmetic store', status: 'inactive',
    defaultValue: false, rolloutPercentage: 0, rolloutStrategy: 'percentage',
    targetAudience: {}, metadata: {}, createdBy: 'adm-001',
    createdAt: new Date('2024-08-10'), updatedAt: new Date(),
  },
];

let flagCounter = 6;

export async function adminFeatureFlagRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/features
   * List all feature flags
   */
  app.get('/', {
    preHandler: [requirePermission('features.view')],
  }, async () => {
    return {
      success: true,
      data: {
        flags: featureFlags,
        rolloutPercentages: ROLLOUT_PERCENTAGES,
      },
    };
  });

  /**
   * GET /api/admin/features/:id
   * Get feature flag details
   */
  app.get('/:id', {
    preHandler: [requirePermission('features.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const flag = featureFlags.find((f) => f.id === id || f.name === id);
    if (!flag) {
      return reply.status(404).send({
        success: false, error: { code: 'FLAG_NOT_FOUND', message: 'Feature flag not found' },
      });
    }
    return { success: true, data: flag };
  });

  /**
   * POST /api/admin/features
   * Create a new feature flag
   */
  app.post('/', {
    preHandler: [requirePermission('features.configure')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<FeatureFlagData>;
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!body.name || !body.displayName) {
      return reply.status(400).send({
        success: false, error: { code: 'MISSING_FIELDS', message: 'Name and displayName are required' },
      });
    }

    const existing = featureFlags.find((f) => f.name === body.name);
    if (existing) {
      return reply.status(409).send({
        success: false, error: { code: 'ALREADY_EXISTS', message: 'A flag with this name already exists' },
      });
    }

    const flag: FeatureFlagData = {
      id: `ff-${String(flagCounter++).padStart(3, '0')}`,
      name: body.name,
      displayName: body.displayName,
      description: body.description ?? '',
      status: 'draft',
      defaultValue: body.defaultValue ?? false,
      rolloutPercentage: 0,
      rolloutStrategy: body.rolloutStrategy ?? 'percentage',
      targetAudience: body.targetAudience ?? {},
      metadata: body.metadata ?? {},
      createdBy: adminUser?.id ?? 'unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    featureFlags.push(flag);
    return reply.status(201).send({ success: true, data: flag });
  });

  /**
   * POST /api/admin/features/:id/toggle
   * Toggle feature flag status
   */
  app.post('/:id/toggle', {
    preHandler: [requirePermission('features.toggle')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status, rolloutPercentage, reason } = request.body as {
      status?: string; rolloutPercentage?: number; reason?: string;
    };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const flag = featureFlags.find((f) => f.id === id || f.name === id);
    if (!flag) {
      return reply.status(404).send({
        success: false, error: { code: 'FLAG_NOT_FOUND', message: 'Feature flag not found' },
      });
    }

    const beforeState = { status: flag.status, rolloutPercentage: flag.rolloutPercentage };

    if (status && ['active', 'inactive', 'draft'].includes(status)) {
      flag.status = status as FeatureFlagData['status'];
    }
    if (rolloutPercentage !== undefined) {
      flag.rolloutPercentage = Math.min(Math.max(rolloutPercentage, 0), 100);
    }
    flag.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'FEATURE_FLAG_TOGGLED',
      targetType: 'feature_flag',
      targetId: flag.id,
      beforeState,
      afterState: { status: flag.status, rolloutPercentage: flag.rolloutPercentage },
      reason: reason ?? `Feature flag '${flag.name}' updated`,
      metadata: { flagName: flag.name },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Feature flag updated', flag } };
  });
}
