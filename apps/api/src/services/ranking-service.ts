/**
 * GTX Rush — Ranking Service v1.0
 *
 * Unified ranking engine supporting multiple scopes and types.
 * One generalized service — not separate ranking engines.
 *
 * Scopes:
 * - global: All users ranked by score
 * - country: Users filtered by country
 * - game: Game-specific rankings
 * - weekly: Rolling 7-day rankings
 * - season: Season-scoped rankings
 * - friends: Among user's connections
 *
 * Types:
 * - score: Best game scores
 * - xp: Total XP earned
 * - season: Season composite score
 *
 * Tie-breaking (deterministic):
 * 1. Higher score wins
 * 2. If tied, earlier creation/submission wins
 * 3. Never random
 *
 * SECURITY:
 * - Only VALID competitive scores contribute
 * - SUSPICIOUS scores held for review
 * - REJECTED scores never enter rankings
 */

import { nanoid } from 'nanoid';
import type {
  RankingScope,
  RankingType,
  RankingQuery,
  RankingEntry,
  RankingResponse,
  AroundMeResponse,
  TierDefinition,
} from '@gtx-rush/types';
import { getTierForScore } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL + Redis)
// ============================================================

interface RankingRecord {
  id: string;
  userId: string;
  scope: RankingScope;
  type: RankingType;
  gameId: string | null;
  countryCode: string | null;
  periodId: string | null;
  score: number;
  rank: number;
  submittedAt: Date;
  /** For tie-breaking: lower = earlier = better */
  tieBreaker: number;
}

interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  country: string;
}

const rankings = new Map<string, RankingRecord>();
const userProfiles = new Map<string, UserProfile>();

// Index: scope+type+gameId+country+period → sorted records
const scopeIndex = new Map<string, RankingRecord[]>();

// ============================================================
// Helpers
// ============================================================

function buildScopeKey(
  scope: RankingScope,
  type: RankingType,
  gameId: string | null,
  countryCode: string | null,
  periodId: string | null,
): string {
  return `${scope}:${type}:${gameId ?? '*'}:${countryCode ?? '*'}:${periodId ?? '*'}`;
}

function getUserProfile(userId: string): UserProfile {
  return userProfiles.get(userId) ?? {
    id: userId,
    displayName: `Player ${userId.slice(0, 8)}`,
    avatarUrl: null,
    level: 1,
    country: 'XX',
  };
}

/**
 * Deterministic tie-breaking:
 * 1. Higher score wins
 * 2. Earlier submission wins (lower tieBreaker = earlier = better)
 */
function compareRankings(a: RankingRecord, b: RankingRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.tieBreaker - b.tieBreaker;
}

function rebuildIndex(scopeKey: string): void {
  const records = Array.from(rankings.values())
    .filter((r) => {
      const key = buildScopeKey(r.scope, r.type, r.gameId, r.countryCode, r.periodId);
      return key === scopeKey;
    })
    .sort(compareRankings);

  // Assign ranks
  records.forEach((r, i) => {
    r.rank = i + 1;
  });

  scopeIndex.set(scopeKey, records);
}

// ============================================================
// Core Ranking Operations
// ============================================================

/**
 * Register/update a user profile for ranking display.
 */
export function setUserProfile(profile: UserProfile): void {
  userProfiles.set(profile.id, profile);
}

/**
 * Submit a score to the ranking system.
 * Only VALID scores should be submitted.
 *
 * SECURITY: The caller must validate the score before calling this.
 */
export function submitScore(
  userId: string,
  score: number,
  scope: RankingScope,
  type: RankingType,
  options: {
    gameId?: string;
    countryCode?: string;
    periodId?: string;
    seasonId?: string;
  } = {},
): RankingRecord {
  const { gameId, countryCode, periodId: rawPeriodId, seasonId } = options;
  const periodId = rawPeriodId ?? seasonId ?? null;
  const scopeKey = buildScopeKey(scope, type, gameId ?? null, countryCode ?? null, periodId ?? null);

  // Check for existing record
  const existing = Array.from(rankings.values()).find(
    (r) =>
      r.userId === userId &&
      r.scope === scope &&
      r.type === type &&
      r.gameId === (gameId ?? null) &&
      r.countryCode === (countryCode ?? null) &&
      r.periodId === (periodId ?? null),
  );

  if (existing) {
    // Update if new score is better
    if (score > existing.score) {
      existing.score = score;
      existing.submittedAt = new Date();
      existing.tieBreaker = Date.now();
    }
    rebuildIndex(scopeKey);
    return existing;
  }

  // Create new record
  const record: RankingRecord = {
    id: nanoid(),
    userId,
    score,
    scope,
    type,
    gameId: gameId ?? null,
    countryCode: countryCode ?? null,
    periodId: periodId ?? null,
    submittedAt: new Date(),
    tieBreaker: Date.now(),
    rank: 0,
  };

  rankings.set(record.id, record);
  rebuildIndex(scopeKey);

  return record;
}

/**
 * Get a leaderboard for a specific scope.
 */
export function getLeaderboard(query: RankingQuery): RankingResponse {
  const {
    scope,
    type,
    gameId,
    countryCode,
    seasonId,
    weekId,
    cursor,
    limit = 50,
  } = query;

  let periodId: string | null = null;
  if (scope === 'season' && seasonId) periodId = seasonId;
  if (scope === 'weekly' && weekId) periodId = weekId;

  const scopeKey = buildScopeKey(scope, type, gameId ?? null, countryCode ?? null, periodId);
  let records = scopeIndex.get(scopeKey);

  if (!records) {
    rebuildIndex(scopeKey);
    records = scopeIndex.get(scopeKey) ?? [];
  }

  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = records.findIndex((r) => r.userId === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = records.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < records.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.userId ?? null : null;

  // Build entries with user profiles
  const entries: RankingEntry[] = paginated.map((r) => {
    const profile = getUserProfile(r.userId);
    const { tier } = getTierForScore(r.score);
    return {
      rank: r.rank,
      userId: r.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      country: profile.country,
      score: r.score,
      tier,
    };
  });

  return {
    scope,
    type,
    entries,
    userRank: null, // Caller provides userId to get this
    totalParticipants: records.length,
    pagination: { nextCursor, hasMore },
  };
}

/**
 * Get a user's rank in a specific scope.
 */
export function getUserRank(
  userId: string,
  scope: RankingScope,
  type: RankingType,
  options: {
    gameId?: string;
    countryCode?: string;
    seasonId?: string;
    weekId?: string;
  } = {},
): RankingEntry | null {
  let periodId: string | null = null;
  if (scope === 'season' && options.seasonId) periodId = options.seasonId;
  if (scope === 'weekly' && options.weekId) periodId = options.weekId;

  const scopeKey = buildScopeKey(scope, type, options.gameId ?? null, options.countryCode ?? null, periodId);
  const records = scopeIndex.get(scopeKey) ?? [];

  const userRecord = records.find((r) => r.userId === userId);
  if (!userRecord) return null;

  const profile = getUserProfile(userId);
  const { tier } = getTierForScore(userRecord.score);

  return {
    rank: userRecord.rank,
    userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    level: profile.level,
    country: profile.country,
    score: userRecord.score,
    tier,
    isCurrentUser: true,
  };
}

/**
 * Get "around me" ranking: top N, user's position, and nearby entries.
 */
export function getAroundMe(
  userId: string,
  scope: RankingScope,
  type: RankingType,
  options: {
    gameId?: string;
    countryCode?: string;
    seasonId?: string;
    weekId?: string;
    contextSize?: number;
  } = {},
): AroundMeResponse {
  const { contextSize = 3 } = options;

  let periodId: string | null = null;
  if (scope === 'season' && options.seasonId) periodId = options.seasonId;
  if (scope === 'weekly' && options.weekId) periodId = options.weekId;

  const scopeKey = buildScopeKey(scope, type, options.gameId ?? null, options.countryCode ?? null, periodId);
  const records = scopeIndex.get(scopeKey) ?? [];

  // Top 3
  const top = records.slice(0, 3).map((r) => {
    const profile = getUserProfile(r.userId);
    const { tier } = getTierForScore(r.score);
    return {
      rank: r.rank,
      userId: r.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      level: profile.level,
      country: profile.country,
      score: r.score,
      tier,
      isCurrentUser: r.userId === userId,
    };
  });

  // User position
  const userRecord = records.find((r) => r.userId === userId);
  const userEntry: RankingEntry = userRecord
    ? (() => {
        const profile = getUserProfile(userId);
        const { tier } = getTierForScore(userRecord.score);
        return {
          rank: userRecord.rank,
          userId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          level: profile.level,
          country: profile.country,
          score: userRecord.score,
          tier,
          isCurrentUser: true,
        };
      })()
    : {
        rank: records.length + 1,
        userId,
        displayName: getUserProfile(userId).displayName,
        avatarUrl: getUserProfile(userId).avatarUrl,
        level: getUserProfile(userId).level,
        country: getUserProfile(userId).country,
        score: 0,
        tier: null,
        isCurrentUser: true,
      };

  // Nearby entries
  const userIndex = userRecord ? records.indexOf(userRecord) : records.length;
  const nearbyStart = Math.max(0, userIndex - contextSize);
  const nearbyEnd = Math.min(records.length, userIndex + contextSize + 1);

  const bottom = records
    .slice(nearbyStart, nearbyEnd)
    .filter((r) => r.userId !== userId)
    .map((r) => {
      const profile = getUserProfile(r.userId);
      const { tier } = getTierForScore(r.score);
      return {
        rank: r.rank,
        userId: r.userId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        level: profile.level,
        country: profile.country,
        score: r.score,
        tier,
      };
    });

  return {
    top,
    user: userEntry,
    bottom,
    totalParticipants: records.length,
  };
}

/**
 * Get all rankings for a user (across all scopes).
 */
export function getUserAllRanks(userId: string): {
  global: RankingEntry | null;
  country: RankingEntry | null;
  game: Record<string, RankingEntry>;
  season: RankingEntry | null;
} {
  return {
    global: getUserRank(userId, 'global', 'score'),
    country: getUserRank(userId, 'country', 'score'),
    game: {},
    season: getUserRank(userId, 'season', 'season'),
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllRankings(): void {
  rankings.clear();
  scopeIndex.clear();
}

export function _getRankingCount(): number {
  return rankings.size;
}
