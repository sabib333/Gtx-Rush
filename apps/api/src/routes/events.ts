/**
 * Live Events — API Routes v1.0
 *
 * Handles:
 * - GET  /api/events              → List all events
 * - GET  /api/events/live         → Get live events
 * - GET  /api/events/upcoming     → Get upcoming events
 * - GET  /api/events/:id          → Get event details
 * - POST /api/events/:id/join     → Join an event
 * - GET  /api/events/:id/status   → Get event status
 * - GET  /api/events/:id/leaderboard → Get event leaderboard
 * - POST /api/events/:id/submit   → Submit event score
 * - GET  /api/events/history      → Get user event history
 *
 * SECURITY:
 * - Event state is server-authoritative
 * - Score validation is server-side
 * - Attempt limits are server-controlled
 * - Rewards are idempotent
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getEvent,
  getAllEvents,
  getActiveEvents,
  getUpcomingEvents,
  getLiveEvents,
  joinEvent,
  getParticipant,
  submitEventAttempt,
  getEventLeaderboard,
  getUserEventHistory,
  checkEventStatuses,
} from '../services/event-engine';
import {
  trackEventViewed,
  trackEventJoined,
  trackEventScoreSubmitted,
  trackEventRankChanged,
} from '../services/event-analytics';
import { generalRateLimit } from '../middleware/rate-limiter';

// ============================================================
// Mock auth helper (replace with real JWT verification)
// ============================================================

function getUserId(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (token === 'mock-token' || token.startsWith('dev-')) {
    return 'dev-user-001';
  }

  // TODO: Verify JWT and extract real user ID
  return 'dev-user-001';
}

// ============================================================
// Routes
// ============================================================

export async function eventRoutes(app: FastifyInstance) {
  // Apply rate limiting to all event routes
  await app.addHook('onRequest', generalRateLimit);

  /**
   * GET /api/events
   *
   * List all events with optional filters.
   */
  app.get('/events', async (request, reply) => {
    const { type, status, limit, cursor } = request.query as {
      type?: string;
      status?: string;
      limit?: string;
      cursor?: string;
    };

    let events = getAllEvents();

    // Apply filters
    if (type) {
      events = events.filter((e) => e.type === type);
    }
    if (status) {
      events = events.filter((e) => e.status === status);
    }

    // Sort by start time (newest first)
    events.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

    // Pagination
    const limitNum = limit ? parseInt(limit, 10) : 20;
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = events.findIndex((e) => e.id === cursor);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const paginated = events.slice(startIndex, startIndex + limitNum);
    const hasMore = startIndex + limitNum < events.length;
    const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

    return {
      success: true,
      data: {
        events: paginated.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          status: e.status,
          gameId: e.gameId,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
        })),
        pagination: { nextCursor, hasMore },
      },
    };
  });

  /**
   * GET /api/events/live
   *
   * Get live events for discovery.
   */
  app.get('/events/live', async (request, reply) => {
    const liveEvents = getLiveEvents();

    return {
      success: true,
      data: {
        live: liveEvents.live.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          gameId: e.gameId,
          endsAt: e.endsAt.toISOString(),
          timeRemaining: Math.max(0, e.endsAt.getTime() - Date.now()),
        })),
        upcoming: liveEvents.upcoming.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          gameId: e.gameId,
          startsAt: e.startsAt.toISOString(),
          timeUntilStart: Math.max(0, e.startsAt.getTime() - Date.now()),
        })),
        completed: liveEvents.completed.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          gameId: e.gameId,
          endsAt: e.endsAt.toISOString(),
        })),
      },
    };
  });

  /**
   * GET /api/events/upcoming
   *
   * Get upcoming events.
   */
  app.get('/events/upcoming', async (request, reply) => {
    const upcoming = getUpcomingEvents();

    return {
      success: true,
      data: {
        events: upcoming.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          gameId: e.gameId,
          startsAt: e.startsAt.toISOString(),
          timeUntilStart: Math.max(0, e.startsAt.getTime() - Date.now()),
        })),
      },
    };
  });

  /**
   * GET /api/events/:id
   *
   * Get event details with user participation info.
   */
  app.get('/events/:id', async (request, reply) => {
    const userId = getUserId(request);
    const { id: eventId } = request.params as { id: string };

    const event = getEvent(eventId);
    if (!event) {
      return reply.status(404).send({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    // Track analytics
    if (userId) {
      trackEventViewed(userId, eventId, event.type);
    }

    const participant = userId ? getParticipant(eventId, userId) : null;
    const isActive = event.status === 'active' || event.status === 'ending';
    const timeRemaining = Math.max(0, event.endsAt.getTime() - Date.now());

    return {
      success: true,
      data: {
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          type: event.type,
          status: event.status,
          gameId: event.gameId,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          rules: event.rules,
          scoringConfig: event.scoringConfig,
          rewardConfig: event.rewardConfig,
          eligibilityConfig: event.eligibilityConfig,
        },
        participant: participant ? {
          id: participant.id,
          status: participant.status,
          attemptCount: participant.attemptCount,
          bestScore: participant.bestScore,
          eventScore: participant.eventScore,
          rank: participant.rank,
        } : null,
        isActive,
        timeRemaining,
      },
    };
  });

  /**
   * POST /api/events/:id/join
   *
   * Join an event.
   */
  app.post('/events/:id/join', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: eventId } = request.params as { id: string };

    const result = joinEvent(eventId, userId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    const event = getEvent(eventId);
    if (event) {
      trackEventJoined(userId, eventId, event.type);
    }

    return {
      success: true,
      data: {
        participant: result.participant ? {
          id: result.participant.id,
          status: result.participant.status,
          joinedAt: result.participant.joinedAt.toISOString(),
        } : null,
      },
    };
  });

  /**
   * GET /api/events/:id/status
   *
   * Get event status.
   */
  app.get('/events/:id/status', async (request, reply) => {
    const { id: eventId } = request.params as { id: string };

    const event = getEvent(eventId);
    if (!event) {
      return reply.status(404).send({
        success: false,
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    return {
      success: true,
      data: {
        eventId: event.id,
        status: event.status,
        isActive: event.status === 'active' || event.status === 'ending',
        timeRemaining: Math.max(0, event.endsAt.getTime() - Date.now()),
      },
    };
  });

  /**
   * GET /api/events/:id/leaderboard
   *
   * Get event leaderboard.
   */
  app.get('/events/:id/leaderboard', async (request, reply) => {
    const userId = getUserId(request);
    const { id: eventId } = request.params as { id: string };
    const { cursor, limit } = request.query as { cursor?: string; limit?: string };

    const leaderboard = getEventLeaderboard(eventId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 50,
      currentUserId: userId ?? undefined,
    });

    return {
      success: true,
      data: leaderboard,
    };
  });

  /**
   * POST /api/events/:id/submit
   *
   * Submit an event score.
   */
  app.post('/events/:id/submit', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { id: eventId } = request.params as { id: string };
    const { sessionId, gameScore } = request.body as {
      sessionId: string;
      gameScore: number;
    };

    if (!sessionId || gameScore === undefined) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'sessionId and gameScore are required' },
      });
    }

    const participant = getParticipant(eventId, userId);
    const previousRank = participant?.rank ?? null;

    const result = submitEventAttempt(eventId, userId, sessionId, gameScore);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: { code: result.error, message: result.error },
      });
    }

    // Track analytics
    trackEventScoreSubmitted(userId, eventId, gameScore, result.eventScore, null);

    // Check for rank change
    if (participant && previousRank !== null) {
      const rankChange = previousRank - (participant.rank ?? previousRank);
      if (rankChange !== 0) {
        trackEventRankChanged(userId, eventId, previousRank, participant.rank ?? previousRank, rankChange);
      }
    }

    return {
      success: true,
      data: {
        attempt: result.attempt ? {
          id: result.attempt.id,
          gameScore: result.attempt.gameScore,
          eventScore: result.attempt.eventScore,
          attemptNumber: result.attempt.attemptNumber,
          validationStatus: result.attempt.validationStatus,
        } : null,
        eventScore: result.eventScore,
        newRank: participant?.rank ?? null,
        rankChange: previousRank !== null && participant?.rank
          ? previousRank - participant.rank
          : null,
        isPersonalBest: result.eventScore > (participant?.bestScore ?? 0),
      },
    };
  });

  /**
   * GET /api/events/history
   *
   * Get user's event history.
   */
  app.get('/events/history', async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { cursor, limit } = request.query as { cursor?: string; limit?: string };

    const history = getUserEventHistory(userId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      success: true,
      data: history,
    };
  });
}
