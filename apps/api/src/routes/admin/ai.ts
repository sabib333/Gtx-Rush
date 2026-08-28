/**
 * GTX Rush — Admin AI Center Routes v1.0
 *
 * 🤖 AI CENTER:
 * - GET  /api/admin/ai/models           → Active models + versions + health
 * - POST /api/admin/ai/models           → Register a new model version
 * - POST /api/admin/ai/models/status    → Transition model status
 * - POST /api/admin/ai/models/rollback  → Rollback to previous stable version
 * - GET  /api/admin/ai/reviews          → AI review queue (open cases)
 * - POST /api/admin/ai/reviews/:id      → Human review action (§29)
 * - GET  /api/admin/ai/metrics          → Model health + false-positive rates
 *
 * SECURITY:
 * - All routes require admin auth + RBAC permission
 * - Every status change and review action is audit logged
 * - Risk scores NEVER leave the admin surface to ordinary users
 *
 * Contract: Admin Command Center Contract v1.0 + AI Intelligence Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';
import {
  listModels,
  registerModel,
  setModelStatus,
  rollbackModel,
  getModelHealth,
  evaluateShadowModel,
} from '../../services/ai/model-registry';
import {
  getOpenCases,
  getReviewCase,
  resolveReviewCase,
  getReviewQueueStats,
} from '../../services/ai/review-queue';

type AdminRequest = FastifyRequest & { adminUser?: { id: string } };

export async function adminAIRoutes(app: FastifyInstance) {
  /**
   * GET /models — list all models with health metrics
   */
  app.get('/models', {
    preHandler: [requirePermission('ai.view')],
  }, async () => {
    const models = listModels();
    return {
      success: true,
      data: {
        models,
        health: models.map((m) => getModelHealth(m.modelId)).filter(Boolean),
      },
    };
  });

  /**
   * POST /models — register a new model version (starts in TEST)
   */
  app.post('/models', {
    preHandler: [requirePermission('ai.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      modelId?: string;
      kind?: string;
      version?: string;
      trainingDatasetVersion?: string;
      featureSetVersion?: string;
    };

    if (!body.modelId || !body.kind || !body.version) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'modelId, kind and version are required' },
      });
    }

    try {
      const model = registerModel({
        modelId: body.modelId,
        kind: body.kind as never,
        version: body.version,
        trainingDatasetVersion: body.trainingDatasetVersion ?? 'unversioned',
        featureSetVersion: body.featureSetVersion ?? 'v1',
      });

      addAuditEntry({
        adminUserId: (request as AdminRequest).adminUser?.id ?? 'unknown',
        action: 'AI_MODEL_REGISTERED',
        targetType: 'ai_model',
        targetId: `${body.modelId}:${body.version}`,
        beforeState: null,
        afterState: { status: model.status },
        reason: 'AI model version registered',
        metadata: { kind: body.kind },
        requestId: request.id,
        ipAddress: request.ip ?? null,
      });

      return reply.status(201).send({ success: true, data: model });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'REGISTRATION_FAILED';
      return reply.status(400).send({
        success: false,
        error: { code: message, message },
      });
    }
  });

  /**
   * POST /models/status — transition a model's lifecycle status
   */
  app.post('/models/status', {
    preHandler: [requirePermission('ai.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { modelId?: string; version?: string; status?: string };

    if (!body.modelId || !body.version || !body.status) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'modelId, version and status are required' },
      });
    }

    // Promotion gate: shadow → active requires shadow evaluation pass
    if (body.status === 'active') {
      const evaluation = evaluateShadowModel(body.modelId);
      if (!evaluation.eligibleForPromotion && evaluation.totalComparisons > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SHADOW_EVALUATION_FAILED',
            message: evaluation.reasonCode,
          },
        });
      }
    }

    const ok = setModelStatus(
      body.modelId,
      body.version,
      body.status as never,
    );
    if (!ok) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model version not found or invalid transition' },
      });
    }

    addAuditEntry({
      adminUserId: (request as AdminRequest).adminUser?.id ?? 'unknown',
      action: 'AI_MODEL_STATUS_CHANGED',
      targetType: 'ai_model',
      targetId: `${body.modelId}:${body.version}`,
      beforeState: null,
      afterState: { status: body.status },
      reason: 'AI model lifecycle transition',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: `Model set to ${body.status}` } };
  });

  /**
   * POST /models/rollback — revert to a previous stable version (§47)
   */
  app.post('/models/rollback', {
    preHandler: [requirePermission('ai.manage')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { modelId?: string; toVersion?: string };

    if (!body.modelId || !body.toVersion) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'modelId and toVersion are required' },
      });
    }

    const ok = rollbackModel(body.modelId, body.toVersion);
    if (!ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ROLLBACK_FAILED', message: 'Target version not found or retired' },
      });
    }

    addAuditEntry({
      adminUserId: (request as AdminRequest).adminUser?.id ?? 'unknown',
      action: 'AI_MODEL_ROLLBACK',
      targetType: 'ai_model',
      targetId: body.modelId,
      beforeState: null,
      afterState: { activeVersion: body.toVersion },
      reason: 'AI model rolled back',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: `Rolled back ${body.modelId} to ${body.toVersion}` } };
  });

  /**
   * GET /reviews — the AI review queue (open cases first)
   */
  app.get('/reviews', {
    preHandler: [requirePermission('ai.review')],
  }, async () => {
    return {
      success: true,
      data: {
        cases: getOpenCases(),
        stats: getReviewQueueStats(),
      },
    };
  });

  /**
   * POST /reviews/:id — human review action: confirm|dismiss|escalate|restrict
   */
  app.post('/reviews/:id', {
    preHandler: [requirePermission('ai.review')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { action, resolution } = request.body as { action?: string; resolution?: string };

    if (!action || !['confirm', 'dismiss', 'escalate', 'restrict'].includes(action)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'action must be confirm|dismiss|escalate|restrict' },
      });
    }

    const resolved = resolveReviewCase(
      id,
      action as never,
      (request as AdminRequest).adminUser?.id ?? 'unknown',
      resolution,
    );

    if (!resolved) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Case not found or already resolved' },
      });
    }

    addAuditEntry({
      adminUserId: (request as AdminRequest).adminUser?.id ?? 'unknown',
      action: 'AI_REVIEW_RESOLVED',
      targetType: 'ai_review_case',
      targetId: id,
      beforeState: { status: 'open' },
      afterState: { status: resolved.status },
      reason: resolution ?? `Human review action: ${action}`,
      metadata: { riskScore: resolved.riskScore, caseType: resolved.caseType },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: resolved };
  });

  /**
   * GET /metrics — AI Center dashboard metrics (§48)
   */
  app.get('/metrics', {
    preHandler: [requirePermission('ai.view')],
  }, async () => {
    const models = listModels();
    return {
      success: true,
      data: {
        activeModels: models.filter((m) => m.status === 'active').length,
        shadowModels: models.filter((m) => m.status === 'shadow').length,
        reviewQueue: getReviewQueueStats(),
        health: models.map((m) => getModelHealth(m.modelId)).filter(Boolean),
        shadowEvaluations: Array.from(
          new Set(models.map((m) => m.modelId)),
        ).map((modelId) => ({
          modelId,
          ...evaluateShadowModel(modelId),
        })),
      },
    };
  });
}
