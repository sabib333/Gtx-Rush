/**
 * GTX Rush — Social Analytics v1.0
 *
 * Tracks social-specific analytics events per the Social Engine Contract.
 *
 * Events:
 * - friend_profile_viewed
 * - friend_request_sent
 * - friend_request_accepted
 * - friend_challenge_created
 * - friend_challenge_completed
 * - team_viewed
 * - team_created
 * - team_joined
 * - team_left
 * - team_invited
 * - team_event_joined
 * - feed_viewed
 * - feed_reaction
 * - report_created
 *
 * SECURITY: Analytics events must not contain sensitive data.
 * User IDs are stored separately from event properties.
 */

import { nanoid } from 'nanoid';
import type {
  SocialAnalyticsEvent,
  SocialAnalyticsData,
} from '@gtx-rush/types';

// ============================================================
// In-memory store (production: PostgreSQL analytics_events table)
// ============================================================

interface AnalyticsRecord {
  id: string;
  eventName: SocialAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const analyticsStore = new Map<string, AnalyticsRecord>();

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track a social analytics event.
 */
export function trackSocialEvent(
  eventName: SocialAnalyticsEvent,
  userId: string,
  properties: Record<string, unknown>,
): void {
  const record: AnalyticsRecord = {
    id: nanoid(),
    eventName,
    userId,
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
// Friend Events
// ============================================================

export function trackFriendProfileViewed(
  viewerUserId: string,
  profileUserId: string,
): void {
  trackSocialEvent('friend_profile_viewed', viewerUserId, {
    profileUserId,
  });
}

export function trackFriendRequestSent(
  fromUserId: string,
  toUserId: string,
): void {
  trackSocialEvent('friend_request_sent', fromUserId, {
    toUserId,
  });
}

export function trackFriendRequestAccepted(
  userId: string,
  fromUserId: string,
): void {
  trackSocialEvent('friend_request_accepted', userId, {
    fromUserId,
  });
}

export function trackFriendChallengeCreated(
  userId: string,
  friendId: string,
  gameId: string,
): void {
  trackSocialEvent('friend_challenge_created', userId, {
    friendId,
    gameId,
  });
}

export function trackFriendChallengeCompleted(
  userId: string,
  friendId: string,
  gameId: string,
  winnerId: string,
): void {
  trackSocialEvent('friend_challenge_completed', userId, {
    friendId,
    gameId,
    winnerId,
  });
}

// ============================================================
// Team Events
// ============================================================

export function trackTeamViewed(
  userId: string,
  teamId: string,
): void {
  trackSocialEvent('team_viewed', userId, {
    teamId,
  });
}

export function trackTeamCreated(
  userId: string,
  teamId: string,
  teamName: string,
): void {
  trackSocialEvent('team_created', userId, {
    teamId,
    teamName,
  });
}

export function trackTeamJoined(
  userId: string,
  teamId: string,
  inviteCode: string | null,
): void {
  trackSocialEvent('team_joined', userId, {
    teamId,
    inviteCode,
  });
}

export function trackTeamLeft(
  userId: string,
  teamId: string,
  reason: string,
): void {
  trackSocialEvent('team_left', userId, {
    teamId,
    reason,
  });
}

export function trackTeamInvited(
  userId: string,
  teamId: string,
  invitedUserId: string | null,
): void {
  trackSocialEvent('team_invited', userId, {
    teamId,
    invitedUserId,
  });
}

export function trackTeamEventJoined(
  userId: string,
  teamId: string,
  eventId: string,
): void {
  trackSocialEvent('team_event_joined', userId, {
    teamId,
    eventId,
  });
}

// ============================================================
// Feed Events
// ============================================================

export function trackFeedViewed(
  userId: string,
  feedType: string,
): void {
  trackSocialEvent('feed_viewed', userId, {
    feedType,
  });
}

export function trackFeedReaction(
  userId: string,
  feedEventId: string,
  reactionType: string,
): void {
  trackSocialEvent('feed_reaction', userId, {
    feedEventId,
    reactionType,
  });
}

// ============================================================
// Report Events
// ============================================================

export function trackReportCreated(
  reporterUserId: string,
  reportedUserId: string | null,
  reportedTeamId: string | null,
  reason: string,
): void {
  trackSocialEvent('report_created', reporterUserId, {
    reportedUserId,
    reportedTeamId,
    reason,
  });
}

// ============================================================
// Analytics Queries (for admin/future use)
// ============================================================

/**
 * Get analytics records by event name.
 */
export function getSocialAnalyticsByEvent(
  eventName: SocialAnalyticsEvent,
  options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    limit?: number;
  } = {},
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
 * Get aggregate counts for a social event.
 */
export function getSocialEventAggregate(
  eventName: SocialAnalyticsEvent,
  startDate: Date,
  endDate: Date,
): {
  count: number;
  uniqueUsers: number;
} {
  const records = getSocialAnalyticsByEvent(eventName, {
    startDate,
    endDate,
    limit: 10000,
  });

  const uniqueUsers = new Set(records.map((r) => r.userId));

  return {
    count: records.length,
    uniqueUsers: uniqueUsers.size,
  };
}

/**
 * Get user social metrics.
 */
export function getUserSocialMetrics(
  userId: string,
  days: number = 30,
): {
  friendRequestsSent: number;
  friendRequestsAccepted: number;
  friendChallenges: number;
  teamCreated: number;
  teamJoined: number;
  feedReactions: number;
} {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);

  return {
    friendRequestsSent: getSocialAnalyticsByEvent('friend_request_sent', { userId, startDate, limit: 10000 }).length,
    friendRequestsAccepted: getSocialAnalyticsByEvent('friend_request_accepted', { userId, startDate, limit: 10000 }).length,
    friendChallenges: getSocialAnalyticsByEvent('friend_challenge_created', { userId, startDate, limit: 10000 }).length,
    teamCreated: getSocialAnalyticsByEvent('team_created', { userId, startDate, limit: 10000 }).length,
    teamJoined: getSocialAnalyticsByEvent('team_joined', { userId, startDate, limit: 10000 }).length,
    feedReactions: getSocialAnalyticsByEvent('feed_reaction', { userId, startDate, limit: 10000 }).length,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearSocialAnalytics(): void {
  analyticsStore.clear();
}

export function _getSocialAnalyticsCount(): number {
  return analyticsStore.size;
}
