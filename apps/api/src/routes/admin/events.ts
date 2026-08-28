/**
 * GTX Rush — Admin Event Management Routes v1.0
 *
 * Handles event creation, scheduling, starting, pausing, ending, and rollback.
 *
 * SECURITY:
 * - Event guardrails validate before publishing
 * - Emergency pause preserves state
 * - Cannot edit historical results
 *
 * Contract: Admin Command Center Contract v1.0
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission, addAuditEntry } from '../../middleware/admin-auth';

interface AdminEvent {
  id: string;
  name: string;
  game: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  startsAt: Date | null;
  endsAt: Date | null;
  rules: Record<string, unknown>;
  reward: Record<string, unknown>;
  leaderboard: Record<string, unknown>;
  eligibility: Record<string, unknown>;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

const events: AdminEvent[] = [
  {
    id: 'evt-001', name: 'Summer Speed Challenge', game: 'reaction-rush',
    status: 'active', startsAt: new Date('2024-08-01'), endsAt: new Date('2024-08-31'),
    rules: { maxAttempts: 10, bestScoreCounts: true, tieBreak: 'earliest_timestamp' },
    reward: { tiers: [{ minRank: 1, maxRank: 3, xp: 500, badgeId: 'speed-champion' }] },
    leaderboard: { type: 'global', updateFrequency: 'realtime' },
    eligibility: { minLevel: 5 },
    visibility: 'public', createdAt: new Date('2024-07-25'), updatedAt: new Date(),
  },
  {
    id: 'evt-002', name: 'Weekend Tap Battle', game: 'tap-rush',
    status: 'scheduled', startsAt: new Date('2024-08-24'), endsAt: new Date('2024-08-25'),
    rules: { maxAttempts: 5, bestScoreCounts: true, tieBreak: 'latest_timestamp' },
    reward: { tiers: [{ minRank: 1, maxRank: 10, xp: 200 }] },
    leaderboard: { type: 'global', updateFrequency: 'realtime' },
    eligibility: { minLevel: 1 },
    visibility: 'public', createdAt: new Date('2024-08-15'), updatedAt: new Date(),
  },
];

let eventCounter = 3;

function validateEvent(event: Partial<AdminEvent>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!event.name) errors.push('Event name is required');
  if (!event.game) errors.push('Game is required');
  if (!event.startsAt) errors.push('Start time is required');
  if (!event.endsAt) errors.push('End time is required');
  if (event.startsAt && event.endsAt && event.startsAt >= event.endsAt) {
    errors.push('Start time must be before end time');
  }
  if (!event.reward || Object.keys(event.reward).length === 0) {
    errors.push('Reward configuration is required');
  }
  if (!event.leaderboard || Object.keys(event.leaderboard).length === 0) {
    errors.push('Leaderboard configuration is required');
  }
  return { valid: errors.length === 0, errors };
}

export async function adminEventRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/events
   * List all events
   */
  app.get('/', {
    preHandler: [requirePermission('events.view')],
  }, async (request: FastifyRequest) => {
    const { status } = request.query as { status?: string };
    let result = [...events];
    if (status) result = result.filter((e) => e.status === status);
    return { success: true, data: result };
  });

  /**
   * GET /api/admin/events/:id
   * Get event details
   */
  app.get('/:id', {
    preHandler: [requirePermission('events.view')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }
    return { success: true, data: event };
  });

  /**
   * POST /api/admin/events
   * Create a new event (draft)
   */
  app.post('/', {
    preHandler: [requirePermission('events.create')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<AdminEvent>;
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const validation = validateEvent(body);
    if (!validation.valid) {
      return reply.status(400).send({
        success: false, error: { code: 'VALIDATION_FAILED', message: validation.errors.join(', ') },
      });
    }

    const event: AdminEvent = {
      id: `evt-${String(eventCounter++).padStart(3, '0')}`,
      name: body.name!,
      game: body.game!,
      status: 'draft',
      startsAt: body.startsAt!,
      endsAt: body.endsAt!,
      rules: body.rules ?? {},
      reward: body.reward ?? {},
      leaderboard: body.leaderboard ?? {},
      eligibility: body.eligibility ?? {},
      visibility: body.visibility ?? 'public',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    events.push(event);

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: event.id,
      beforeState: null,
      afterState: { name: event.name, status: 'draft' },
      reason: 'Event created as draft',
      metadata: { game: event.game },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return reply.status(201).send({ success: true, data: event });
  });

  /**
   * PUT /api/admin/events/:id
   * Edit draft event
   */
  app.put('/:id', {
    preHandler: [requirePermission('events.edit_draft')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<AdminEvent> & { reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    if (event.status !== 'draft') {
      return reply.status(400).send({
        success: false, error: { code: 'NOT_DRAFT', message: 'Only draft events can be edited' },
      });
    }

    const beforeState = { ...event };
    if (body.name) event.name = body.name;
    if (body.game) event.game = body.game;
    if (body.startsAt) event.startsAt = body.startsAt;
    if (body.endsAt) event.endsAt = body.endsAt;
    if (body.rules) event.rules = body.rules;
    if (body.reward) event.reward = body.reward;
    if (body.leaderboard) event.leaderboard = body.leaderboard;
    if (body.eligibility) event.eligibility = body.eligibility;
    if (body.visibility) event.visibility = body.visibility;
    event.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: id,
      beforeState: { name: beforeState.name, status: beforeState.status },
      afterState: { name: event.name, status: event.status },
      reason: body.reason ?? 'Event updated',
      metadata: {},
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: event };
  });

  /**
   * POST /api/admin/events/:id/publish
   * Publish/schedule an event (validates guardrails first)
   */
  app.post('/:id/publish', {
    preHandler: [requirePermission('events.schedule')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    // Guardrails validation before publishing
    const validation = validateEvent(event);
    if (!validation.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'GUARDRAIL_FAILED', message: `Cannot publish: ${validation.errors.join(', ')}` },
      });
    }

    const beforeState = { status: event.status };
    event.status = 'scheduled';
    event.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: id,
      beforeState,
      afterState: { status: 'scheduled' },
      reason: 'Event published/scheduled',
      metadata: { name: event.name },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Event scheduled', event } };
  });

  /**
   * POST /api/admin/events/:id/start
   * Start an event
   */
  app.post('/:id/start', {
    preHandler: [requirePermission('events.start')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    if (event.status !== 'scheduled') {
      return reply.status(400).send({
        success: false, error: { code: 'INVALID_STATUS', message: 'Only scheduled events can be started' },
      });
    }

    const beforeState = { status: event.status };
    event.status = 'active';
    event.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: id,
      beforeState,
      afterState: { status: 'active' },
      reason: 'Event started',
      metadata: { name: event.name },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Event started', event } };
  });

  /**
   * POST /api/admin/events/:id/pause
   * Emergency pause (preserves state)
   */
  app.post('/:id/pause', {
    preHandler: [requirePermission('events.pause')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    const beforeState = { status: event.status };
    event.status = 'paused';
    event.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: id,
      beforeState,
      afterState: { status: 'paused' },
      reason: reason ?? 'Event paused (state preserved)',
      metadata: { name: event.name, scoresPreserved: true },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Event paused (scores preserved)', event } };
  });

  /**
   * POST /api/admin/events/:id/end
   * End an event
   */
  app.post('/:id/end', {
    preHandler: [requirePermission('events.end')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    const beforeState = { status: event.status };
    event.status = 'completed';
    event.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: id,
      beforeState,
      afterState: { status: 'completed' },
      reason: 'Event ended',
      metadata: { name: event.name },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Event ended', event } };
  });

  /**
   * POST /api/admin/events/:id/rollback
   * Rollback event to previous state
   */
  app.post('/:id/rollback', {
    preHandler: [requirePermission('events.rollback')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const adminUser = (request as FastifyRequest & { adminUser?: { id: string } }).adminUser;

    const event = events.find((e) => e.id === id);
    if (!event) {
      return reply.status(404).send({
        success: false, error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    const beforeState = { status: event.status };
    event.status = 'draft';
    event.updatedAt = new Date();

    addAuditEntry({
      adminUserId: adminUser?.id ?? 'unknown',
      action: 'EVENT_UPDATED',
      targetType: 'event',
      targetId: id,
      beforeState,
      afterState: { status: 'draft' },
      reason: reason ?? 'Event rolled back',
      metadata: { name: event.name },
      requestId: request.id,
      ipAddress: request.ip ?? null,
    });

    return { success: true, data: { message: 'Event rolled back to draft', event } };
  });
}
