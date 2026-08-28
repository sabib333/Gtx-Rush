/**
 * GTX Rush — Tier System v1.0
 *
 * Manages competitive tiers:
 * - Tier evaluation based on season score
 * - Promotion and demotion logic
 * - Division tracking within tiers
 * - Historical tier preservation
 *
 * Tiers:
 * Bronze → Silver → Gold → Platinum → Diamond → Master → Legend
 *
 * Each tier has 3 divisions (I, II, III) except Legend (no divisions).
 *
 * SECURITY:
 * - Tier is calculated server-side from season score
 * - Cannot be manipulated from client
 * - Historical tiers are preserved
 */

import { nanoid } from 'nanoid';
import type {
  TierName,
  UserTier,
  UserTierWithDefinition,
  TierDefinition,
} from '@gtx-rush/types';
import {
  TIER_DEFINITIONS,
  getTierByName,
  getTierForScore,
  getNextTier,
  getPreviousTier,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL)
// ============================================================

const userTiers = new Map<string, UserTier>();

// ============================================================
// Tier Evaluation
// ============================================================

/**
 * Evaluate a user's tier based on their season score.
 * Returns the appropriate tier and division.
 */
export function evaluateTier(score: number): { tierName: TierName; division: number } {
  const { tier, division } = getTierForScore(score);
  return { tierName: tier.name as TierName, division };
}

/**
 * Get or create a user's tier for a season.
 */
export function getUserTier(userId: string, seasonId: string): UserTier | null {
  return userTiers.get(`${seasonId}:${userId}`) ?? null;
}

/**
 * Initialize or update a user's tier based on their season score.
 */
function initializeOrUpdateTier(
  userId: string,
  seasonId: string,
  score: number,
): UserTier {
  const key = `${seasonId}:${userId}`;
  const existing = userTiers.get(key);

  const { tierName, division } = evaluateTier(score);
  const tierDef = getTierByName(tierName);
  const nextTier = getNextTier(tierName);
  const prevTier = getPreviousTier(tierName);

  if (existing) {
    const oldTierName = existing.tierName;
    existing.score = score;
    existing.tierName = tierName;
    existing.division = division;
    existing.updatedAt = new Date();

    // Update thresholds
    if (tierDef) {
      existing.promotionThreshold = tierDef.minScore;
      existing.demotionThreshold = prevTier?.maxScore ?? 0;
    }

    // Check for promotion/demotion
    if (oldTierName !== tierName) {
      const oldIndex = TIER_DEFINITIONS.findIndex((t) => t.name === oldTierName);
      const newIndex = TIER_DEFINITIONS.findIndex((t) => t.name === tierName);

      if (newIndex > oldIndex) {
        existing.promotedAt = new Date();
      } else {
        existing.demotedAt = new Date();
      }
    }

    return existing;
  }

  // Create new tier record
  const userTier: UserTier = {
    id: nanoid(),
    userId,
    seasonId,
    tierName,
    division,
    score,
    promotionThreshold: tierDef?.minScore ?? 0,
    demotionThreshold: prevTier?.maxScore ?? 0,
    promotedAt: null,
    demotedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  userTiers.set(key, userTier);
  return userTier;
}

/**
 * Process tier updates for all users in a season.
 * Called after season rankings are updated.
 * Accepts rankings as a parameter to avoid circular dependencies.
 */
export function processTierUpdates(
  seasonId: string,
  rankings: Array<{ userId: string; score: number }>,
): {
  promoted: Array<{ userId: string; from: string; to: string }>;
  demoted: Array<{ userId: string; from: string; to: string }>;
} {
  const promoted: Array<{ userId: string; from: string; to: string }> = [];
  const demoted: Array<{ userId: string; from: string; to: string }> = [];

  for (const ranking of rankings) {
    const oldTier = getUserTier(ranking.userId, seasonId);
    const oldTierName = oldTier?.tierName ?? 'bronze';

    const newTier = initializeOrUpdateTier(ranking.userId, seasonId, ranking.score);

    if (oldTierName !== newTier.tierName) {
      const oldIndex = TIER_DEFINITIONS.findIndex((t) => t.name === oldTierName);
      const newIndex = TIER_DEFINITIONS.findIndex((t) => t.name === newTier.tierName);

      if (newIndex > oldIndex) {
        promoted.push({ userId: ranking.userId, from: oldTierName, to: newTier.tierName });
      } else {
        demoted.push({ userId: ranking.userId, from: oldTierName, to: newTier.tierName });
      }
    }
  }

  return { promoted, demoted };
}

/**
 * Get a user's tier with full definition details.
 */
export function getUserTierWithDefinition(
  userId: string,
  seasonId: string,
): UserTierWithDefinition | null {
  const userTier = getUserTier(userId, seasonId);
  if (!userTier) return null;

  const tier = getTierByName(userTier.tierName) ?? TIER_DEFINITIONS[0]!;
  const divisionConfig = tier.DivisionConfig.find((d) => d.division === userTier.division)
    ?? tier.DivisionConfig[0]!;
  const nextTier = getNextTier(userTier.tierName);
  const previousTier = getPreviousTier(userTier.tierName);

  return {
    ...userTier,
    tier,
    divisionConfig,
    nextTier,
    previousTier,
  };
}

/**
 * Get all tiers for a user across all seasons.
 */
export function getUserTierHistory(userId: string): UserTier[] {
  return Array.from(userTiers.values())
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllTiers(): void {
  userTiers.clear();
}
