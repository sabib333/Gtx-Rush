/**
 * GTX Rush — Badge Engine v1.0
 *
 * Event-driven badge evaluation system.
 *
 * Flow:
 * Game completed → Badge service evaluates criteria → Badge unlocked → Reward transaction → Notification → Analytics
 *
 * Features:
 * - Event-driven: triggered by game events, not periodic scans
 * - Criteria evaluation: threshold-based, game-specific, time-windowed
 * - Duplicate prevention: each badge earned once per user
 * - Reward distribution: XP + optional title/cosmetic
 *
 * SECURITY:
 * - Criteria evaluated server-side only
 * - Badges cannot be duplicated
 * - Rewards are idempotent
 */

import { nanoid } from 'nanoid';
import type {
  Badge,
  BadgeCriteria,
  BadgeCriteriaType,
  UserBadge,
  RewardTransaction,
} from '@gtx-rush/types';
import {
  BADGE_DEFINITIONS,
  type BadgeDefinition,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL)
// ============================================================

const earnedBadges = new Map<string, UserBadge>(); // key: userId:badgeSlug
const rewardTransactions = new Map<string, RewardTransaction>();

// ============================================================
// Event Types
// ============================================================

export interface BadgeEvaluationEvent {
  type: BadgeCriteriaType;
  userId: string;
  /** Value to compare against threshold */
  value: number;
  /** Game ID if game-specific */
  gameId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

// ============================================================
// Badge Evaluation
// ============================================================

/**
 * Evaluate all badges for a given event.
 * Returns newly unlocked badges.
 */
export function evaluateBadges(event: BadgeEvaluationEvent): Badge[] {
  const newlyUnlocked: Badge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    // Check if criteria matches
    if (def.criteriaType !== event.type) continue;
    if (def.gameId && def.gameId !== event.gameId) continue;
    if (event.value < def.threshold) continue;

    // Check if already earned
    const key = `${event.userId}:${def.slug}`;
    if (earnedBadges.has(key)) continue;

    // Check time window if applicable
    if (def.timeWindowDays && def.timeWindowDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - def.timeWindowDays);
      // In production, check if user had any qualifying events in the window
      // For MVP, we unlock immediately if criteria met
    }

    // Unlock badge
    const userBadge: UserBadge = {
      id: nanoid(),
      userId: event.userId,
      badgeId: def.slug, // Using slug as ID for in-memory; in production, use UUID
      earnedAt: new Date(),
    };

    earnedBadges.set(key, userBadge);

    // Create reward transaction
    if (def.rewardXp > 0 || def.rewardTitleId) {
      const idempotencyKey = `badge_reward:${def.slug}:${event.userId}`;
      const existing = Array.from(rewardTransactions.values()).find(
        (t) => t.idempotencyKey === idempotencyKey,
      );

      if (!existing) {
        const transaction: RewardTransaction = {
          id: nanoid(),
          userId: event.userId,
          source: 'badge_reward',
          referenceId: def.slug,
          referenceType: 'badge',
          xp: def.rewardXp,
          titleId: def.rewardTitleId ?? null,
          cosmeticId: null,
          badgeId: def.slug,
          idempotencyKey,
          claimedAt: new Date(),
          createdAt: new Date(),
        };

        rewardTransactions.set(transaction.id, transaction);
      }
    }

    // Build Badge object from definition
    const badge: Badge = {
      id: def.slug,
      slug: def.slug,
      name: def.name,
      description: def.description,
      iconUrl: def.iconUrl,
      category: def.category,
      rarity: def.rarity,
      criteria: {
        type: def.criteriaType,
        threshold: def.threshold,
        gameId: def.gameId,
        timeWindowDays: def.timeWindowDays,
      },
      reward: {
        xp: def.rewardXp,
        titleId: def.rewardTitleId,
      },
      isActive: true,
      createdAt: new Date(),
    };

    newlyUnlocked.push(badge);
  }

  return newlyUnlocked;
}

/**
 * Get all earned badges for a user.
 */
export function getUserBadges(userId: string): Badge[] {
  const badges: Badge[] = [];

  for (const [key, userBadge] of earnedBadges.entries()) {
    if (key.startsWith(`${userId}:`)) {
      const slug = key.split(':')[1];
      const def = BADGE_DEFINITIONS.find((b) => b.slug === slug);
      if (def) {
        badges.push({
          id: def.slug,
          slug: def.slug,
          name: def.name,
          description: def.description,
          iconUrl: def.iconUrl,
          category: def.category,
          rarity: def.rarity,
          criteria: {
            type: def.criteriaType,
            threshold: def.threshold,
            gameId: def.gameId,
            timeWindowDays: def.timeWindowDays,
          },
          reward: {
            xp: def.rewardXp,
            titleId: def.rewardTitleId,
          },
          isActive: true,
          createdAt: userBadge.earnedAt,
        });
      }
    }
  }

  return badges;
}

/**
 * Check if a user has a specific badge.
 */
export function hasBadge(userId: string, badgeSlug: string): boolean {
  return earnedBadges.has(`${userId}:${badgeSlug}`);
}

/**
 * Get badge unlock count for a user.
 */
export function getBadgeCount(userId: string): number {
  let count = 0;
  for (const key of earnedBadges.keys()) {
    if (key.startsWith(`${userId}:`)) count++;
  }
  return count;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllBadges(): void {
  earnedBadges.clear();
  rewardTransactions.clear();
}
