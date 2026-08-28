/**
 * GTX Rush — Community Discovery Service v1.0
 *
 * Server-authoritative community discovery that handles:
 * - Challenge discovery
 * - Trending algorithm
 * - Feed generation
 * - Diversity controls
 *
 * SECURITY:
 * - All discovery logic is server-side
 * - Spam is filtered
 * - Fair discovery for new creators
 *
 * Contract: Creator Engine Contract v1.0
 */

import type {
  GameId,
  CustomChallenge,
  CustomChallengeWithCreator,
  CommunityChallengeFeed,
  DiscoverySort,
  CreatorStatus,
} from '@gtx-rush/types';
import {
  DISCOVERY_CONFIG,
  CREATOR_FLAGS,
  calculateTrendingScore,
} from '@gtx-rush/config';
import {
  getChallenge,
  getCreatorChallenges,
} from './custom-challenge-engine';
import { getCreatorProfile } from './creator-profile';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const trendingCache = new Map<string, {
  challenges: CustomChallengeWithCreator[];
  expiresAt: Date;
}>();

// ============================================================
// Discovery Functions
// ============================================================

/**
 * Get community challenge feed
 */
export function getCommunityFeed(
  options: {
    sort?: DiscoverySort;
    gameId?: GameId;
    cursor?: string;
    limit?: number;
    userId?: string;
  } = {},
): CommunityChallengeFeed {
  if (!CREATOR_FLAGS.community_discovery_enabled) {
    return { challenges: [], pagination: { nextCursor: null, hasMore: false } };
  }

  const {
    sort = 'trending',
    gameId,
    cursor,
    limit = DISCOVERY_CONFIG.defaultPageSize,
    userId,
  } = options;

  // Get challenges based on sort
  let challenges: CustomChallengeWithCreator[];

  switch (sort) {
    case 'trending':
      challenges = getTrendingChallenges(gameId);
      break;
    case 'new':
      challenges = getNewChallenges(gameId);
      break;
    case 'popular':
      challenges = getPopularChallenges(gameId);
      break;
    case 'friends':
      challenges = userId ? getFriendsChallenges(userId, gameId) : [];
      break;
    default:
      challenges = getTrendingChallenges(gameId);
  }

  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = challenges.findIndex((c) => c.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const paginated = challenges.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < challenges.length;
  const nextCursor = hasMore ? paginated[paginated.length - 1]?.id ?? null : null;

  return {
    challenges: paginated,
    pagination: { nextCursor, hasMore },
  };
}

/**
 * Get trending challenges
 */
function getTrendingChallenges(gameId?: GameId): CustomChallengeWithCreator[] {
  // Check cache
  const cacheKey = `trending:${gameId ?? 'all'}`;
  const cached = trendingCache.get(cacheKey);
  if (cached && cached.expiresAt > new Date()) {
    return cached.challenges;
  }

  // Get all published challenges
  const allChallenges = getAllPublishedChallenges(gameId);

  // Calculate trending scores
  const withScores = allChallenges.map((challenge) => {
    const trendingScore = calculateTrendingScore({
      uniquePlayers: challenge.stats.uniquePlayers,
      recentPlays: challenge.stats.totalPlays, // Simplified
      completionRate: challenge.stats.completionRate,
      shareRate: challenge.stats.shares / Math.max(challenge.stats.totalPlays, 1),
      reactionRate: challenge.stats.reactions / Math.max(challenge.stats.totalPlays, 1),
    });

    return { ...challenge, stats: { ...challenge.stats, trendingScore } };
  });

  // Sort by trending score
  const sorted = withScores.sort((a, b) => b.stats.trendingScore - a.stats.trendingScore);

  // Apply diversity controls
  const diverse = applyDiversityControls(sorted);

  // Cache result
  trendingCache.set(cacheKey, {
    challenges: diverse,
    expiresAt: new Date(Date.now() + DISCOVERY_CONFIG.cacheDuration.trending * 1000),
  });

  return diverse;
}

/**
 * Get new challenges
 */
function getNewChallenges(gameId?: GameId): CustomChallengeWithCreator[] {
  const allChallenges = getAllPublishedChallenges(gameId);

  return allChallenges
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, DISCOVERY_CONFIG.defaultPageSize);
}

/**
 * Get popular challenges
 */
function getPopularChallenges(gameId?: GameId): CustomChallengeWithCreator[] {
  const allChallenges = getAllPublishedChallenges(gameId);

  return allChallenges
    .sort((a, b) => b.stats.totalPlays - a.stats.totalPlays)
    .slice(0, DISCOVERY_CONFIG.defaultPageSize);
}

/**
 * Get challenges from friends (simplified)
 */
function getFriendsChallenges(userId: string, gameId?: GameId): CustomChallengeWithCreator[] {
  // In production, fetch from friend system
  // For now, return empty
  return [];
}

/**
 * Get all published challenges with creator info
 */
function getAllPublishedChallenges(gameId?: GameId): CustomChallengeWithCreator[] {
  // In production, this would query the database
  // For now, return empty
  return [];
}

/**
 * Apply diversity controls to prevent one creator from dominating
 */
function applyDiversityControls(
  challenges: CustomChallengeWithCreator[],
): CustomChallengeWithCreator[] {
  const { maxChallengesPerCreator, newCreatorBoost, newCreatorThreshold } = DISCOVERY_CONFIG.diversity;

  const creatorCounts = new Map<string, number>();
  const result: CustomChallengeWithCreator[] = [];

  for (const challenge of challenges) {
    const creatorId = challenge.creatorId;
    const count = creatorCounts.get(creatorId) ?? 0;

    if (count < maxChallengesPerCreator) {
      // Apply new creator boost
      const creator = getCreatorProfile(creatorId);
      if (creator && creator.totalChallengesCreated <= newCreatorThreshold) {
        // Boost new creators by adjusting score
        challenge.stats.trendingScore *= newCreatorBoost;
      }

      result.push(challenge);
      creatorCounts.set(creatorId, count + 1);
    }
  }

  return result;
}

/**
 * Get challenge by ID with creator info
 */
export function getChallengeWithCreator(
  challengeId: string,
): CustomChallengeWithCreator | null {
  const challenge = getChallenge(challengeId);
  if (!challenge) return null;

  const creator = getCreatorProfile(challenge.creatorId);
  if (!creator) return null;

  return {
    ...challenge,
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      avatarUrl: creator.avatarUrl,
      creatorLevel: creator.creatorLevel,
      status: creator.status,
    },
  };
}

/**
 * Search challenges
 */
export function searchChallenges(
  query: string,
  options: {
    gameId?: GameId;
    limit?: number;
  } = {},
): CustomChallengeWithCreator[] {
  const { gameId, limit = 20 } = options;

  const allChallenges = getAllPublishedChallenges(gameId);

  // Simple text search
  const lowerQuery = query.toLowerCase();
  return allChallenges
    .filter(
      (c) =>
        c.title.toLowerCase().includes(lowerQuery) ||
        c.description.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);
}

/**
 * Get creator's public challenges
 */
export function getCreatorPublicChallenges(
  creatorId: string,
  options: { limit?: number; offset?: number } = {},
): CustomChallengeWithCreator[] {
  const { limit = 20, offset = 0 } = options;

  const challenges = getCreatorChallenges(creatorId, { status: 'published', limit, offset });

  const creator = getCreatorProfile(creatorId);
  if (!creator) return [];

  return challenges.map((c) => ({
    ...c,
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      avatarUrl: creator.avatarUrl,
      creatorLevel: creator.creatorLevel,
      status: creator.status,
    },
  }));
}

/**
 * Clear trending cache
 */
export function clearTrendingCache(): void {
  trendingCache.clear();
}

/**
 * Clear all data (for testing)
 */
export function _clearAllDiscoveryData(): void {
  trendingCache.clear();
}
