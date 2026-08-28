/**
 * GTX Rush — Growth Cohort & Source Quality Analytics v1.0
 *
 * Measures:
 * - Acquisition attribution per source (organic, referral, challenge, ...)
 * - D1 / D7 / D30 retention per acquisition cohort (Contract §35)
 * - Growth quality score per source (Contract §36)
 * - K-factor trends over time (Contract §34)
 *
 * PHILOSOPHY:
 * High-retention growth beats low-quality viral traffic.
 * Sources are ranked by quality-adjusted growth, never raw volume.
 *
 * SECURITY / INTEGRITY:
 * - Acquisition sources are recorded server-side only
 * - Attribution is never overclaimed: unknown sources stay 'organic'
 *
 * Contract: Growth Engine Contract v1.0
 */

import type {
  AcquisitionSource,
  SourceQualityScore,
  KFactorTrendPoint,
} from '@gtx-rush/types';
import { SOURCE_QUALITY_CONFIG } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

interface AcquisitionRecord {
  userId: string;
  source: AcquisitionSource;
  acquiredAt: number;
  /** Day offsets (days since acquisition) on which the user was active */
  activeDays: Set<number>;
  gamesPlayed: number;
  revenueCents: number;
  flaggedFraud: boolean;
}

const acquisitions = new Map<string, AcquisitionRecord>(); // userId → record

// ============================================================
// Recording
// ============================================================

/**
 * Record how a user was acquired. Server-authoritative — called from
 * deep-link resolution/registration flows only.
 */
export function recordAcquisition(
  userId: string,
  source: AcquisitionSource,
): void {
  const existing = acquisitions.get(userId);
  if (existing) return; // first touch wins; do not double-attribute

  acquisitions.set(userId, {
    userId,
    source,
    acquiredAt: Date.now(),
    activeDays: new Set([0]),
    gamesPlayed: 0,
    revenueCents: 0,
    flaggedFraud: false,
  });
}

/**
 * Record a day of activity for retention measurement.
 */
export function recordActiveDay(userId: string): void {
  const record = acquisitions.get(userId);
  if (!record) return;

  const daysSince = Math.floor((Date.now() - record.acquiredAt) / (24 * 60 * 60 * 1000));
  record.activeDays.add(daysSince);
}

export function recordGamePlayed(userId: string): void {
  const record = acquisitions.get(userId);
  if (!record) return;
  record.gamesPlayed++;
  recordActiveDay(userId);
}

export function recordRevenue(userId: string, cents: number): void {
  const record = acquisitions.get(userId);
  if (!record) return;
  record.revenueCents += cents;
}

export function flagAcquisitionFraud(userId: string): void {
  const record = acquisitions.get(userId);
  if (!record) return;
  record.flaggedFraud = true;
}

// ============================================================
// Retention by Cohort
// ============================================================

function isRetained(record: AcquisitionRecord, dayOffset: number): boolean {
  // A cohort counts as retained on day N if active on day N or later
  // within a grace window (users who installed late in a day).
  for (let d = dayOffset; d <= dayOffset + 1; d++) {
    if (record.activeDays.has(d)) return true;
  }
  return false;
}

function computeCohortStats(source: AcquisitionSource): {
  users: number;
  d1: number;
  d7: number;
  d30: number;
  avgGames: number;
  avgRevenue: number;
  fraudRate: number;
  activationRate: number;
} {
  let users = 0;
  let d1 = 0;
  let d7 = 0;
  let d30 = 0;
  let totalGames = 0;
  let totalRevenue = 0;
  let fraudulent = 0;
  let activated = 0;

  for (const record of acquisitions.values()) {
    if (record.source !== source) continue;
    users++;
    totalGames += record.gamesPlayed;
    totalRevenue += record.revenueCents;
    if (record.flaggedFraud) fraudulent++;
    if (record.gamesPlayed >= 1) activated++;
    if (isRetained(record, 1)) d1++;
    if (isRetained(record, 7)) d7++;
    if (isRetained(record, 30)) d30++;
  }

  return {
    users,
    d1: users > 0 ? d1 / users : 0,
    d7: users > 0 ? d7 / users : 0,
    d30: users > 0 ? d30 / users : 0,
    avgGames: users > 0 ? totalGames / users : 0,
    avgRevenue: users > 0 ? totalRevenue / users : 0,
    fraudRate: users > 0 ? fraudulent / users : 0,
    activationRate: users > 0 ? activated / users : 0,
  };
}

/**
 * Get retention metrics for one acquisition source.
 */
export function getCohortRetention(source: AcquisitionSource): {
  userCount: number;
  d1Retention: number;
  d7Retention: number;
  d30Retention: number;
  averageGamesPlayed: number;
  averageRevenueCents: number;
} {
  const stats = computeCohortStats(source);
  return {
    userCount: stats.users,
    d1Retention: stats.d1,
    d7Retention: stats.d7,
    d30Retention: stats.d30,
    averageGamesPlayed: stats.avgGames,
    averageRevenueCents: stats.avgRevenue,
  };
}

// ============================================================
// Source Quality Score (Contract §36)
// ============================================================

/**
 * Quality-adjusted score (0-100) for an acquisition source.
 * Deliberately weights retention and activation over raw volume,
 * and penalizes fraud-heavy sources.
 */
export function getSourceQualityScore(source: AcquisitionSource): SourceQualityScore {
  const stats = computeCohortStats(source);
  const w = SOURCE_QUALITY_CONFIG.weights;

  // Engagement normalized: 5+ games/user is considered strong engagement
  const engagementScore = Math.min(1, stats.avgGames / 5);
  // Monetization normalized: $5 average revenue is considered strong
  const monetizationScore = Math.min(1, stats.avgRevenue / 500);

  const qualityScore =
    stats.activationRate * w.activationRate +
    stats.d1 * w.d1Retention +
    stats.d7 * w.d7Retention +
    engagementScore * w.engagementScore +
    (1 - stats.fraudRate) * w.fraudPenalty +
    monetizationScore * w.monetizationScore;

  return {
    source,
    activationRate: stats.activationRate,
    d1Retention: stats.d1,
    d7Retention: stats.d7,
    engagementScore,
    fraudRate: stats.fraudRate,
    monetizationScore,
    qualityScore: Math.round(qualityScore * 100),
  };
}

/**
 * Rank all known acquisition sources by quality score (best first).
 */
export function getRankedSourcesByQuality(): SourceQualityScore[] {
  const sources: AcquisitionSource[] = [
    'organic',
    'referral',
    'challenge',
    'campaign',
    'shared_score',
    'shared_badge',
  ];

  return sources
    .map((source) => getSourceQualityScore(source))
    .filter((score) => {
      const stats = computeCohortStats(score.source);
      return stats.users > 0;
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

// ============================================================
// K-Factor Trend (Contract §34)
// ============================================================

interface DailyGrowthCounters {
  invites: number;       // referral links created/shared
  activeUsers: number;   // distinct sharers
  qualifiedReferrals: number;
  newUsers: number;
}

const dailyCounters = new Map<string, DailyGrowthCounters>(); // YYYY-MM-DD → counters
const dailyActiveSharers = new Map<string, Set<string>>();

export function trackDailyInvite(dateKey: string, userId: string): void {
  const counters = getDayCounters(dateKey);
  counters.invites++;
  let sharers = dailyActiveSharers.get(dateKey);
  if (!sharers) {
    sharers = new Set();
    dailyActiveSharers.set(dateKey, sharers);
  }
  sharers.add(userId);
}

export function trackDailyQualifiedReferral(dateKey: string): void {
  getDayCounters(dateKey).qualifiedReferrals++;
}

export function trackDailyNewUser(dateKey: string): void {
  getDayCounters(dateKey).newUsers++;
}

function getDayCounters(dateKey: string): DailyGrowthCounters {
  let counters = dailyCounters.get(dateKey);
  if (!counters) {
    counters = { invites: 0, activeUsers: 0, qualifiedReferrals: 0, newUsers: 0 };
    dailyCounters.set(dateKey, counters);
  }
  return counters;
}

/**
 * K-factor trend over the last N days:
 *   K = invites per active user × invite-to-qualified conversion
 */
export function getKFactorTrend(days: number = 14): KFactorTrendPoint[] {
  const points: KFactorTrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const dateKey = date.toISOString().slice(0, 10);

    const counters = dailyCounters.get(dateKey);
    if (!counters) {
      points.push({
        date: dateKey,
        invitesPerActiveUser: 0,
        inviteToQualifiedConversion: 0,
        kFactor: 0,
      });
      continue;
    }

    const activeUsers = dailyActiveSharers.get(dateKey)?.size ?? 0;
    const invitesPerActiveUser = activeUsers > 0 ? counters.invites / activeUsers : 0;
    const conversion =
      counters.invites > 0 ? counters.qualifiedReferrals / counters.invites : 0;

    points.push({
      date: dateKey,
      invitesPerActiveUser,
      inviteToQualifiedConversion: conversion,
      kFactor: invitesPerActiveUser * conversion,
    });
  }

  return points;
}

// ============================================================
// Cleanup / Testing
// ============================================================

/** Test hook: backdate an acquisition so retention windows can be evaluated. */
export function _setAcquisitionTime(userId: string, acquiredAt: number): void {
  const record = acquisitions.get(userId);
  if (!record) return;
  const shift = record.acquiredAt - acquiredAt;
  record.acquiredAt = acquiredAt;
  // Shift recorded active days forward so relative offsets stay correct
  const shifted = new Set<number>();
  for (const day of record.activeDays) shifted.add(Math.max(0, day - Math.round(shift / (24 * 60 * 60 * 1000))));
  record.activeDays = shifted;
}

export function _clearGrowthCohorts(): void {
  acquisitions.clear();
  dailyCounters.clear();
  dailyActiveSharers.clear();
}
