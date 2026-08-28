/**
 * GTX Rush — Season Progression Engine v1.0
 *
 * Manages season XP and level progression:
 * - Server-authoritative season XP tracking
 * - Level calculation from XP
 * - Level-up detection and notifications
 * - XP transactions with idempotency
 * - Separate from core account XP
 *
 * SECURITY:
 * - All XP awards are server-authoritative
 * - Idempotent XP transactions
 * - Cannot manipulate season level from client
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  SeasonProgression,
  SeasonXpTransaction,
  SeasonXpSource,
} from '@gtx-rush/types';
import { calculateSeasonLevel, getSeasonLevelXp } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const progressions = new Map<string, SeasonProgression>();
const xpTransactions = new Map<string, SeasonXpTransaction>();

// Index: userId:seasonId → progressionId
const progressionIndex = new Map<string, string>();

// ============================================================
// Progression Management
// ============================================================

/**
 * Get or create a user's season progression.
 */
export function getOrCreateProgression(userId: string, seasonId: string): SeasonProgression {
  const key = `${userId}:${seasonId}`;
  const existingId = progressionIndex.get(key);

  if (existingId) {
    const progression = progressions.get(existingId);
    if (progression) return progression;
  }

  const progression: SeasonProgression = {
    userId,
    seasonId,
    seasonXp: 0,
    seasonLevel: 1,
    totalXpEarned: 0,
    lastXpAwardedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  progressions.set(key, progression);
  progressionIndex.set(key, key);

  return progression;
}

/**
 * Get a user's season progression.
 */
export function getSeasonProgression(userId: string, seasonId: string): SeasonProgression | null {
  return progressions.get(`${userId}:${seasonId}`) ?? null;
}

// ============================================================
// XP Awarding
// ============================================================

/**
 * Award season XP to a user.
 *
 * SECURITY:
 * - Idempotent: duplicate transactions are prevented
 * - Server-authoritative: never trust client-provided XP
 * - Auditable: all XP changes are recorded
 *
 * Returns the updated progression and whether a level-up occurred.
 */
export function awardSeasonXp(params: {
  userId: string;
  seasonId: string;
  amount: number;
  source: SeasonXpSource;
  referenceId?: string;
  referenceType?: string;
  idempotencyKey?: string;
}): {
  success: boolean;
  progression: SeasonProgression;
  levelUp: boolean;
  previousLevel: number;
  newLevel: number;
  error?: string;
} {
  const { userId, seasonId, amount, source, referenceId, referenceType, idempotencyKey } = params;

  // Validate amount
  if (amount <= 0) {
    return {
      success: false,
      progression: getOrCreateProgression(userId, seasonId),
      levelUp: false,
      previousLevel: 1,
      newLevel: 1,
      error: 'INVALID_AMOUNT',
    };
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = Array.from(xpTransactions.values()).find(
      (t) => t.idempotencyKey === idempotencyKey,
    );
    if (existing) {
      const progression = getOrCreateProgression(userId, seasonId);
      return {
        success: false,
        progression,
        levelUp: false,
        previousLevel: progression.seasonLevel,
        newLevel: progression.seasonLevel,
        error: 'DUPLICATE_TRANSACTION',
      };
    }
  }

  const progression = getOrCreateProgression(userId, seasonId);
  const previousLevel = progression.seasonLevel;

  // Award XP
  progression.seasonXp += amount;
  progression.totalXpEarned += amount;
  progression.lastXpAwardedAt = new Date();
  progression.updatedAt = new Date();

  // Calculate new level
  const { level: newLevel } = calculateSeasonLevel(progression.seasonXp);
  progression.seasonLevel = newLevel;

  // Record transaction
  const transaction: SeasonXpTransaction = {
    id: nanoid(),
    userId,
    seasonId,
    amount,
    source,
    referenceId: referenceId ?? null,
    referenceType: referenceType ?? null,
    balanceAfter: progression.seasonXp,
    idempotencyKey: idempotencyKey ?? nanoid(),
    createdAt: new Date(),
  };

  xpTransactions.set(transaction.id, transaction);

  const levelUp = newLevel > previousLevel;

  return {
    success: true,
    progression,
    levelUp,
    previousLevel,
    newLevel,
  };
}

/**
 * Get a user's XP transactions for a season.
 */
export function getSeasonXpTransactions(
  userId: string,
  seasonId: string,
  options: { limit?: number; offset?: number } = {},
): SeasonXpTransaction[] {
  const { limit = 50, offset = 0 } = options;

  return Array.from(xpTransactions.values())
    .filter((t) => t.userId === userId && t.seasonId === seasonId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(offset, offset + limit);
}

/**
 * Get a user's total season XP from all sources.
 */
export function getTotalSeasonXp(userId: string, seasonId: string): number {
  const progression = getSeasonProgression(userId, seasonId);
  return progression?.totalXpEarned ?? 0;
}

/**
 * Calculate level details for a given XP amount.
 */
export function getLevelDetails(seasonXp: number): {
  currentLevel: number;
  xpInCurrentLevel: number;
  xpToNextLevel: number;
  progress: number;
} {
  const { level, xpInCurrentLevel, xpToNextLevel } = calculateSeasonLevel(seasonXp);
  const progress = xpToNextLevel > 0 ? xpInCurrentLevel / xpToNextLevel : 1;

  return {
    currentLevel: level,
    xpInCurrentLevel,
    xpToNextLevel,
    progress: Math.min(progress, 1),
  };
}

// ============================================================
// Season Reset
// ============================================================

/**
 * Reset season progression for a user.
 *
 * Called during season transition.
 * What resets: seasonXp, seasonLevel, seasonMissions
 * What does NOT reset: account, inventory, owned cosmetics, lifetime stats
 */
export function resetSeasonProgression(userId: string, seasonId: string): void {
  const progression = getSeasonProgression(userId, seasonId);
  if (progression) {
    progression.seasonXp = 0;
    progression.seasonLevel = 1;
    progression.totalXpEarned = 0;
    progression.lastXpAwardedAt = null;
    progression.updatedAt = new Date();
  }
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearSeasonProgression(): void {
  progressions.clear();
  xpTransactions.clear();
  progressionIndex.clear();
}

export function _getProgressionCount(): number {
  return progressions.size;
}

export function _getXpTransactionCount(): number {
  return xpTransactions.size;
}
