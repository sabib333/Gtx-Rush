/**
 * GTX Rush — Event Analytics v1.0
 *
 * Tracks event-specific analytics events per the Live Ops Contract.
 *
 * Events:
 * - event_viewed
 * - event_joined
 * - event_started
 * - event_attempt_started
 * - event_attempt_completed
 * - event_score_submitted
 * - event_rank_changed
 * - event_completed
 * - event_reward_claimed
 * - event_shared
 * - event_challenge_created
 *
 * SECURITY: Analytics events must not contain sensitive data.
 * User IDs are stored separately from event properties.
 */

import { nanoid } from 'nanoid';
import type {
  EventAnalyticsEvent,
  EventAnalyticsData,
} from '@gtx-rush/types';

// ============================================================
// In-memory store (production: PostgreSQL analytics_events table)
// ============================================================

interface AnalyticsRecord {
  id: string;
  eventName: EventAnalyticsEvent;
  userId: string;
  eventId: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const analyticsStore = new Map<string, AnalyticsRecord>();

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track an event analytics event.
 */
export function trackEventAnalytics(
  eventName: EventAnalyticsEvent,
  userId: string,
  eventId: string,
  properties: Record<string, unknown>,
): void {
  const record: AnalyticsRecord = {
    id: nanoid(),
    eventName,
    userId,
    eventId,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
    createdAt: new Date(),
  };

  analyticsStore.set(record.id, record);

  // In production, also insert into PostgreSQL analytics_events table
  // await db.insert(analyticsEvents).values({ ... });
}

// ============================================================
// Event View & Join Events
// ============================================================

export function trackEventViewed(
  userId: string,
  eventId: string,
  eventType: string,
): void {
  trackEventAnalytics('event_viewed', userId, eventId, {
    eventType,
  });
}

export function trackEventJoined(
  userId: string,
  eventId: string,
  eventType: string,
): void {
  trackEventAnalytics('event_joined', userId, eventId, {
    eventType,
  });
}

export function trackEventStarted(
  userId: string,
  eventId: string,
  eventType: string,
): void {
  trackEventAnalytics('event_started', userId, eventId, {
    eventType,
  });
}

// ============================================================
// Attempt Events
// ============================================================

export function trackEventAttemptStarted(
  userId: string,
  eventId: string,
  attemptNumber: number,
): void {
  trackEventAnalytics('event_attempt_started', userId, eventId, {
    attemptNumber,
  });
}

export function trackEventAttemptCompleted(
  userId: string,
  eventId: string,
  attemptNumber: number,
  gameScore: number,
  durationMs: number,
): void {
  trackEventAnalytics('event_attempt_completed', userId, eventId, {
    attemptNumber,
    gameScore,
    durationMs,
  });
}

export function trackEventScoreSubmitted(
  userId: string,
  eventId: string,
  gameScore: number,
  eventScore: number,
  rank: number | null,
): void {
  trackEventAnalytics('event_score_submitted', userId, eventId, {
    gameScore,
    eventScore,
    rank,
  });
}

// ============================================================
// Rank Events
// ============================================================

export function trackEventRankChanged(
  userId: string,
  eventId: string,
  previousRank: number,
  newRank: number,
  change: number,
): void {
  trackEventAnalytics('event_rank_changed', userId, eventId, {
    previousRank,
    newRank,
    change,
  });
}

// ============================================================
// Completion Events
// ============================================================

export function trackEventCompleted(
  userId: string,
  eventId: string,
  finalRank: number,
  totalParticipants: number,
  eventScore: number,
): void {
  trackEventAnalytics('event_completed', userId, eventId, {
    finalRank,
    totalParticipants,
    eventScore,
  });
}

export function trackEventRewardClaimed(
  userId: string,
  eventId: string,
  rewardType: string,
  rewardValue: number | string,
): void {
  trackEventAnalytics('event_reward_claimed', userId, eventId, {
    rewardType,
    rewardValue,
  });
}

// ============================================================
// Share Events
// ============================================================

export function trackEventShared(
  userId: string,
  eventId: string,
  shareType: string,
  rank: number,
): void {
  trackEventAnalytics('event_shared', userId, eventId, {
    shareType,
    rank,
  });
}

export function trackEventChallengeCreated(
  userId: string,
  eventId: string,
  challengeId: string,
): void {
  trackEventAnalytics('event_challenge_created', userId, eventId, {
    challengeId,
  });
}

// ============================================================
// Analytics Queries (for admin/future use)
// ============================================================

/**
 * Get analytics records by event name.
 */
export function getEventAnalyticsByEvent(
  eventName: EventAnalyticsEvent,
  options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    eventId?: string;
    limit?: number;
  } = {},
): AnalyticsRecord[] {
  const { startDate, endDate, userId, eventId, limit = 100 } = options;

  const records: AnalyticsRecord[] = [];
  for (const record of analyticsStore.values()) {
    if (record.eventName !== eventName) continue;
    if (startDate && record.createdAt < startDate) continue;
    if (endDate && record.createdAt > endDate) continue;
    if (userId && record.userId !== userId) continue;
    if (eventId && record.eventId !== eventId) continue;
    records.push(record);
  }

  records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return records.slice(0, limit);
}

/**
 * Get aggregate counts for an event.
 */
export function getEventAggregate(
  eventName: EventAnalyticsEvent,
  startDate: Date,
  endDate: Date,
): {
  count: number;
  uniqueUsers: number;
  uniqueEvents: number;
} {
  const records = getEventAnalyticsByEvent(eventName, {
    startDate,
    endDate,
    limit: 10000,
  });

  const uniqueUsers = new Set(records.map((r) => r.userId));
  const uniqueEvents = new Set(records.map((r) => r.eventId));

  return {
    count: records.length,
    uniqueUsers: uniqueUsers.size,
    uniqueEvents: uniqueEvents.size,
  };
}

/**
 * Get event performance metrics.
 */
export function getEventPerformanceMetrics(
  eventId: string,
): {
  totalViews: number;
  totalJoins: number;
  totalAttempts: number;
  totalScores: number;
  uniqueParticipants: number;
  averageAttemptsPerUser: number;
} {
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
  const endDate = new Date();

  const views = getEventAnalyticsByEvent('event_viewed', { eventId, startDate, endDate, limit: 10000 });
  const joins = getEventAnalyticsByEvent('event_joined', { eventId, startDate, endDate, limit: 10000 });
  const attempts = getEventAnalyticsByEvent('event_attempt_completed', { eventId, startDate, endDate, limit: 10000 });
  const scores = getEventAnalyticsByEvent('event_score_submitted', { eventId, startDate, endDate, limit: 10000 });

  const uniqueParticipants = new Set(joins.map((r) => r.userId)).size;
  const averageAttemptsPerUser = uniqueParticipants > 0 ? attempts.length / uniqueParticipants : 0;

  return {
    totalViews: views.length,
    totalJoins: joins.length,
    totalAttempts: attempts.length,
    totalScores: scores.length,
    uniqueParticipants,
    averageAttemptsPerUser,
  };
}

/**
 * Get user event metrics.
 */
export function getUserEventMetrics(
  userId: string,
  days: number = 30,
): {
  eventsViewed: number;
  eventsJoined: number;
  totalAttempts: number;
  totalScores: number;
  averageScore: number;
} {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);

  const views = getEventAnalyticsByEvent('event_viewed', { userId, startDate, limit: 10000 });
  const joins = getEventAnalyticsByEvent('event_joined', { userId, startDate, limit: 10000 });
  const attempts = getEventAnalyticsByEvent('event_attempt_completed', { userId, startDate, limit: 10000 });
  const scores = getEventAnalyticsByEvent('event_score_submitted', { userId, startDate, limit: 10000 });

  const totalScoreSum = scores.reduce((sum, r) => sum + (r.properties.gameScore as number || 0), 0);
  const averageScore = scores.length > 0 ? totalScoreSum / scores.length : 0;

  return {
    eventsViewed: views.length,
    eventsJoined: joins.length,
    totalAttempts: attempts.length,
    totalScores: scores.length,
    averageScore,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearEventAnalytics(): void {
  analyticsStore.clear();
}

export function _getEventAnalyticsCount(): number {
  return analyticsStore.size;
}
