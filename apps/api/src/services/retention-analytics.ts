/**
 * GTX Rush — Retention Analytics v1.0
 *
 * Tracks retention-specific analytics events per the Retention Engine Contract.
 *
 * Events:
 * - mission_viewed
 * - mission_started
 * - mission_progressed
 * - mission_completed
 * - mission_claimed
 * - mission_expired
 * - streak_started
 * - streak_extended
 * - streak_milestone
 * - streak_broken
 * - level_up
 * - reward_unlocked
 * - reward_claimed
 * - daily_rush_viewed
 * - retention_home_viewed
 *
 * SECURITY: Analytics events must not contain sensitive data.
 * User IDs are stored separately from event properties.
 */

import { nanoid } from 'nanoid';
import type { RetentionAnalyticsEvent, RetentionAnalyticsData } from '@gtx-rush/types';

// ============================================================
// In-memory store (production: PostgreSQL analytics_events table)
// ============================================================

interface AnalyticsRecord {
  id: string;
  eventName: RetentionAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const analyticsStore = new Map<string, AnalyticsRecord>();

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track a retention analytics event.
 */
export function trackRetentionEvent(
  eventName: RetentionAnalyticsEvent,
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
// Mission Events
// ============================================================

export function trackMissionViewed(
  userId: string,
  missionId: string,
  period: string,
): void {
  trackRetentionEvent('mission_viewed', userId, {
    missionId,
    period,
  });
}

export function trackMissionStarted(
  userId: string,
  missionId: string,
  period: string,
  difficulty: string,
): void {
  trackRetentionEvent('mission_started', userId, {
    missionId,
    period,
    difficulty,
  });
}

export function trackMissionProgressed(
  userId: string,
  missionId: string,
  progress: number,
  target: number,
): void {
  trackRetentionEvent('mission_progressed', userId, {
    missionId,
    progress,
    target,
    progressPercent: Math.round((progress / target) * 100),
  });
}

export function trackMissionCompleted(
  userId: string,
  missionId: string,
  period: string,
  rewardXp: number,
): void {
  trackRetentionEvent('mission_completed', userId, {
    missionId,
    period,
    rewardXp,
  });
}

export function trackMissionClaimed(
  userId: string,
  missionId: string,
  rewardType: string,
  rewardValue: number | string,
): void {
  trackRetentionEvent('mission_claimed', userId, {
    missionId,
    rewardType,
    rewardValue,
  });
}

export function trackMissionExpired(
  userId: string,
  missionId: string,
  period: string,
  progress: number,
  target: number,
): void {
  trackRetentionEvent('mission_expired', userId, {
    missionId,
    period,
    progress,
    target,
    progressPercent: Math.round((progress / target) * 100),
  });
}

// ============================================================
// Streak Events
// ============================================================

export function trackStreakStarted(
  userId: string,
  currentStreak: number,
): void {
  trackRetentionEvent('streak_started', userId, {
    currentStreak,
  });
}

export function trackStreakExtended(
  userId: string,
  currentStreak: number,
  longestStreak: boolean,
): void {
  trackRetentionEvent('streak_extended', userId, {
    currentStreak,
    isNewLongest: longestStreak,
  });
}

export function trackStreakMilestone(
  userId: string,
  streakDays: number,
  rewardType: string,
  rewardValue: string | number,
): void {
  trackRetentionEvent('streak_milestone', userId, {
    streakDays,
    rewardType,
    rewardValue,
  });
}

export function trackStreakBroken(
  userId: string,
  previousStreak: number,
): void {
  trackRetentionEvent('streak_broken', userId, {
    previousStreak,
  });
}

// ============================================================
// Level & Reward Events
// ============================================================

export function trackLevelUp(
  userId: string,
  previousLevel: number,
  newLevel: number,
  xpTotal: number,
): void {
  trackRetentionEvent('level_up', userId, {
    previousLevel,
    newLevel,
    xpTotal,
  });
}

export function trackRewardUnlocked(
  userId: string,
  rewardType: string,
  rewardValue: string | number,
  source: string,
): void {
  trackRetentionEvent('reward_unlocked', userId, {
    rewardType,
    rewardValue,
    source,
  });
}

export function trackRewardClaimed(
  userId: string,
  rewardType: string,
  rewardValue: string | number,
  source: string,
): void {
  trackRetentionEvent('reward_claimed', userId, {
    rewardType,
    rewardValue,
    source,
  });
}

// ============================================================
// Retention Home Events
// ============================================================

export function trackRetentionHomeViewed(
  userId: string,
  currentStreak: number,
  dailyMissionsCompleted: number,
  level: number,
): void {
  trackRetentionEvent('retention_home_viewed', userId, {
    currentStreak,
    dailyMissionsCompleted,
    level,
  });
}

export function trackDailyRushViewed(
  userId: string,
  gameId: string,
  userBestScore: number,
): void {
  trackRetentionEvent('daily_rush_viewed', userId, {
    gameId,
    userBestScore,
  });
}

// ============================================================
// Analytics Queries (for admin/future use)
// ============================================================

/**
 * Get analytics records by event name.
 */
export function getRetentionAnalyticsByEvent(
  eventName: RetentionAnalyticsEvent,
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
 * Get aggregate counts for a retention event.
 */
export function getRetentionEventAggregate(
  eventName: RetentionAnalyticsEvent,
  startDate: Date,
  endDate: Date,
): {
  count: number;
  uniqueUsers: number;
} {
  const records = getRetentionAnalyticsByEvent(eventName, {
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
 * Get user retention metrics.
 */
export function getUserRetentionMetrics(
  userId: string,
  days: number = 30,
): {
  totalMissionsStarted: number;
  totalMissionsCompleted: number;
  totalMissionsClaimed: number;
  totalStreakExtensions: number;
  totalLevelUps: number;
  totalRewardsEarned: number;
} {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);

  return {
    totalMissionsStarted: getRetentionAnalyticsByEvent('mission_started', { userId, startDate, limit: 10000 }).length,
    totalMissionsCompleted: getRetentionAnalyticsByEvent('mission_completed', { userId, startDate, limit: 10000 }).length,
    totalMissionsClaimed: getRetentionAnalyticsByEvent('mission_claimed', { userId, startDate, limit: 10000 }).length,
    totalStreakExtensions: getRetentionAnalyticsByEvent('streak_extended', { userId, startDate, limit: 10000 }).length,
    totalLevelUps: getRetentionAnalyticsByEvent('level_up', { userId, startDate, limit: 10000 }).length,
    totalRewardsEarned: getRetentionAnalyticsByEvent('reward_unlocked', { userId, startDate, limit: 10000 }).length,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearRetentionAnalytics(): void {
  analyticsStore.clear();
}

export function _getRetentionAnalyticsCount(): number {
  return analyticsStore.size;
}
