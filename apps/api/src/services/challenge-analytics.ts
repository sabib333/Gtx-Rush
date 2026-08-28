/**
 * GTX Rush — Challenge Analytics v1.0
 *
 * Tracks challenge-specific analytics events per the Challenge Engine Contract.
 *
 * Events:
 * - daily_challenge_viewed
 * - daily_challenge_started
 * - daily_challenge_completed
 * - daily_challenge_attempted
 * - daily_challenge_personal_best
 * - daily_challenge_shared
 * - friend_challenge_created
 * - friend_challenge_opened
 * - friend_challenge_started
 * - friend_challenge_completed
 * - friend_challenge_won
 * - friend_challenge_lost
 * - friend_challenge_shared
 * - challenge_expired
 * - challenge_abuse_detected
 *
 * SECURITY: Analytics events must not contain sensitive data.
 * User IDs are stored separately from event properties.
 */

import { nanoid } from 'nanoid';
import type { ChallengeAnalyticsEvent } from '@gtx-rush/types';

// ============================================================
// In-memory store (production: PostgreSQL analytics_events table)
// ============================================================

interface AnalyticsRecord {
  id: string;
  eventName: ChallengeAnalyticsEvent;
  userId: string | null;
  properties: Record<string, unknown>;
  sessionId: string | null;
  createdAt: Date;
}

const analyticsStore = new Map<string, AnalyticsRecord>();

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track a challenge analytics event.
 */
export function trackAnalyticsEvent(
  eventName: ChallengeAnalyticsEvent,
  userId: string | null,
  properties: Record<string, unknown>,
  sessionId?: string,
): void {
  const record: AnalyticsRecord = {
    id: nanoid(),
    eventName,
    userId,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
    },
    sessionId: sessionId ?? null,
    createdAt: new Date(),
  };

  analyticsStore.set(record.id, record);

  // In production, also insert into PostgreSQL analytics_events table
  // await db.insert(analyticsEvents).values({ ... });
}

// ============================================================
// Daily Challenge Events
// ============================================================

export function trackDailyChallengeViewed(
  userId: string,
  challengeId: string,
  gameId: string,
): void {
  trackAnalyticsEvent('daily_challenge_viewed', userId, {
    challengeId,
    gameId,
  });
}

export function trackDailyChallengeStarted(
  userId: string,
  challengeId: string,
  gameId: string,
  attemptNumber: number,
): void {
  trackAnalyticsEvent('daily_challenge_started', userId, {
    challengeId,
    gameId,
    attemptNumber,
  });
}

export function trackDailyChallengeCompleted(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  rank: number,
  attemptNumber: number,
  isPersonalBest: boolean,
): void {
  trackAnalyticsEvent('daily_challenge_completed', userId, {
    challengeId,
    gameId,
    score,
    rank,
    attemptNumber,
    isPersonalBest,
  });
}

export function trackDailyChallengeAttempted(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  attemptNumber: number,
): void {
  trackAnalyticsEvent('daily_challenge_attempted', userId, {
    challengeId,
    gameId,
    score,
    attemptNumber,
  });
}

export function trackDailyChallengePersonalBest(
  userId: string,
  challengeId: string,
  gameId: string,
  previousBest: number,
  newBest: number,
): void {
  trackAnalyticsEvent('daily_challenge_personal_best', userId, {
    challengeId,
    gameId,
    previousBest,
    newBest,
    improvement: newBest - previousBest,
  });
}

export function trackDailyChallengeShared(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  rank: number,
): void {
  trackAnalyticsEvent('daily_challenge_shared', userId, {
    challengeId,
    gameId,
    score,
    rank,
  });
}

// ============================================================
// Friend Challenge Events
// ============================================================

export function trackFriendChallengeCreated(
  userId: string,
  challengeId: string,
  gameId: string,
): void {
  trackAnalyticsEvent('friend_challenge_created', userId, {
    challengeId,
    gameId,
  });
}

export function trackFriendChallengeOpened(
  userId: string,
  challengeId: string,
  gameId: string,
): void {
  trackAnalyticsEvent('friend_challenge_opened', userId, {
    challengeId,
    gameId,
  });
}

export function trackFriendChallengeStarted(
  userId: string,
  challengeId: string,
  gameId: string,
): void {
  trackAnalyticsEvent('friend_challenge_started', userId, {
    challengeId,
    gameId,
  });
}

export function trackFriendChallengeCompleted(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  winner: 'challenger' | 'opponent' | 'tie',
): void {
  trackAnalyticsEvent('friend_challenge_completed', userId, {
    challengeId,
    gameId,
    score,
    winner,
  });
}

export function trackFriendChallengeWon(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  opponentScore: number,
): void {
  trackAnalyticsEvent('friend_challenge_won', userId, {
    challengeId,
    gameId,
    score,
    opponentScore,
  });
}

export function trackFriendChallengeLost(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
  opponentScore: number,
): void {
  trackAnalyticsEvent('friend_challenge_lost', userId, {
    challengeId,
    gameId,
    score,
    opponentScore,
  });
}

export function trackFriendChallengeShared(
  userId: string,
  challengeId: string,
  gameId: string,
  score: number,
): void {
  trackAnalyticsEvent('friend_challenge_shared', userId, {
    challengeId,
    gameId,
    score,
  });
}

// ============================================================
// General Challenge Events
// ============================================================

export function trackChallengeExpired(
  challengeId: string,
  gameId: string,
  challengeType: 'daily_rush' | 'friend',
): void {
  trackAnalyticsEvent('challenge_expired', null, {
    challengeId,
    gameId,
    challengeType,
  });
}

export function trackChallengeAbuseDetected(
  userId: string,
  challengeId: string,
  abuseType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
): void {
  trackAnalyticsEvent('challenge_abuse_detected', userId, {
    challengeId,
    abuseType,
    severity,
  });
}

// ============================================================
// Query (for admin/future use)
// ============================================================

/**
 * Get analytics records by event name.
 */
export function getAnalyticsByEvent(
  eventName: ChallengeAnalyticsEvent,
  options: { startDate?: Date; endDate?: Date; userId?: string; limit?: number } = {},
): AnalyticsRecord[] {
  const { startDate, endDate, userId, limit = 100 } = options;

  const records: AnalyticsRecord[] = [];
  for (const record of analyticsStore.values()) {
    if (record.eventName !== eventName) continue;
    if (startDate && record.createdAt < startDate) continue;
    if (endDate && record.createdAt > endDate) continue;
    if (userId && record.userId !== userId) continue;
    records.push(record);
  }

  records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return records.slice(0, limit);
}

/**
 * Get aggregate counts for an event.
 */
export function getEventAggregate(
  eventName: ChallengeAnalyticsEvent,
  startDate: Date,
  endDate: Date,
): { count: number; uniqueUsers: number } {
  const records = getAnalyticsByEvent(eventName, { startDate, endDate, limit: 10000 });

  const uniqueUsers = new Set(records.filter((r) => r.userId).map((r) => r.userId));

  return {
    count: records.length,
    uniqueUsers: uniqueUsers.size,
  };
}

// ============================================================
// Clear (for testing)
// ============================================================

export function _clearAnalytics(): void {
  analyticsStore.clear();
}
