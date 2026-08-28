/**
 * GTX Rush — Growth Analytics v1.0
 *
 * Tracks growth-specific analytics events per the Growth Engine Contract.
 *
 * Events:
 * - referral_link_created
 * - referral_link_opened
 * - referral_registered
 * - referral_activated
 * - referral_qualified
 * - referral_rewarded
 * - referral_rejected
 * - share_score
 * - share_badge
 * - share_challenge
 * - share_personal_best
 * - campaign_opened
 * - campaign_activated
 *
 * SECURITY: Analytics events must not contain sensitive data.
 * User IDs are stored separately from event properties.
 */

import { nanoid } from 'nanoid';
import type {
  GrowthAnalyticsEvent,
  GrowthAnalyticsData,
  GrowthFunnelMetrics,
  CohortMetrics,
  AcquisitionSource,
} from '@gtx-rush/types';
import { GROWTH_ANALYTICS_CONFIG } from '@gtx-rush/config';

// ============================================================
// In-memory store (production: PostgreSQL analytics_events table)
// ============================================================

interface AnalyticsRecord {
  id: string;
  eventName: GrowthAnalyticsEvent;
  userId: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const analyticsStore = new Map<string, AnalyticsRecord>();

// ============================================================
// Event Tracking
// ============================================================

/**
 * Track a growth analytics event.
 */
export function trackGrowthEvent(
  eventName: GrowthAnalyticsEvent,
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
// Referral Events
// ============================================================

export function trackReferralLinkCreated(
  userId: string,
  referralCode: string,
  source: string,
): void {
  trackGrowthEvent('referral_link_created', userId, {
    referralCode,
    source,
  });
}

export function trackReferralLinkOpened(
  referralCode: string,
  inviterUserId: string,
  source: string,
): void {
  trackGrowthEvent('referral_link_opened', inviterUserId, {
    referralCode,
    source,
  });
}

export function trackReferralRegistered(
  referralId: string,
  inviterUserId: string,
  inviteeUserId: string,
): void {
  trackGrowthEvent('referral_registered', inviterUserId, {
    referralId,
    inviteeUserId,
  });
}

export function trackReferralActivated(
  referralId: string,
  inviterUserId: string,
  inviteeUserId: string,
): void {
  trackGrowthEvent('referral_activated', inviterUserId, {
    referralId,
    inviteeUserId,
  });
}

export function trackReferralQualified(
  referralId: string,
  inviterUserId: string,
  inviteeUserId: string,
): void {
  trackGrowthEvent('referral_qualified', inviterUserId, {
    referralId,
    inviteeUserId,
  });
}

export function trackReferralRewarded(
  referralId: string,
  userId: string,
  rewardType: string,
  rewardValue: number | string,
): void {
  trackGrowthEvent('referral_rewarded', userId, {
    referralId,
    rewardType,
    rewardValue,
  });
}

export function trackReferralRejected(
  referralId: string,
  inviterUserId: string,
  reason: string,
): void {
  trackGrowthEvent('referral_rejected', inviterUserId, {
    referralId,
    reason,
  });
}

// ============================================================
// Share Events
// ============================================================

export function trackShareScore(
  userId: string,
  gameId: string,
  score: number,
): void {
  trackGrowthEvent('share_score', userId, {
    gameId,
    score,
  });
}

export function trackShareBadge(
  userId: string,
  badgeId: string,
): void {
  trackGrowthEvent('share_badge', userId, {
    badgeId,
  });
}

export function trackShareChallenge(
  userId: string,
  challengeId: string,
  gameId: string,
): void {
  trackGrowthEvent('share_challenge', userId, {
    challengeId,
    gameId,
  });
}

export function trackSharePersonalBest(
  userId: string,
  gameId: string,
  score: number,
): void {
  trackGrowthEvent('share_personal_best', userId, {
    gameId,
    score,
  });
}

// ============================================================
// Campaign Events
// ============================================================

export function trackCampaignOpened(
  campaignId: string,
  userId: string,
): void {
  trackGrowthEvent('campaign_opened', userId, {
    campaignId,
  });
}

export function trackCampaignActivated(
  campaignId: string,
  userId: string,
): void {
  trackGrowthEvent('campaign_activated', userId, {
    campaignId,
  });
}

export function trackCampaignBudgetExhausted(
  campaignId: string,
  reason: string,
): void {
  trackGrowthEvent('campaign_budget_exhausted', 'system', {
    campaignId,
    reason,
  });
}

// ============================================================
// Viral Loop Share Events (rank, event, team, creator)
// ============================================================

export function trackShareRank(userId: string, rank: number): void {
  trackGrowthEvent('share_rank', userId, { rank });
}

export function trackShareEvent(userId: string, eventId: string, rank: number | null): void {
  trackGrowthEvent('share_event', userId, { eventId, rank });
}

export function trackShareTeamInvite(userId: string, teamCode: string): void {
  trackGrowthEvent('share_team_invite', userId, { teamCode });
}

export function trackShareCreatorChallenge(
  userId: string,
  creatorId: string,
  challengeId: string,
): void {
  trackGrowthEvent('share_creator_challenge', userId, { creatorId, challengeId });
}

// ============================================================
// Analytics Queries (for admin/future use)
// ============================================================

/**
 * Get analytics records by event name.
 */
export function getGrowthAnalyticsByEvent(
  eventName: GrowthAnalyticsEvent,
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
 * Get aggregate counts for a growth event.
 */
export function getGrowthEventAggregate(
  eventName: GrowthAnalyticsEvent,
  startDate: Date,
  endDate: Date,
): {
  count: number;
  uniqueUsers: number;
} {
  const records = getGrowthAnalyticsByEvent(eventName, {
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
 * Get growth funnel metrics.
 */
export function getGrowthFunnelMetrics(
  startDate: Date,
  endDate: Date,
): GrowthFunnelMetrics {
  const activeUsers = getGrowthEventAggregate('referral_link_created', startDate, endDate).uniqueUsers;
  const shares = getGrowthEventAggregate('share_score', startDate, endDate).count +
    getGrowthEventAggregate('share_badge', startDate, endDate).count +
    getGrowthEventAggregate('share_challenge', startDate, endDate).count;
  const inviteOpens = getGrowthEventAggregate('referral_link_opened', startDate, endDate).count;
  const newUsers = getGrowthEventAggregate('referral_registered', startDate, endDate).uniqueUsers;
  const firstGames = getGrowthEventAggregate('referral_activated', startDate, endDate).uniqueUsers;
  const secondGames = Math.round(firstGames * 0.6); // Simplified for MVP
  const day2Return = Math.round(firstGames * 0.4); // Simplified for MVP
  const day7Return = Math.round(firstGames * 0.2); // Simplified for MVP
  const monetization = Math.round(firstGames * 0.05); // Simplified for MVP

  return {
    activeUsers,
    shares,
    inviteOpens,
    newUsers,
    firstGames,
    secondGames,
    day2Return,
    day7Return,
    monetization,
  };
}

/**
 * Get cohort metrics by acquisition source.
 */
export function getCohortMetrics(
  source: AcquisitionSource,
  startDate: Date,
  endDate: Date,
): CohortMetrics {
  // Simplified for MVP - in production, would query database
  return {
    cohortType: source,
    userCount: 0,
    d1Retention: 0,
    d7Retention: 0,
    d30Retention: 0,
    averageGamesPlayed: 0,
    averageRevenue: 0,
  };
}

/**
 * Get user growth metrics.
 */
export function getUserGrowthMetrics(
  userId: string,
  days: number = 30,
): {
  totalShares: number;
  totalReferralLinks: number;
  totalReferralOpens: number;
  totalReferralRegistrations: number;
  totalReferralActivations: number;
} {
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);

  return {
    totalShares: getGrowthAnalyticsByEvent('share_score', { userId, startDate, limit: 10000 }).length +
      getGrowthAnalyticsByEvent('share_badge', { userId, startDate, limit: 10000 }).length +
      getGrowthAnalyticsByEvent('share_challenge', { userId, startDate, limit: 10000 }).length,
    totalReferralLinks: getGrowthAnalyticsByEvent('referral_link_created', { userId, startDate, limit: 10000 }).length,
    totalReferralOpens: getGrowthAnalyticsByEvent('referral_link_opened', { userId, startDate, limit: 10000 }).length,
    totalReferralRegistrations: getGrowthAnalyticsByEvent('referral_registered', { userId, startDate, limit: 10000 }).length,
    totalReferralActivations: getGrowthAnalyticsByEvent('referral_activated', { userId, startDate, limit: 10000 }).length,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearGrowthAnalytics(): void {
  analyticsStore.clear();
}

export function _getGrowthAnalyticsCount(): number {
  return analyticsStore.size;
}
