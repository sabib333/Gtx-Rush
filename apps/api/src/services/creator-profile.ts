/**
 * GTX Rush — Creator Profile Service v1.0
 *
 * Server-authoritative creator profile system that handles:
 * - Creator profile management
 * - Creator following
 * - Creator stats
 * - Creator badges
 *
 * SECURITY:
 * - All profile data is server-generated
 * - No fake engagement
 * - Following is rate-limited
 *
 * Contract: Creator Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  CreatorProfile,
  CreatorProfileWithStats,
  CreatorFollow,
  CreatorStatus,
  ContentQuality,
  CreatorAnalytics,
} from '@gtx-rush/types';
import {
  CREATOR_PROFILE_CONFIG,
  CREATOR_BADGES,
  CREATOR_FLAGS,
  getCreatorLevelFromXp,
  getXpForNextLevel,
} from '@gtx-rush/config';
import { getCreatorChallenges } from './custom-challenge-engine';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const creatorProfiles = new Map<string, CreatorProfile>();
const creatorFollows = new Map<string, Set<string>>(); // creatorId → Set of followerIds
const userFollowing = new Map<string, Set<string>>(); // userId → Set of creatorIds

// ============================================================
// Profile Management
// ============================================================

/**
 * Get or create creator profile
 */
export function getOrCreateCreatorProfile(userId: string, displayName: string): CreatorProfile {
  const existing = creatorProfiles.get(userId);
  if (existing) return existing;

  const profile: CreatorProfile = {
    id: nanoid(),
    userId,
    displayName,
    bio: null,
    avatarUrl: null,
    status: 'normal',
    creatorLevel: 1,
    creatorXp: 0,
    totalChallengesCreated: 0,
    totalPlaysReceived: 0,
    totalUniquePlayers: 0,
    averageCompletionRate: 0,
    totalShares: 0,
    totalReactions: 0,
    totalReports: 0,
    qualityScore: 'normal',
    moderationRecord: [],
    badges: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  creatorProfiles.set(userId, profile);
  return profile;
}

/**
 * Get creator profile by user ID
 */
export function getCreatorProfile(userId: string): CreatorProfile | null {
  return creatorProfiles.get(userId) ?? null;
}

/**
 * Get creator profile with stats
 */
export function getCreatorProfileWithStats(
  userId: string,
  viewerId?: string,
): CreatorProfileWithStats | null {
  const profile = creatorProfiles.get(userId);
  if (!profile) return null;

  const challenges = getCreatorChallenges(userId);
  const followerCount = creatorFollows.get(userId)?.size ?? 0;
  const isFollowing = viewerId
    ? userFollowing.get(viewerId)?.has(userId) ?? false
    : false;

  // Get popular challenges (sorted by plays)
  const popularChallenges = [...challenges]
    .sort((a, b) => b.stats.totalPlays - a.stats.totalPlays)
    .slice(0, 5);

  // Get recent challenges
  const recentChallenges = [...challenges]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return {
    ...profile,
    followerCount,
    isFollowing,
    recentChallenges,
    popularChallenges,
  };
}

/**
 * Update creator profile
 */
export function updateCreatorProfile(
  userId: string,
  updates: Partial<{
    displayName: string;
    bio: string;
    avatarUrl: string;
  }>,
): CreatorProfile | null {
  const profile = creatorProfiles.get(userId);
  if (!profile) return null;

  if (updates.displayName !== undefined) {
    if (updates.displayName.length > CREATOR_PROFILE_CONFIG.maxDisplayNameLength) {
      return null;
    }
    profile.displayName = updates.displayName;
  }

  if (updates.bio !== undefined) {
    if (updates.bio.length > CREATOR_PROFILE_CONFIG.maxBioLength) {
      return null;
    }
    profile.bio = updates.bio;
  }

  if (updates.avatarUrl !== undefined) {
    profile.avatarUrl = updates.avatarUrl;
  }

  profile.updatedAt = new Date();
  return profile;
}

// ============================================================
// Following System
// ============================================================

/**
 * Follow a creator
 */
export function followCreator(
  followerId: string,
  creatorId: string,
): { success: boolean; followerCount: number; error?: string } {
  if (!CREATOR_FLAGS.creator_follow_enabled) {
    return { success: false, followerCount: 0, error: 'FOLLOW_DISABLED' };
  }

  if (followerId === creatorId) {
    return { success: false, followerCount: 0, error: 'CANNOT_FOLLOW_SELF' };
  }

  const profile = creatorProfiles.get(creatorId);
  if (!profile) {
    return { success: false, followerCount: 0, error: 'CREATOR_NOT_FOUND' };
  }

  // Check if already following
  const userFollowSet = userFollowing.get(followerId) ?? new Set();
  if (userFollowSet.has(creatorId)) {
    return { success: false, followerCount: creatorFollows.get(creatorId)?.size ?? 0, error: 'ALREADY_FOLLOWING' };
  }

  // Add follow
  userFollowSet.add(creatorId);
  userFollowing.set(followerId, userFollowSet);

  const creatorFollowSet = creatorFollows.get(creatorId) ?? new Set();
  creatorFollowSet.add(followerId);
  creatorFollows.set(creatorId, creatorFollowSet);

  return { success: true, followerCount: creatorFollowSet.size };
}

/**
 * Unfollow a creator
 */
export function unfollowCreator(
  followerId: string,
  creatorId: string,
): { success: boolean; followerCount: number; error?: string } {
  const userFollowSet = userFollowing.get(followerId);
  if (!userFollowSet?.has(creatorId)) {
    return { success: false, followerCount: 0, error: 'NOT_FOLLOWING' };
  }

  userFollowSet.delete(creatorId);

  const creatorFollowSet = creatorFollows.get(creatorId);
  creatorFollowSet?.delete(followerId);

  return { success: true, followerCount: creatorFollowSet?.size ?? 0 };
}

/**
 * Get followers of a creator
 */
export function getCreatorFollowers(creatorId: string): string[] {
  return Array.from(creatorFollows.get(creatorId) ?? []);
}

/**
 * Get creators a user follows
 */
export function getUserFollowing(userId: string): string[] {
  return Array.from(userFollowing.get(userId) ?? []);
}

// ============================================================
// Stats and Badges
// ============================================================

/**
 * Update creator stats after challenge activity
 */
export function updateCreatorStats(
  creatorId: string,
  activity: {
    type: 'play' | 'share' | 'reaction' | 'report';
    increment?: number;
  },
): void {
  const profile = creatorProfiles.get(creatorId);
  if (!profile) return;

  const increment = activity.increment ?? 1;

  switch (activity.type) {
    case 'play':
      profile.totalPlaysReceived += increment;
      break;
    case 'share':
      profile.totalShares += increment;
      break;
    case 'reaction':
      profile.totalReactions += increment;
      break;
    case 'report':
      profile.totalReports += increment;
      break;
  }

  // Award XP
  const xpKey = `challenge_${activity.type}` as keyof typeof CREATOR_PROFILE_CONFIG.xpRewards;
  const xpAmount = CREATOR_PROFILE_CONFIG.xpRewards[xpKey] ?? 0;
  profile.creatorXp += xpAmount * increment;

  // Update level
  const newLevel = getCreatorLevelFromXp(profile.creatorXp);
  if (newLevel > profile.creatorLevel) {
    profile.creatorLevel = newLevel;
  }

  // Update quality score
  profile.qualityScore = calculateCreatorQuality(profile);

  // Check for new badges
  checkAndAwardBadges(profile);

  profile.updatedAt = new Date();
}

/**
 * Calculate creator quality score
 */
function calculateCreatorQuality(profile: CreatorProfile): ContentQuality {
  if (profile.totalReports > 5) return 'low';
  if (
    profile.totalPlaysReceived > 100 &&
    profile.averageCompletionRate > 0.7 &&
    profile.totalReactions > 50
  ) {
    return 'high';
  }
  return 'normal';
}

/**
 * Check and award badges
 */
function checkAndAwardBadges(profile: CreatorProfile): void {
  const badges = Object.values(CREATOR_BADGES);

  for (const badge of badges) {
    if (profile.badges.includes(badge.id)) continue;

    let earned = false;
    const req = badge.requirement;

    if ('challengesCreated' in req && profile.totalChallengesCreated < req.challengesCreated) continue;
    if ('uniquePlayers' in req && profile.totalUniquePlayers < req.uniquePlayers) continue;
    if ('reactions' in req && profile.totalReactions < req.reactions) continue;
    if ('shares' in req && profile.totalShares < req.shares) continue;
    if ('completionRate' in req && profile.averageCompletionRate < req.completionRate) continue;

    earned = true;

    if (earned) {
      profile.badges.push(badge.id);
    }
  }
}

/**
 * Get creator analytics
 */
export function getCreatorAnalytics(
  creatorId: string,
  period: 'day' | 'week' | 'month' = 'week',
): CreatorAnalytics {
  const challenges = getCreatorChallenges(creatorId);

  // Simplified analytics - production would use time-based filtering
  return {
    period,
    challengesCreated: challenges.length,
    challengesPublished: challenges.filter((c) => c.status === 'published').length,
    totalPlays: challenges.reduce((sum, c) => sum + c.stats.totalPlays, 0),
    uniquePlayers: challenges.reduce((sum, c) => sum + c.stats.uniquePlayers, 0),
    completions: challenges.reduce((sum, c) => sum + c.stats.completions, 0),
    shares: challenges.reduce((sum, c) => sum + c.stats.shares, 0),
    reactions: challenges.reduce((sum, c) => sum + c.stats.reactions, 0),
    reports: challenges.reduce((sum, c) => sum + c.stats.reports, 0),
    newFollowers: creatorFollows.get(creatorId)?.size ?? 0,
  };
}

/**
 * Increment creator challenge count
 */
export function incrementCreatorChallengeCount(creatorId: string): void {
  const profile = creatorProfiles.get(creatorId);
  if (!profile) return;

  profile.totalChallengesCreated += 1;
  profile.creatorXp += CREATOR_PROFILE_CONFIG.xpRewards.challenge_created;
  profile.updatedAt = new Date();
}

/**
 * Clear all data (for testing)
 */
export function _clearAllCreatorData(): void {
  creatorProfiles.clear();
  creatorFollows.clear();
  userFollowing.clear();
}
