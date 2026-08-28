/**
 * GTX Rush — Creator Analytics Service v1.0
 *
 * Analytics tracking for:
 * - Creator funnel
 * - Challenge metrics
 * - Creator retention
 * - Content quality
 *
 * Contract: Creator Engine Contract v1.0
 */

import type {
  CreatorAnalytics,
} from '@gtx-rush/types';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const creatorEvents = new Map<string, CreatorEvent[]>(); // userId → events
const challengeEvents = new Map<string, ChallengeEvent[]>(); // challengeId → events

// ============================================================
// Types
// ============================================================

interface CreatorEvent {
  type: 'profile_viewed' | 'create_clicked' | 'challenge_created' | 'challenge_published' | 'follower_gained';
  userId: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

interface ChallengeEvent {
  type: 'challenge_viewed' | 'challenge_started' | 'challenge_completed' | 'challenge_shared' | 'challenge_reacted' | 'challenge_reported';
  challengeId: string;
  userId: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track a creator event
 */
export function trackCreatorEvent(
  userId: string,
  eventType: CreatorEvent['type'],
  metadata: Record<string, unknown> = {},
): void {
  const events = creatorEvents.get(userId) ?? [];
  events.push({
    type: eventType,
    userId,
    metadata,
    timestamp: new Date(),
  });
  creatorEvents.set(userId, events);
}

/**
 * Track a challenge event
 */
export function trackChallengeEvent(
  challengeId: string,
  userId: string,
  eventType: ChallengeEvent['type'],
  metadata: Record<string, unknown> = {},
): void {
  const events = challengeEvents.get(challengeId) ?? [];
  events.push({
    type: eventType,
    challengeId,
    userId,
    metadata,
    timestamp: new Date(),
  });
  challengeEvents.set(challengeId, events);
}

// ============================================================
// Analytics Queries
// ============================================================

/**
 * Get creator funnel analytics
 */
export function getCreatorFunnel(userId: string): {
  profileViewed: number;
  createClicked: number;
  challengesCreated: number;
  challengesPublished: number;
  followersGained: number;
} {
  const events = creatorEvents.get(userId) ?? [];

  return {
    profileViewed: events.filter((e) => e.type === 'profile_viewed').length,
    createClicked: events.filter((e) => e.type === 'create_clicked').length,
    challengesCreated: events.filter((e) => e.type === 'challenge_created').length,
    challengesPublished: events.filter((e) => e.type === 'challenge_published').length,
    followersGained: events.filter((e) => e.type === 'follower_gained').length,
  };
}

/**
 * Get challenge engagement analytics
 */
export function getChallengeEngagement(challengeId: string): {
  views: number;
  starts: number;
  completions: number;
  shares: number;
  reactions: number;
  reports: number;
  completionRate: number;
  shareRate: number;
} {
  const events = challengeEvents.get(challengeId) ?? [];

  const views = events.filter((e) => e.type === 'challenge_viewed').length;
  const starts = events.filter((e) => e.type === 'challenge_started').length;
  const completions = events.filter((e) => e.type === 'challenge_completed').length;
  const shares = events.filter((e) => e.type === 'challenge_shared').length;
  const reactions = events.filter((e) => e.type === 'challenge_reacted').length;
  const reports = events.filter((e) => e.type === 'challenge_reported').length;

  return {
    views,
    starts,
    completions,
    shares,
    reactions,
    reports,
    completionRate: starts > 0 ? completions / starts : 0,
    shareRate: views > 0 ? shares / views : 0,
  };
}

/**
 * Get creator retention metrics
 */
export function getCreatorRetention(userId: string): {
  totalEvents: number;
  lastActivity: Date | null;
  activeDays: number;
  averageEventsPerDay: number;
} {
  const events = creatorEvents.get(userId) ?? [];

  if (events.length === 0) {
    return {
      totalEvents: 0,
      lastActivity: null,
      activeDays: 0,
      averageEventsPerDay: 0,
    };
  }

  const lastEvent = events[events.length - 1];
  const lastActivity = lastEvent?.timestamp ?? null;
  const uniqueDays = new Set(events.map((e) => e.timestamp.toDateString())).size;

  return {
    totalEvents: events.length,
    lastActivity,
    activeDays: uniqueDays,
    averageEventsPerDay: events.length / Math.max(uniqueDays, 1),
  };
}

/**
 * Get top creators by metric
 */
export function getTopCreators(
  metric: 'challenges' | 'plays' | 'followers' | 'reactions',
  limit: number = 10,
): { userId: string; value: number }[] {
  const creatorStats = new Map<string, number>();

  // Aggregate metrics from events
  for (const [userId, events] of creatorEvents.entries()) {
    switch (metric) {
      case 'challenges':
        const created = events.filter((e) => e.type === 'challenge_created').length;
        creatorStats.set(userId, (creatorStats.get(userId) ?? 0) + created);
        break;
    }
  }

  return Array.from(creatorStats.entries())
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/**
 * Get challenge discovery analytics
 */
export function getDiscoveryAnalytics(): {
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  topGames: { gameId: string; plays: number }[];
} {
  let totalViews = 0;
  let totalStarts = 0;
  let totalCompletions = 0;
  const gamePlays = new Map<string, number>();

  for (const events of challengeEvents.values()) {
    for (const event of events) {
      switch (event.type) {
        case 'challenge_viewed':
          totalViews++;
          break;
        case 'challenge_started':
          totalStarts++;
          break;
        case 'challenge_completed':
          totalCompletions++;
          break;
      }
    }
  }

  return {
    totalViews,
    totalStarts,
    totalCompletions,
    topGames: Array.from(gamePlays.entries())
      .map(([gameId, plays]) => ({ gameId, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5),
  };
}

/**
 * Clear all data (for testing)
 */
export function _clearAllCreatorAnalytics(): void {
  creatorEvents.clear();
  challengeEvents.clear();
}
