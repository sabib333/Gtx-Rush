/**
 * GTX Rush — Economy Service v1.0
 *
 * Centralized economy service that handles:
 * - All economy changes flow through this service
 * - XP granting with idempotency
 * - Level calculations
 * - Reward transactions
 * - Economy safety checks
 *
 * SECURITY:
 * - Server is authoritative for all economy changes
 * - Every change creates an auditable transaction
 * - Idempotent operations prevent duplicate rewards
 * - Client cannot directly modify economy state
 *
 * Contract: Economy Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  EconomyXPTransaction,
  EconomyXPSource,
  EconomyRewardTransaction,
  EconomyRewardSource,
  EconomyTransactionStatus,
  EconomyXPAwardResult,
  EconomyLevelProgress,
  EconomyProfile,
  UserEconomyStats,
} from '@gtx-rush/types';
import {
  XP_CONFIG,
  LEVEL_CONFIG,
  ECONOMY_SAFETY,
  ECONOMY_FLAGS,
  getLevelFromXp,
  getLevelProgress,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const xpTransactions = new Map<string, EconomyXPTransaction>();
const userXP = new Map<string, number>();
const rewardTransactions = new Map<string, EconomyRewardTransaction>();
const dailyXP = new Map<string, Map<string, number>>();
const lastGrantTime = new Map<string, Map<string, number>>();

// ============================================================
// XP Award System
// ============================================================

/**
 * Award XP to a user.
 *
 * SECURITY:
 * - Validates source
 * - Enforces daily limits
 * - Creates auditable transaction
 * - Idempotent via idempotency key
 * - Anti-farm: minimum time between grants
 */
export function awardXP(
  userId: string,
  amount: number,
  source: EconomyXPSource,
  options: {
    referenceId?: string;
    referenceType?: string;
    idempotencyKey?: string;
    streakMultiplier?: number;
  } = {},
): EconomyXPAwardResult {
  if (!ECONOMY_FLAGS.xp_enabled) {
    return { xpAwarded: 0, newTotal: userXP.get(userId) ?? 0, level: 1, levelUp: false };
  }

  const { referenceId, referenceType, idempotencyKey, streakMultiplier = 1.0 } = options;

  // Validate amount
  if (amount <= 0 || amount > ECONOMY_SAFETY.maxXPPerTransaction) {
    return { xpAwarded: 0, newTotal: userXP.get(userId) ?? 0, level: 1, levelUp: false };
  }

  // Check idempotency
  if (idempotencyKey) {
    const existing = Array.from(xpTransactions.values()).find(
      (t) => t.referenceId === idempotencyKey,
    );
    if (existing) {
      const currentXP = userXP.get(userId) ?? 0;
      return {
        xpAwarded: 0,
        newTotal: currentXP,
        level: getLevelFromXp(currentXP),
        levelUp: false,
      };
    }
  }

  // Anti-farm: check minimum time between grants
  const userLastGrant = lastGrantTime.get(userId)?.get(source) ?? 0;
  const now = Date.now();
  if (now - userLastGrant < XP_CONFIG.minimumGrantIntervalMs) {
    return { xpAwarded: 0, newTotal: userXP.get(userId) ?? 0, level: 1, levelUp: false };
  }

  // Check daily limit
  const dailyCap = (XP_CONFIG.dailyCaps as Record<string, number>)[source] ?? 100;
  const today = new Date().toISOString().slice(0, 10);
  const userDaily = dailyXP.get(userId) ?? new Map();
  const sourceDaily = userDaily.get(source) ?? 0;

  if (sourceDaily >= dailyCap) {
    return { xpAwarded: 0, newTotal: userXP.get(userId) ?? 0, level: 1, levelUp: false };
  }

  // Apply streak multiplier
  const finalAmount = Math.round(amount * streakMultiplier);

  // Cap to daily limit
  const cappedAmount = Math.min(finalAmount, dailyCap - sourceDaily);

  // Calculate new total
  const currentTotal = userXP.get(userId) ?? 0;
  const newTotal = currentTotal + cappedAmount;
  userXP.set(userId, newTotal);

  // Update daily tracking
  userDaily.set(source, sourceDaily + cappedAmount);
  dailyXP.set(userId, userDaily);

  // Update last grant time
  const userLastGrantMap = lastGrantTime.get(userId) ?? new Map();
  userLastGrantMap.set(source, now);
  lastGrantTime.set(userId, userLastGrantMap);

  // Check for level up
  const oldLevel = getLevelFromXp(currentTotal);
  const newLevel = getLevelFromXp(newTotal);
  const levelUp = newLevel > oldLevel;

  // Create transaction
  const transaction: EconomyXPTransaction = {
    id: nanoid(),
    userId,
    amount: cappedAmount,
    source,
    referenceId: referenceId ?? null,
    referenceType: referenceType ?? null,
    balanceAfter: newTotal,
    createdAt: new Date(),
  };

  xpTransactions.set(transaction.id, transaction);

  return {
    xpAwarded: cappedAmount,
    newTotal,
    level: newLevel,
    levelUp,
    ...(levelUp ? { newLevel: LEVEL_CONFIG.levels.find((l) => l.level === newLevel) } : {}),
  };
}

/**
 * Get user's total XP
 */
export function getUserXP(userId: string): number {
  return userXP.get(userId) ?? 0;
}

/**
 * Get user's level progress
 */
export function getUserLevelProgress(userId: string): EconomyLevelProgress {
  const xp = getUserXP(userId);
  const progress = getLevelProgress(xp);
  return {
    currentLevel: progress.currentLevel,
    nextLevel: progress.nextLevel ? LEVEL_CONFIG.levels.find((l) => l.level === progress.nextLevel) ?? null : null,
    xpInCurrentLevel: progress.xpInCurrentLevel,
    xpNeeded: progress.xpNeeded,
    progress: progress.progress,
  };
}

/**
 * Get XP transaction history
 */
export function getUserXPTransactions(
  userId: string,
  options: { limit?: number; source?: EconomyXPSource } = {},
): EconomyXPTransaction[] {
  const { limit = 50, source } = options;

  return Array.from(xpTransactions.values())
    .filter((t) => t.userId === userId)
    .filter((t) => !source || t.source === source)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ============================================================
// Reward Transaction System
// ============================================================

/**
 * Create a reward transaction
 */
export function createRewardTransaction(
  userId: string,
  source: EconomyRewardSource,
  referenceId: string,
  referenceType: string,
  rewardType: string,
  rewardValue: string | number,
  options: { idempotencyKey?: string } = {},
): EconomyRewardTransaction | null {
  const { idempotencyKey } = options;

  // Check idempotency
  if (idempotencyKey) {
    const existing = Array.from(rewardTransactions.values()).find(
      (t) => t.idempotencyKey === idempotencyKey,
    );
    if (existing) return existing;
  }

  const transaction: EconomyRewardTransaction = {
    id: nanoid(),
    userId,
    source,
    referenceId,
    referenceType,
    rewardType,
    rewardValue,
    status: 'completed',
    idempotencyKey: idempotencyKey ?? `${source}:${referenceId}:${userId}:${rewardType}`,
    createdAt: new Date(),
  };

  rewardTransactions.set(transaction.id, transaction);
  return transaction;
}

/**
 * Reverse a reward transaction
 */
export function reverseRewardTransaction(
  transactionId: string,
  reason: string,
): EconomyRewardTransaction | null {
  if (!ECONOMY_SAFETY.reversal.enabled) return null;

  const original = rewardTransactions.get(transactionId);
  if (!original) return null;

  // Check reversal age
  const ageMs = Date.now() - original.createdAt.getTime();
  const maxAgeMs = ECONOMY_SAFETY.reversal.maxReversalAgeDays * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) return null;

  // Create reversal transaction
  const reversal: EconomyRewardTransaction = {
    id: nanoid(),
    userId: original.userId,
    source: 'reversal',
    referenceId: transactionId,
    referenceType: 'reversal',
    rewardType: original.rewardType,
    rewardValue: original.rewardValue,
    status: 'reversed',
    idempotencyKey: `reversal:${transactionId}`,
    createdAt: new Date(),
  };

  rewardTransactions.set(reversal.id, reversal);

  // Mark original as reversed
  original.status = 'reversed';

  return reversal;
}

/**
 * Get reward transaction history
 */
export function getRewardTransactions(
  userId: string,
  options: {
    limit?: number;
    source?: EconomyRewardSource;
    status?: EconomyTransactionStatus;
  } = {},
): EconomyRewardTransaction[] {
  const { limit = 50, source, status } = options;

  return Array.from(rewardTransactions.values())
    .filter((t) => t.userId === userId)
    .filter((t) => !source || t.source === source)
    .filter((t) => !status || t.status === status)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ============================================================
// Economy Profile
// ============================================================

/**
 * Get user's economy profile
 */
export function getEconomyProfile(userId: string): EconomyProfile {
  const totalXp = getUserXP(userId);
  const levelProgress = getUserLevelProgress(userId);
  const recentTransactions = getRewardTransactions(userId, { limit: 10 });

  return {
    userId,
    totalXp,
    currentLevel: levelProgress.currentLevel,
    levelProgress,
    inventoryCount: 0, // Will be populated by inventory service
    equippedItems: {
      profileFrame: null,
      title: null,
      avatarEffect: null,
      nameEffect: null,
    },
    recentTransactions,
  };
}

/**
 * Get user's economy stats
 */
export function getUserEconomyStats(userId: string): UserEconomyStats {
  const transactions = getRewardTransactions(userId, { limit: 1000 });

  const totalXpEarned = transactions
    .filter((t) => t.rewardType === 'xp')
    .reduce((sum, t) => sum + (Number(t.rewardValue) || 0), 0);

  const totalItemsAcquired = transactions
    .filter((t) => t.rewardType !== 'xp' && t.status === 'completed')
    .length;

  const totalPurchases = transactions
    .filter((t) => t.source === 'purchase')
    .length;

  // Count item types
  const itemTypeCounts = new Map<string, number>();
  for (const t of transactions) {
    if (t.rewardType !== 'xp' && t.status === 'completed') {
      itemTypeCounts.set(t.rewardType, (itemTypeCounts.get(t.rewardType) ?? 0) + 1);
    }
  }

  let favoriteItemType = null;
  let maxCount = 0;
  for (const [type, count] of itemTypeCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      favoriteItemType = type as any;
    }
  }

  return {
    totalXpEarned,
    totalItemsAcquired,
    totalPurchases,
    totalStarsSpent: 0, // Will be tracked by purchase service
    favoriteItemType,
  };
}

// ============================================================
// Economy Safety
// ============================================================

/**
 * Check for suspicious activity
 */
export function checkSuspiciousActivity(userId: string): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneMinuteAgo = now - 60 * 1000;

  // Check XP per hour
  const recentXP = Array.from(xpTransactions.values())
    .filter((t) => t.userId === userId && t.createdAt.getTime() > oneHourAgo)
    .reduce((sum, t) => sum + t.amount, 0);

  if (recentXP > ECONOMY_SAFETY.suspiciousThresholds.xpPerHour) {
    reasons.push('Excessive XP gain');
  }

  // Check transactions per minute
  const recentTransactions = Array.from(rewardTransactions.values())
    .filter((t) => t.userId === userId && t.createdAt.getTime() > oneMinuteAgo);

  if (recentTransactions.length > ECONOMY_SAFETY.suspiciousThresholds.transactionsPerMinute) {
    reasons.push('Excessive transactions');
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllEconomyData(): void {
  xpTransactions.clear();
  userXP.clear();
  rewardTransactions.clear();
  dailyXP.clear();
  lastGrantTime.clear();
}
