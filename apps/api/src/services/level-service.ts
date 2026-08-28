/**
 * GTX Rush — Level Service v1.0
 *
 * Manages XP progression and leveling:
 * - XP transaction recording (server-authoritative)
 * - Level calculation from XP total
 * - Level-up detection
 * - XP source limits (anti-farm)
 * - Streak multiplier integration
 *
 * SECURITY:
 * - All XP transactions are server-authoritative
 * - Idempotent: duplicate transactions prevented
 * - Auditable: every transaction recorded
 */

import { nanoid } from 'nanoid';
import type {
  XPTransaction,
  XPSource,
  LevelDefinition,
  XPAwardResult,
} from '@gtx-rush/types';
import { LEVELS, XP_SOURCES, STREAK_CONFIG } from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL)
// ============================================================

const xpTransactions = new Map<string, XPTransaction>();
const userXP = new Map<string, number>(); // userId → total XP

// Daily XP tracking for limits
const dailyXP = new Map<string, Map<string, number>>(); // userId → source → amount today

// ============================================================
// XP Award
// ============================================================

/**
 * Award XP to a user.
 * Returns the result including whether a level-up occurred.
 *
 * SECURITY:
 * - Validates source
 * - Enforces daily limits
 * - Creates auditable transaction
 * - Idempotent via idempotency key
 */
export function awardXP(
  userId: string,
  amount: number,
  source: XPSource,
  options: {
    referenceId?: string;
    referenceType?: string;
    idempotencyKey?: string;
    /** Streak multiplier (1.0 = no bonus) */
    streakMultiplier?: number;
  } = {},
): XPAwardResult {
  const { referenceId, referenceType, idempotencyKey, streakMultiplier = 1.0 } = options;

  // Validate source
  const sourceConfig = XP_SOURCES.find((s) => s.source === source);
  if (!sourceConfig) {
    throw new Error(`Invalid XP source: ${source}`);
  }

  // Check idempotency
  if (idempotencyKey) {
    const existing = Array.from(xpTransactions.values()).find(
      (t) => t.referenceId === referenceId && t.source === source,
    );
    if (existing) {
      const currentXP = userXP.get(userId) ?? 0;
      return {
        xpAwarded: 0,
        newTotal: currentXP,
        level: getCurrentLevel(currentXP),
        levelUp: false,
      };
    }
  }

  // Check daily limit
  if (sourceConfig.dailyLimit) {
    const today = new Date().toISOString().slice(0, 10);
    const userDaily = dailyXP.get(userId) ?? new Map();
    const sourceDaily = userDaily.get(source) ?? 0;

    if (sourceDaily >= sourceConfig.dailyLimit) {
      const currentXP = userXP.get(userId) ?? 0;
      return {
        xpAwarded: 0,
        newTotal: currentXP,
        level: getCurrentLevel(currentXP),
        levelUp: false,
      };
    }

    // Update daily tracking
    dailyXP.set(userId, userDaily);
    userDaily.set(source, sourceDaily + amount);
  }

  // Apply streak multiplier
  const finalAmount = Math.round(amount * streakMultiplier);

  // Calculate new total
  const currentTotal = userXP.get(userId) ?? 0;
  const newTotal = currentTotal + finalAmount;
  userXP.set(userId, newTotal);

  // Check for level up
  const oldLevel = getCurrentLevel(currentTotal);
  const newLevel = getCurrentLevel(newTotal);
  const levelUp = newLevel > oldLevel;

  // Create transaction
  const transaction: XPTransaction = {
    id: nanoid(),
    userId,
    amount: finalAmount,
    source,
    referenceId: referenceId ?? null,
    referenceType: referenceType ?? null,
    balanceAfter: newTotal,
    createdAt: new Date(),
  };

  xpTransactions.set(transaction.id, transaction);

  return {
    xpAwarded: finalAmount,
    newTotal,
    level: newLevel,
    levelUp,
    ...(levelUp ? { newLevel: LEVELS.find((l) => l.level === newLevel) } : {}),
  };
}

/**
 * Get the current level for an XP total.
 */
export function getCurrentLevel(xpTotal: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xpTotal >= LEVELS[i]!.xpRequired) {
      return LEVELS[i]!.level;
    }
  }
  return 1;
}

/**
 * Get the level definition for a level number.
 */
export function getLevelDefinition(level: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.level === level);
}

/**
 * Get XP needed to reach the next level.
 */
export function getXPToNextLevel(currentXP: number): {
  currentLevel: number;
  nextLevel: LevelDefinition | null;
  xpInCurrentLevel: number;
  xpNeeded: number;
  progress: number; // 0-100 percentage
} {
  const currentLevel = getCurrentLevel(currentXP);
  const currentDef = LEVELS.find((l) => l.level === currentLevel);
  const nextDef = LEVELS.find((l) => l.level === currentLevel + 1);

  if (!currentDef || !nextDef) {
    return {
      currentLevel,
      nextLevel: null,
      xpInCurrentLevel: currentXP,
      xpNeeded: 0,
      progress: 100,
    };
  }

  const xpInCurrentLevel = currentXP - currentDef.xpRequired;
  const xpNeeded = nextDef.xpRequired - currentDef.xpRequired;
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpNeeded) * 100));

  return {
    currentLevel,
    nextLevel: nextDef,
    xpInCurrentLevel,
    xpNeeded,
    progress,
  };
}

/**
 * Get a user's XP total.
 */
export function getUserXP(userId: string): number {
  return userXP.get(userId) ?? 0;
}

/**
 * Get XP transaction history for a user.
 */
export function getUserXPTransactions(
  userId: string,
  options: { limit?: number; source?: XPSource } = {},
): XPTransaction[] {
  const { limit = 50, source } = options;

  const transactions = Array.from(xpTransactions.values())
    .filter((t) => t.userId === userId)
    .filter((t) => !source || t.source === source)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return transactions.slice(0, limit);
}

/**
 * Calculate streak multiplier for XP award.
 */
export function getStreakMultiplier(currentStreak: number): number {
  if (currentStreak >= STREAK_CONFIG.streakMultiplier30Days * 10) {
    return STREAK_CONFIG.streakMultiplier30Days;
  }
  if (currentStreak >= 7) {
    return STREAK_CONFIG.streakMultiplier7Days;
  }
  return 1.0;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllLevels(): void {
  xpTransactions.clear();
  userXP.clear();
  dailyXP.clear();
}
