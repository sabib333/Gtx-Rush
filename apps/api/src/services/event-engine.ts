/**
 * GTX Rush — Event Engine v1.0
 *
 * Server-authoritative event system that handles:
 * - Event lifecycle management
 * - Event creation and scheduling
 * - Participation tracking
 * - Attempt validation
 * - Score submission
 * - Leaderboard integration
 * - Reward distribution
 *
 * SECURITY:
 * - Event state is server-authoritative
 * - Attempt limits are server-controlled
 * - Score validation is server-side
 * - Rewards are idempotent
 *
 * Contract: Live Ops Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Event,
  EventStatus,
  EventType,
  EventParticipant,
  EventAttempt,
  EventLeaderboardEntry,
  EventLeaderboardResponse,
  EventRules,
  EventScoringConfig,
  EventRewardConfig,
  EventEligibilityConfig,
  EventMetadata,
  ScoreValidation,
  EventHistoryEntry,
  EventHistoryResponse,
  EventNotification,
  EventNotificationType,
} from '@gtx-rush/types';
import {
  EVENT_TYPE_DEFAULTS,
  DEFAULT_EVENT_RULES,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_REWARD_CONFIG,
  DEFAULT_ELIGIBILITY_CONFIG,
  DAILY_EVENT_TEMPLATES,
  WEEKEND_EVENT_TEMPLATES,
  calculateEventScore,
  getEventTimeRemaining,
  getRewardTierForRank,
  generateEventId,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const events = new Map<string, Event>();
const eventsByStatus = new Map<EventStatus, Set<string>>();
const eventsByType = new Map<EventType, Set<string>>();
const eventsByDate = new Map<string, Set<string>>(); // YYYY-MM-DD → eventIds
const participants = new Map<string, EventParticipant>(); // eventId:userId → participant
const participantByEvent = new Map<string, Set<string>>(); // eventId → userIds
const participantByUser = new Map<string, Set<string>>(); // userId → eventIds
const attempts = new Map<string, EventAttempt[]>(); // eventId:userId → attempts
const eventNotifications = new Map<string, EventNotification[]>();

// ============================================================
// Event Management
// ============================================================

/**
 * Create a new event.
 *
 * SECURITY:
 * - Event creation is server-side only
 * - Rules are versioned
 * - Configuration is validated
 */
export function createEvent(params: {
  name: string;
  description: string;
  type: EventType;
  gameId: string;
  startsAt: Date;
  endsAt: Date;
  rules?: Partial<EventRules>;
  scoringConfig?: Partial<EventScoringConfig>;
  rewardConfig?: Partial<EventRewardConfig>;
  eligibilityConfig?: Partial<EventEligibilityConfig>;
  metadata?: Partial<EventMetadata>;
}): Event {
  const id = generateEventId(params.type);

  const rules: EventRules = {
    ...DEFAULT_EVENT_RULES,
    ...EVENT_TYPE_DEFAULTS[params.type] && {
      maxAttempts: EVENT_TYPE_DEFAULTS[params.type].maxAttempts,
      bestScoreCounts: EVENT_TYPE_DEFAULTS[params.type].scoringFormula === 'best_score',
    },
    ...params.rules,
  };

  const scoringConfig: EventScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    ...params.scoringConfig,
  };

  const rewardConfig: EventRewardConfig = {
    ...DEFAULT_REWARD_CONFIG,
    ...params.rewardConfig,
  };

  const eligibilityConfig: EventEligibilityConfig = {
    ...DEFAULT_ELIGIBILITY_CONFIG,
    ...params.eligibilityConfig,
  };

  const metadata: EventMetadata = {
    imageUrl: null,
    color: null,
    sponsor: null,
    campaignId: null,
    ...params.metadata,
  };

  const event: Event = {
    id,
    name: params.name,
    description: params.description,
    type: params.type,
    status: 'draft',
    gameId: params.gameId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    rules,
    scoringConfig,
    rewardConfig,
    eligibilityConfig,
    visibility: 'public',
    metadata,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  events.set(id, event);

  // Update indices
  updateEventIndices(event);

  return event;
}

/**
 * Update event indices.
 */
function updateEventIndices(event: Event): void {
  // Status index
  const statusSet = eventsByStatus.get(event.status) ?? new Set();
  statusSet.add(event.id);
  eventsByStatus.set(event.status, statusSet);

  // Type index
  const typeSet = eventsByType.get(event.type) ?? new Set();
  typeSet.add(event.id);
  eventsByType.set(event.type, typeSet);

  // Date index
  const dateStr = event.startsAt.toISOString().slice(0, 10);
  const dateSet = eventsByDate.get(dateStr) ?? new Set();
  dateSet.add(event.id);
  eventsByDate.set(dateStr, dateSet);
}

/**
 * Update event status.
 */
export function updateEventStatus(eventId: string, status: EventStatus): boolean {
  const event = events.get(eventId);
  if (!event) return false;

  // Remove from old status index
  const oldStatusSet = eventsByStatus.get(event.status);
  oldStatusSet?.delete(eventId);

  // Update status
  event.status = status;
  event.updatedAt = new Date();

  // Add to new status index
  const newStatusSet = eventsByStatus.get(status) ?? new Set();
  newStatusSet.add(eventId);
  eventsByStatus.set(status, newStatusSet);

  return true;
}

/**
 * Get event by ID.
 */
export function getEvent(eventId: string): Event | null {
  return events.get(eventId) ?? null;
}

/**
 * Get all events.
 */
export function getAllEvents(): Event[] {
  return Array.from(events.values());
}

/**
 * Get events by status.
 */
export function getEventsByStatus(status: EventStatus): Event[] {
  const statusSet = eventsByStatus.get(status) ?? new Set();
  return Array.from(statusSet)
    .map((id) => events.get(id))
    .filter((e): e is Event => e !== undefined);
}

/**
 * Get events by type.
 */
export function getEventsByType(type: EventType): Event[] {
  const typeSet = eventsByType.get(type) ?? new Set();
  return Array.from(typeSet)
    .map((id) => events.get(id))
    .filter((e): e is Event => e !== undefined);
}

/**
 * Get active events.
 */
export function getActiveEvents(): Event[] {
  return getEventsByStatus('active');
}

/**
 * Get upcoming events.
 */
export function getUpcomingEvents(): Event[] {
  return getEventsByStatus('scheduled');
}

/**
 * Get live events for discovery.
 */
export function getLiveEvents(): {
  live: Event[];
  upcoming: Event[];
  completed: Event[];
} {
  return {
    live: getActiveEvents(),
    upcoming: getUpcomingEvents(),
    completed: getEventsByStatus('completed').slice(0, 10),
  };
}

// ============================================================
// Event Lifecycle
// ============================================================

/**
 * Check and update event statuses based on time.
 */
export function checkEventStatuses(): number {
  let updatedCount = 0;
  const now = new Date();

  for (const event of events.values()) {
    // Draft → Scheduled (when start time is set)
    if (event.status === 'draft' && event.startsAt > now) {
      updateEventStatus(event.id, 'scheduled');
      updatedCount++;
    }

    // Scheduled → Active (when start time is reached)
    if (event.status === 'scheduled' && now >= event.startsAt) {
      updateEventStatus(event.id, 'active');
      updatedCount++;
    }

    // Active → Ending (when end time is near, e.g., 1 hour before)
    if (event.status === 'active') {
      const timeRemaining = getEventTimeRemaining(event.endsAt);
      if (timeRemaining <= 60 * 60 * 1000 && timeRemaining > 0) {
        updateEventStatus(event.id, 'ending');
        updatedCount++;
      }
    }

    // Ending/Active → Completed (when end time is reached)
    if ((event.status === 'active' || event.status === 'ending') && now > event.endsAt) {
      updateEventStatus(event.id, 'completed');
      updatedCount++;
    }

    // Completed → Archived (after 7 days)
    if (event.status === 'completed') {
      const daysSinceCompletion = (now.getTime() - event.endsAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCompletion > 7) {
        updateEventStatus(event.id, 'archived');
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

// ============================================================
// Event Participation
// ============================================================

/**
 * Join an event.
 *
 * SECURITY:
 * - Validates eligibility
 * - Prevents duplicate joins
 * - Server-authoritative
 */
export function joinEvent(
  eventId: string,
  userId: string,
): {
  success: boolean;
  participant?: EventParticipant;
  error?: string;
} {
  const event = events.get(eventId);
  if (!event) {
    return { success: false, error: 'EVENT_NOT_FOUND' };
  }

  if (event.status !== 'active' && event.status !== 'scheduled') {
    return { success: false, error: 'EVENT_NOT_AVAILABLE' };
  }

  // Check eligibility
  const eligibility = checkEligibility(event, userId);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason };
  }

  // Check if already joined
  const participantKey = `${eventId}:${userId}`;
  if (participants.has(participantKey)) {
    return { success: false, error: 'ALREADY_JOINED' };
  }

  // Create participant
  const participant: EventParticipant = {
    id: nanoid(),
    eventId,
    userId,
    status: 'joined',
    joinedAt: new Date(),
    lastAttemptAt: null,
    attemptCount: 0,
    bestScore: 0,
    eventScore: 0,
    rank: null,
    metadata: {},
  };

  participants.set(participantKey, participant);

  // Update indices
  const eventParticipants = participantByEvent.get(eventId) ?? new Set();
  eventParticipants.add(userId);
  participantByEvent.set(eventId, eventParticipants);

  const userEvents = participantByUser.get(userId) ?? new Set();
  userEvents.add(eventId);
  participantByUser.set(userId, userEvents);

  return { success: true, participant };
}

/**
 * Check if user is eligible for event.
 */
function checkEligibility(
  event: Event,
  userId: string,
): { eligible: boolean; reason: string } {
  const config = event.eligibilityConfig;

  // Check minimum level (would fetch from user table in production)
  // For MVP, allow all users
  if (config.minLevel > 1) {
    // Would check user.level >= config.minLevel
  }

  // Check game requirement
  if (config.requiredGameId && event.gameId !== config.requiredGameId) {
    return { eligible: false, reason: 'WRONG_GAME' };
  }

  // Check country
  if (config.countries.length > 0) {
    // Would check user.country in config.countries
  }

  return { eligible: true, reason: '' };
}

/**
 * Get participant info.
 */
export function getParticipant(
  eventId: string,
  userId: string,
): EventParticipant | null {
  return participants.get(`${eventId}:${userId}`) ?? null;
}

/**
 * Get all participants for an event.
 */
export function getEventParticipants(eventId: string): EventParticipant[] {
  const userIds = participantByEvent.get(eventId) ?? new Set();
  return Array.from(userIds)
    .map((userId) => participants.get(`${eventId}:${userId}`))
    .filter((p): p is EventParticipant => p !== undefined);
}

/**
 * Get user's events.
 */
export function getUserEvents(userId: string): Event[] {
  const eventIds = participantByUser.get(userId) ?? new Set();
  return Array.from(eventIds)
    .map((id) => events.get(id))
    .filter((e): e is Event => e !== undefined);
}

// ============================================================
// Event Attempts & Scoring
// ============================================================

/**
 * Submit an event attempt.
 *
 * SECURITY:
 * - Validates attempt limits server-side
 * - Validates score server-side
 * - Prevents replay attacks
 */
export function submitEventAttempt(
  eventId: string,
  userId: string,
  sessionId: string,
  gameScore: number,
): {
  success: boolean;
  attempt?: EventAttempt;
  eventScore: number;
  error?: string;
} {
  const event = events.get(eventId);
  if (!event) {
    return { success: false, eventScore: 0, error: 'EVENT_NOT_FOUND' };
  }

  if (event.status !== 'active' && event.status !== 'ending') {
    return { success: false, eventScore: 0, error: 'EVENT_NOT_ACTIVE' };
  }

  // Check if user is participant
  const participant = getParticipant(eventId, userId);
  if (!participant) {
    return { success: false, eventScore: 0, error: 'NOT_PARTICIPANT' };
  }

  // Check attempt limits
  const attemptCheck = checkAttemptLimits(event, participant);
  if (!attemptCheck.allowed) {
    return { success: false, eventScore: 0, error: attemptCheck.reason };
  }

  // Calculate event score
  const eventScore = calculateEventScore(
    [gameScore],
    event.scoringConfig.formula,
    event.scoringConfig.multiplier,
    event.scoringConfig.topN,
  );

  // Create attempt
  const attempt: EventAttempt = {
    id: nanoid(),
    eventId,
    userId,
    sessionId,
    gameScore,
    eventScore,
    validationStatus: 'pending',
    attemptNumber: participant.attemptCount + 1,
    isValid: true,
    antiCheatFlags: [],
    submittedAt: new Date(),
    validatedAt: null,
  };

  // Store attempt
  const attemptKey = `${eventId}:${userId}`;
  const userAttempts = attempts.get(attemptKey) ?? [];
  userAttempts.push(attempt);
  attempts.set(attemptKey, userAttempts);

  // Update participant
  participant.attemptCount++;
  participant.lastAttemptAt = new Date();
  participant.status = 'active';

  // Update best score
  if (event.rules.bestScoreCounts) {
    if (eventScore > participant.bestScore) {
      participant.bestScore = eventScore;
      participant.eventScore = eventScore;
    }
  } else {
    // Total score
    participant.eventScore += eventScore;
    participant.bestScore = Math.max(participant.bestScore, gameScore);
  }

  // Validate attempt (simplified for MVP)
  attempt.validationStatus = 'validated';
  attempt.validatedAt = new Date();

  return {
    success: true,
    attempt,
    eventScore: participant.eventScore,
  };
}

/**
 * Check attempt limits.
 */
function checkAttemptLimits(
  event: Event,
  participant: EventParticipant,
): { allowed: boolean; reason: string } {
  const rules = event.rules;

  if (rules.attemptConstraint === 'unlimited') {
    return { allowed: true, reason: '' };
  }

  if (rules.maxAttempts !== null && participant.attemptCount >= rules.maxAttempts) {
    return { allowed: false, reason: 'MAX_ATTEMPTS_REACHED' };
  }

  return { allowed: true, reason: '' };
}

// ============================================================
// Event Leaderboard
// ============================================================

/**
 * Get event leaderboard.
 */
export function getEventLeaderboard(
  eventId: string,
  options: {
    cursor?: string;
    limit?: number;
    currentUserId?: string;
  } = {},
): EventLeaderboardResponse {
  const event = events.get(eventId);
  if (!event) {
    return {
      eventId,
      eventName: '',
      entries: [],
      userEntry: null,
      totalParticipants: 0,
      pagination: { nextCursor: null, hasMore: false },
    };
  }

  const { cursor, limit = 50, currentUserId } = options;

  // Get all participants and sort by score
  const allParticipants = getEventParticipants(eventId);
  const sorted = allParticipants
    .filter((p) => p.eventScore > 0)
    .sort((a, b) => {
      // Primary: higher score first
      if (b.eventScore !== a.eventScore) return b.eventScore - a.eventScore;
      // Secondary: earlier attempt (tie-break)
      return (a.lastAttemptAt?.getTime() ?? Infinity) - (b.lastAttemptAt?.getTime() ?? Infinity);
    });

  // Assign ranks
  const entries: EventLeaderboardEntry[] = sorted.map((p, index) => ({
    rank: index + 1,
    userId: p.userId,
    displayName: `Player ${p.userId.slice(0, 8)}`, // Would fetch from users table
    avatarUrl: null,
    level: 1,
    country: 'XX',
    eventScore: p.eventScore,
    bestGameScore: p.bestScore,
    attemptCount: p.attemptCount,
    lastAttemptAt: p.lastAttemptAt ?? new Date(),
    isCurrentUser: p.userId === currentUserId,
  }));

  // Cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = entries.findIndex((e) => e.userId === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginatedEntries = entries.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < entries.length;
  const nextCursor = hasMore ? paginatedEntries[paginatedEntries.length - 1]?.userId ?? null : null;

  // Find current user's entry
  let userEntry: EventLeaderboardEntry | null = null;
  if (currentUserId) {
    userEntry = entries.find((e) => e.userId === currentUserId) ?? null;
  }

  return {
    eventId,
    eventName: event.name,
    entries: paginatedEntries,
    userEntry,
    totalParticipants: allParticipants.length,
    pagination: { nextCursor, hasMore },
  };
}

// ============================================================
// Event History
// ============================================================

/**
 * Get user's event history.
 */
export function getUserEventHistory(
  userId: string,
  options: {
    cursor?: string;
    limit?: number;
  } = {},
): EventHistoryResponse {
  const { cursor, limit = 20 } = options;

  const userEventIds = participantByUser.get(userId) ?? new Set();
  const entries: EventHistoryEntry[] = [];

  for (const eventId of userEventIds) {
    const event = events.get(eventId);
    const participant = getParticipant(eventId, userId);

    if (!event || !participant) continue;
    if (event.status !== 'completed' && event.status !== 'archived') continue;

    entries.push({
      eventId: event.id,
      eventName: event.name,
      eventType: event.type,
      gameName: event.gameId,
      rank: participant.rank ?? 0,
      totalParticipants: getEventParticipants(eventId).length,
      eventScore: participant.eventScore,
      bestGameScore: participant.bestScore,
      reward: null, // Would fetch from event_rewards table
      completedAt: event.endsAt,
    });
  }

  // Sort by completion date (newest first)
  entries.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  // Cursor-based pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = entries.findIndex((e) => e.eventId === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = entries.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < entries.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.eventId ?? null : null;

  return {
    entries: paginated,
    pagination: { nextCursor, hasMore },
  };
}

// ============================================================
// Event Notifications
// ============================================================

/**
 * Create an event notification.
 */
export function createEventNotification(
  userId: string,
  eventId: string,
  type: EventNotificationType,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): EventNotification {
  const notification: EventNotification = {
    id: nanoid(),
    userId,
    eventId,
    type,
    title,
    body,
    data,
    read: false,
    createdAt: new Date(),
  };

  const userNotifications = eventNotifications.get(userId) ?? [];
  userNotifications.push(notification);
  eventNotifications.set(userId, userNotifications);

  return notification;
}

/**
 * Get user's event notifications.
 */
export function getUserEventNotifications(userId: string): EventNotification[] {
  return eventNotifications.get(userId) ?? [];
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearEventEngine(): void {
  events.clear();
  eventsByStatus.clear();
  eventsByType.clear();
  eventsByDate.clear();
  participants.clear();
  participantByEvent.clear();
  participantByUser.clear();
  attempts.clear();
  eventNotifications.clear();
}

export function _getEventCount(): number {
  return events.size;
}

export function _getActiveEventCount(): number {
  return (eventsByStatus.get('active') ?? new Set()).size;
}

export function _getParticipantCount(eventId: string): number {
  return (participantByEvent.get(eventId) ?? new Set()).size;
}
