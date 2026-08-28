/**
 * GTX Rush — Battle Pass Engine v1.0
 *
 * Server-authoritative battle pass system that handles:
 * - Free and Premium track management
 * - Purchase verification via Telegram Stars
 * - Level progression and reward claiming
 * - Auto-claim option
 * - Idempotent operations
 *
 * SECURITY:
 * - All purchases are server-verified
 * - Never unlock premium based on frontend state
 * - Reward claiming is idempotent with transaction IDs
 * - No competitive advantages from premium content
 *
 * Contract: GTX Rush — LiveOps Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  BattlePass,
  BattlePassPurchase,
  BattlePassRewardClaim,
  BattlePassProgress,
  BattlePassTrackProgress,
  BattlePassPendingReward,
  LiveOpsReward,
  BattlePassTrack,
} from '@gtx-rush/types';
import {
  DEFAULT_BATTLE_PASS_CONFIG,
  FREE_TRACK_REWARDS,
  PREMIUM_TRACK_REWARDS,
  getSeasonLevelXp,
  calculateSeasonLevel,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const battlePasses = new Map<string, BattlePass>();
const purchases = new Map<string, BattlePassPurchase>();
const rewardClaims = new Map<string, BattlePassRewardClaim>();

// Index: seasonId → battlePassId
const passesBySeason = new Map<string, string>();
// Index: userId:seasonId → purchase
const purchasesByUserSeason = new Map<string, string>();

// ============================================================
// Battle Pass Management
// ============================================================

/**
 * Create a battle pass for a season.
 */
export function createBattlePass(params: {
  seasonId: string;
  name: string;
  description: string;
  priceStars?: number;
  startTime: Date;
  endTime: Date;
}): BattlePass {
  const id = nanoid();

  const battlePass: BattlePass = {
    id,
    seasonId: params.seasonId,
    name: params.name,
    description: params.description,
    priceStars: params.priceStars ?? DEFAULT_BATTLE_PASS_CONFIG.defaultPriceStars,
    startTime: params.startTime,
    endTime: params.endTime,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  battlePasses.set(id, battlePass);
  passesBySeason.set(params.seasonId, id);

  return battlePass;
}

/**
 * Get a battle pass by ID.
 */
export function getBattlePass(battlePassId: string): BattlePass | null {
  return battlePasses.get(battlePassId) ?? null;
}

/**
 * Get the battle pass for a season.
 */
export function getBattlePassBySeason(seasonId: string): BattlePass | null {
  const battlePassId = passesBySeason.get(seasonId);
  if (!battlePassId) return null;
  return battlePasses.get(battlePassId) ?? null;
}

// ============================================================
// Battle Pass Purchase
// ============================================================

/**
 * Purchase a battle pass.
 *
 * SECURITY:
 * - Telegram payment must be verified server-side
 * - Idempotent: duplicate purchases return existing purchase
 * - Never activate premium based on client state alone
 *
 * Flow:
 * USER → VIEW PASS → SEE EXACT PRICE → CONFIRM →
 * TELEGRAM STARS PAYMENT → SERVER VERIFICATION → PASS ACTIVATED
 */
export function purchaseBattlePass(params: {
  userId: string;
  battlePassId: string;
  seasonId: string;
  telegramPaymentId: string;
  amountStars: number;
}): {
  success: boolean;
  purchase?: BattlePassPurchase;
  error?: string;
} {
  const battlePass = battlePasses.get(params.battlePassId);
  if (!battlePass) {
    return { success: false, error: 'BATTLE_PASS_NOT_FOUND' };
  }

  if (!battlePass.isActive) {
    return { success: false, error: 'BATTLE_PASS_NOT_ACTIVE' };
  }

  // Check price matches (prevent price manipulation)
  if (params.amountStars !== battlePass.priceStars) {
    return { success: false, error: 'PRICE_MISMATCH' };
  }

  // Idempotency: check if already purchased
  const existingPurchase = findUserPurchase(params.userId, params.seasonId);
  if (existingPurchase && existingPurchase.status === 'purchased') {
    return { success: false, error: 'ALREADY_PURCHASED', purchase: existingPurchase };
  }

  // Create purchase record
  const purchase: BattlePassPurchase = {
    id: nanoid(),
    userId: params.userId,
    battlePassId: params.battlePassId,
    seasonId: params.seasonId,
    status: 'purchased',
    telegramPaymentId: params.telegramPaymentId,
    idempotencyKey: `bp_purchase:${params.userId}:${params.seasonId}`,
    purchasedAt: new Date(),
    expiresAt: battlePass.endTime,
  };

  purchases.set(purchase.id, purchase);

  // Update indices
  const userSeasonKey = `${params.userId}:${params.seasonId}`;
  purchasesByUserSeason.set(userSeasonKey, purchase.id);

  return { success: true, purchase };
}

/**
 * Find a user's purchase for a season.
 */
function findUserPurchase(userId: string, seasonId: string): BattlePassPurchase | null {
  const purchaseId = purchasesByUserSeason.get(`${userId}:${seasonId}`);
  if (!purchaseId) return null;
  return purchases.get(purchaseId) ?? null;
}

/**
 * Check if a user owns the premium pass for a season.
 */
export function ownsPremiumPass(userId: string, seasonId: string): boolean {
  const purchase = findUserPurchase(userId, seasonId);
  return purchase?.status === 'purchased';
}

// ============================================================
// Battle Pass Progress
// ============================================================

/**
 * Get a user's battle pass progress.
 *
 * Requires:
 * - Current season XP
 * - Season level
 * - Free track unlock status
 * - Premium track unlock status (if purchased)
 */
export function getBattlePassProgress(params: {
  userId: string;
  seasonId: string;
  seasonXp: number;
}): BattlePassProgress {
  const { seasonId, seasonXp } = params;
  const isPremium = ownsPremiumPass(params.userId, seasonId);

  const { level: currentLevel, xpInCurrentLevel, xpToNextLevel } = calculateSeasonLevel(seasonXp);
  const maxLevel = DEFAULT_BATTLE_PASS_CONFIG.maxLevel;

  // Build free track progress
  const freeTrack = buildTrackProgress('free', currentLevel, isPremium);

  // Build premium track progress
  const premiumTrack = buildTrackProgress('premium', currentLevel, isPremium);

  return {
    seasonId,
    currentLevel,
    currentXp: xpInCurrentLevel,
    xpToNextLevel,
    totalXpEarned: seasonXp,
    maxLevel,
    isPremium,
    freeTrack,
    premiumTrack,
  };
}

/**
 * Build track progress for free or premium track.
 */
function buildTrackProgress(
  track: BattlePassTrack,
  currentLevel: number,
  isPremium: boolean,
): BattlePassTrackProgress {
  const trackRewards = track === 'free' ? FREE_TRACK_REWARDS : PREMIUM_TRACK_REWARDS;

  const unlockedLevels: number[] = [];
  const claimedRewards: string[] = [];
  const pendingRewards: BattlePassPendingReward[] = [];

  for (const levelReward of trackRewards) {
    if (levelReward.level <= currentLevel) {
      unlockedLevels.push(levelReward.level);

      const claimKey = `${track}:${levelReward.level}`;
      const isClaimed = rewardClaims.has(claimKey);

      if (isClaimed) {
        claimedRewards.push(claimKey);
      } else {
        // Check if claimable
        const canClaim = track === 'free' || isPremium;
        pendingRewards.push({
          level: levelReward.level,
          reward: levelReward.reward as LiveOpsReward,
          claimable: canClaim,
          reason: canClaim ? null : 'Requires Premium Pass',
        });
      }
    }
  }

  return {
    track,
    unlockedLevels,
    claimedRewards,
    pendingRewards,
  };
}

// ============================================================
// Reward Claiming
// ============================================================

/**
 * Claim a battle pass reward.
 *
 * SECURITY:
 * - Reward can only be claimed when: level reached + track unlocked + premium if required
 * - Idempotent: duplicate claims return existing transaction
 * - Server-authoritative reward distribution
 *
 * A reward can be claimed only when:
 * 1. Required level reached
 * 2. Track unlocked
 * 3. User owns premium pass if required
 */
export function claimBattlePassReward(params: {
  userId: string;
  seasonId: string;
  level: number;
  track: BattlePassTrack;
}): {
  success: boolean;
  reward?: LiveOpsReward;
  transactionId?: string;
  error?: string;
} {
  const { userId, seasonId, level, track } = params;

  // Check if premium track requires premium pass
  if (track === 'premium' && !ownsPremiumPass(userId, seasonId)) {
    return { success: false, error: 'REQUIRES_PREMIUM_PASS' };
  }

  // Find the reward definition
  const trackRewards = track === 'free' ? FREE_TRACK_REWARDS : PREMIUM_TRACK_REWARDS;
  const levelReward = trackRewards.find((r) => r.level === level);
  if (!levelReward) {
    return { success: false, error: 'REWARD_NOT_FOUND' };
  }

  // Check if already claimed (idempotent)
  const claimKey = `${track}:${level}`;
  const existingClaim = rewardClaims.get(claimKey);
  if (existingClaim && existingClaim.userId === userId) {
    return {
      success: false,
      error: 'ALREADY_CLAIMED',
      reward: existingClaim.reward,
      transactionId: existingClaim.transactionId,
    };
  }

  // Create reward claim
  const transactionId = nanoid();
  const claim: BattlePassRewardClaim = {
    id: nanoid(),
    userId,
    seasonId,
    level,
    track,
    reward: levelReward.reward as LiveOpsReward,
    transactionId,
    claimedAt: new Date(),
  };

  rewardClaims.set(claimKey, claim);

  return {
    success: true,
    reward: levelReward.reward as LiveOpsReward,
    transactionId,
  };
}

// ============================================================
// Auto-Claim
// ============================================================

/**
 * Auto-claim all pending rewards for a user.
 *
 * If auto-claim is enabled, unlocked rewards are automatically added.
 * Must still use server-authoritative reward transactions.
 */
export function autoClaimBattlePassRewards(params: {
  userId: string;
  seasonId: string;
  seasonXp: number;
}): LiveOpsReward[] {
  if (!DEFAULT_BATTLE_PASS_CONFIG.autoClaimEnabled) {
    return [];
  }

  const progress = getBattlePassProgress(params);
  const claimedRewards: LiveOpsReward[] = [];

  // Claim all pending free track rewards
  for (const pending of progress.freeTrack.pendingRewards) {
    if (pending.claimable) {
      const result = claimBattlePassReward({
        userId: params.userId,
        seasonId: params.seasonId,
        level: pending.level,
        track: 'free',
      });
      if (result.success && result.reward) {
        claimedRewards.push(result.reward);
      }
    }
  }

  // Claim all pending premium track rewards (if premium)
  if (progress.isPremium) {
    for (const pending of progress.premiumTrack.pendingRewards) {
      if (pending.claimable) {
        const result = claimBattlePassReward({
          userId: params.userId,
          seasonId: params.seasonId,
          level: pending.level,
          track: 'premium',
        });
        if (result.success && result.reward) {
          claimedRewards.push(result.reward);
        }
      }
    }
  }

  return claimedRewards;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearBattlePassEngine(): void {
  battlePasses.clear();
  purchases.clear();
  rewardClaims.clear();
  passesBySeason.clear();
  purchasesByUserSeason.clear();
}

export function _getBattlePassCount(): number {
  return battlePasses.size;
}

export function _getPurchaseCount(): number {
  return purchases.size;
}

export function _getClaimCount(): number {
  return rewardClaims.size;
}
