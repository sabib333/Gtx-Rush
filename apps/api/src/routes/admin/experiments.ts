/**
 * GTX Rush — Admin A/B Testing & Experiments Routes v1.0
 *
 * Handles experiment creation, management, and rollout.
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface ExperimentData {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: Array<{ id: string; name: string; weight: number; config: Record<string, unknown> }>;
  audience: { percentage: number; countries?: string[]; minLevel?: number };
  targetMetric: string;
  hypothesis: string;
  results: Record<string, unknown> | null;
  createdBy: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

const experiments: ExperimentData[] = [
  {
    id: 'exp-001', name: 'Smart Director v2', description: 'Improved AI game recommendations',
    status: 'completed',
    variants: [
      { id: 'control', name: 'Control', weight: 50, config: { version: 'v1' } },
      { id: 'variant-a', name: 'Smart Director v2', weight: 50, config: { version: 'v2' } },
    ],
    audience: { percentage: 100 },
    targetMetric: 'games_per_session',
    hypothesis: 'Smart recommendations increase games per session by 10%',
    results: { control: { gamesPerSession: 3.1 }, variants: { 'variant-a': { gamesPerSession: 3.5 } }, winner: 'variant-a', confidence: 0.95 },
    createdBy: 'adm-001', startedAt: new Date('2024-07-01'), endedAt: new Date('2024-08-01'),
    createdAt: new Date('2024-06-25'),
  },
  {
    id: 'exp-002', name: 'New Home Layout', description: 'Redesigned home screen with game cards',
    status: 'running',
    variants: [
      { id: 'control', name: 'Current Layout', weight: 90, config: {} },
      { id: 'variant-a', name: 'New Cards Layout', weight: 10, config: { layout: 'cards' } },
    ],
    audience: { percentage: 10 },
    targetMetric: 'first_game_rate',
    hypothesis: 'New layout increases first game rate by 5%',
    results: null,
    createdBy: 'adm-001', startedAt: new Date('2024-08-15'), endedAt: null,
    createdAt: new Date('2024-08-10'),
  },
];

let experimentCounter = 3;

export async function adminExperimentRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/experiments
   * List all experiments
   */
  app.get('/', {
    preHandler: [requirePermission('experiments.view')],
  }, async (request: FastifyRequest) => {
    const { status } = request.query as { status?: string };
    let result = [...experiments];
    if (status) result = result.filter((e) => e.status === status);
    return { success: true, data: result };
  });

  /**
   * GET /api/admin/experiments/:id
   * Get experiment details
   */
  app.get('/:id', {
    preHandler: [requirePermission('experiments.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const experiment = experiments.find((e) => e.id === id);
    if (!experiment) {
      return reply.status(404).send({
        success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' },
      });
    }
    return { success: true, data: experiment };
  });

  /**
   * POST /api/admin/experiments
   * Create a new experiment
   */
  app.post('/', {
    preHandler: [requirePermission('experiments.create')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<ExperimentData>;
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    if (!body.name || !body.variants || body.variants.length === 0) {
      return reply.status(400).send({
        success: false, error: { code: 'MISSING_FIELDS', message: 'Name and variants are required' },
      });
    }

    const experiment: ExperimentData = {
      id: `exp-${String(experimentCounter++).padStart(3, '0')}`,
      name: body.name,
      description: body.description ?? '',
      status: 'draft',
      variants: body.variants,
      audience: body.audience ?? { percentage: 100 },
      targetMetric: body.targetMetric ?? '',
      hypothesis: body.hypothesis ?? '',
      results: null,
      createdBy: adminUser?.id ?? 'unknown',
      startedAt: null,
      endedAt: null,
      createdAt: new Date(),
    };

    experiments.push(experiment);

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EXPERIMENT_CREATED',
      targetType: 'experiment',
      targetId: experiment.id,
      beforeState: null,
      afterState: { name: experiment.name, status: 'draft' },
      reason: 'Experiment created',
      metadata: { variantCount: experiment.variants.length },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return reply.status(201).send({ success: true, data: experiment });
  });

  /**
   * POST /api/admin/experiments/:id/start
   * Start a draft experiment
   */
  app.post('/:id/start', {
    preHandler: [requirePermission('experiments.update')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const experiment = experiments.find((e) => e.id === id);
    if (!experiment) {
      return reply.status(404).send({
        success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' },
      });
    }

    if (experiment.status !== 'draft') {
      return reply.status(400).send({
        success: false, error: { code: 'INVALID_STATUS', message: 'Only draft experiments can be started' },
      });
    }

    experiment.status = 'running';
    experiment.startedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EXPERIMENT_UPDATED',
      targetType: 'experiment',
      targetId: id,
      beforeState: { status: 'draft' },
      afterState: { status: 'running' },
      reason: 'Experiment started',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Experiment started', experiment } };
  });

  /**
   * POST /api/admin/experiments/:id/pause
   * Pause a running experiment
   */
  app.post('/:id/pause', {
    preHandler: [requirePermission('experiments.pause')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const experiment = experiments.find((e) => e.id === id);
    if (!experiment) {
      return reply.status(404).send({
        success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' },
      });
    }

    experiment.status = 'paused';

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EXPERIMENT_PAUSED',
      targetType: 'experiment',
      targetId: id,
      beforeState: { status: 'running' },
      afterState: { status: 'paused' },
      reason: 'Experiment paused',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Experiment paused', experiment } };
  });

  /**
   * POST /api/admin/experiments/:id/complete
   * Complete an experiment
   */
  app.post('/:id/complete', {
    preHandler: [requirePermission('experiments.complete')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { results } = request.body as { results?: Record<string, unknown> };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const experiment = experiments.find((e) => e.id === id);
    if (!experiment) {
      return reply.status(404).send({
        success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' },
      });
    }

    experiment.status = 'completed';
    experiment.endedAt = new Date();
    if (results) experiment.results = results;

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EXPERIMENT_COMPLETED',
      targetType: 'experiment',
      targetId: id,
      beforeState: { status: experiment.status === 'completed' ? 'running' : experiment.status },
      afterState: { status: 'completed' },
      reason: 'Experiment completed',
      metadata: { results: results ?? null },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Experiment completed', experiment } };
  });
}
