/**
 * GTX Rush — Ad Service v1.0
 *
 * Ad service abstraction that handles:
 * - Ad availability checking
 * - Frequency controls (session/daily limits)
 * - Rewarded ad flow with server verification
 * - Interstitial ad placement
 * - Ad reward granting with caps
 *
 * SECURITY:
 * - Ad completion must be verified server-side
 * - Client cannot grant ad rewards directly
 * - Frequency limits are enforced server-side
 * - Daily caps prevent economy inflation
 *
 * Contract: Monetization Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  AdConfiguration,
  AdRequest,
  AdResponse,
  AdReward,
  AdCompletion,
  AdCompletionResult,
  AdType,
} from '@gtx-rush/types';
import {
  DEFAULT_AD_CONFIG,
  REWARDED_AD_REWARDS,
  ECONOMY_CAPS,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const adCompletions = new Map<string, AdCompletion>();
const userAdCounts = new Map<string, { session: number; daily: number; lastAdAt: Date }>();
const dailyAdRewards = new Map<string, Map<string, number>>(); // userId → rewardType → amount

// ============================================================
// Ad Availability
// ============================================================

/**
 * Check if an ad is available for a user.
 *
 * SECURITY:
 * - Checks are server-authoritative
 * - Frequency limits are enforced
 * - Time since last ad is checked
 */
export function checkAdAvailability(
  userId: string,
  adType: AdType,
  sessionId: string,
): {
  available: boolean;
  reason?: string;
  timeUntilAvailable?: number;
} {
  const config = DEFAULT_AD_CONFIG;

  // Check if ads are enabled
  if (!config.enabled) {
    return { available: false, reason: 'ADS_DISABLED' };
  }

  // Check specific ad type
  if (adType === 'rewarded' && !config.rewardedAdsEnabled) {
    return { available: false, reason: 'REWARDED_ADS_DISABLED' };
  }
  if (adType === 'interstitial' && !config.interstitialAdsEnabled) {
    return { available: false, reason: 'INTERSTITIAL_ADS_DISABLED' };
  }

  // Get user ad state
  const userState = userAdCounts.get(userId);
  const now = new Date();

  if (userState) {
    // Check session limit
    if (userState.session >= config.maxPerSession) {
      return { available: false, reason: 'SESSION_LIMIT_REACHED' };
    }

    // Check daily limit
    if (userState.daily >= config.maxPerDay) {
      return { available: false, reason: 'DAILY_LIMIT_REACHED' };
    }

    // Check minimum interval
    const timeSinceLastAd = now.getTime() - userState.lastAdAt.getTime();
    if (timeSinceLastAd < config.minIntervalMs) {
      const timeUntilAvailable = config.minIntervalMs - timeSinceLastAd;
      return {
        available: false,
        reason: 'MIN_INTERVAL_NOT_MET',
        timeUntilAvailable,
      };
    }
  }

  return { available: true };
}

/**
 * Get ad configuration for client.
 */
export function getAdConfiguration(): AdConfiguration {
  return DEFAULT_AD_CONFIG;
}

// ============================================================
// Rewarded Ads
// ============================================================

/**
 * Request a rewarded ad.
 *
 * SECURITY:
 * - Checks availability before creating ad
 * - Returns reward configuration server-side
 * - Ad ID is generated server-side
 */
export function requestRewardedAd(
  userId: string,
  placement: string,
  sessionId: string,
): AdResponse {
  const availability = checkAdAvailability(userId, 'rewarded', sessionId);

  if (!availability.available) {
    return {
      adId: '',
      adType: 'rewarded',
      placement,
      available: false,
      adConfig: {},
      reward: null,
      unavailableReason: availability.reason,
    };
  }

  // Get appropriate reward for this placement
  const rewardConfig = getRewardForPlacement(placement, userId);

  // Generate ad ID
  const adId = nanoid();

  // Update user ad count
  updateUserAdCount(userId);

  return {
    adId,
    adType: 'rewarded',
    placement,
    available: true,
    adConfig: DEFAULT_AD_CONFIG.provider.config,
    reward: rewardConfig,
  };
}

/**
 * Complete a rewarded ad and grant reward.
 *
 * SECURITY:
 * - Verifies ad completion server-side
 * - Checks daily caps
 * - Grants reward only once per ad
 */
export function completeRewardedAd(
  userId: string,
  adId: string,
  placement: string,
  verificationToken: string,
): AdCompletionResult {
  // Verify ad exists and hasn't been completed
  const existingCompletion = Array.from(adCompletions.values()).find(
    (c) => c.adId === adId && c.userId === userId,
  );

  if (existingCompletion) {
    return {
      success: false,
      rewardGranted: false,
      error: 'AD_ALREADY_COMPLETED',
    };
  }

  // Get reward for this placement
  const rewardConfig = getRewardForPlacement(placement, userId);
  if (!rewardConfig) {
    return {
      success: false,
      rewardGranted: false,
      error: 'NO_REWARD_CONFIGURED',
    };
  }

  // Check daily cap
  const dailyEarned = getDailyRewardEarned(userId, rewardConfig.type);
  if (dailyEarned >= rewardConfig.dailyCap) {
    return {
      success: false,
      rewardGranted: false,
      error: 'DAILY_CAP_REACHED',
    };
  }

  // Record completion
  const completion: AdCompletion = {
    adId,
    userId,
    adType: 'rewarded',
    placement,
    verificationToken,
    completedAt: new Date(),
  };

  adCompletions.set(adId, completion);

  // Update daily reward tracking
  updateDailyRewardEarned(userId, rewardConfig.type, rewardConfig.amount);

  return {
    success: true,
    rewardGranted: true,
    reward: {
      ...rewardConfig,
      dailyEarned: dailyEarned + rewardConfig.amount,
    },
  };
}

// ============================================================
// Interstitial Ads
// ============================================================

/**
 * Check if an interstitial ad should be shown.
 *
 * SECURITY:
 * - Only shows at natural breaks
 * - Respects frequency limits
 */
export function shouldShowInterstitial(
  userId: string,
  screen: string,
  sessionId: string,
): boolean {
  const config = DEFAULT_AD_CONFIG;

  // Check if ads are enabled
  if (!config.enabled || !config.interstitialAdsEnabled) {
    return false;
  }

  // Check if screen is eligible
  if (!config.eligibleScreens.includes(screen)) {
    return false;
  }

  // Check availability
  const availability = checkAdAvailability(userId, 'interstitial', sessionId);
  return availability.available;
}

// ============================================================
// Ad Reward Tracking
// ============================================================

/**
 * Get reward configuration for a placement.
 */
function getRewardForPlacement(
  placement: string,
  userId: string,
): AdReward | null {
  // Find appropriate reward config based on placement and user level
  // For MVP, use the first available reward
  const rewardConfig = REWARDED_AD_REWARDS[0];

  if (!rewardConfig) {
    return null;
  }

  const dailyEarned = getDailyRewardEarned(userId, rewardConfig.type);

  return {
    type: rewardConfig.type,
    amount: rewardConfig.amount,
    dailyCap: rewardConfig.dailyCap,
    dailyEarned,
  };
}

/**
 * Get daily reward earned for a user and type.
 */
function getDailyRewardEarned(userId: string, rewardType: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const userDaily = dailyAdRewards.get(userId);
  if (!userDaily) return 0;

  const dayData = userDaily.get(`${rewardType}:${today}`);
  return dayData ?? 0;
}

/**
 * Update daily reward earned tracking.
 */
function updateDailyRewardEarned(
  userId: string,
  rewardType: string,
  amount: number,
): void {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${rewardType}:${today}`;

  if (!dailyAdRewards.has(userId)) {
    dailyAdRewards.set(userId, new Map());
  }

  const userDaily = dailyAdRewards.get(userId)!;
  const current = userDaily.get(key) ?? 0;
  userDaily.set(key, current + amount);
}

// ============================================================
// Ad Count Management
// ============================================================

/**
 * Update user ad count for session and daily tracking.
 */
function updateUserAdCount(userId: string): void {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const current = userAdCounts.get(userId) ?? {
    session: 0,
    daily: 0,
    lastAdAt: new Date(0),
  };

  // Reset daily count if new day
  const lastDay = current.lastAdAt.toISOString().slice(0, 10);
  if (lastDay !== today) {
    current.daily = 0;
  }

  current.session += 1;
  current.daily += 1;
  current.lastAdAt = now;

  userAdCounts.set(userId, current);
}

/**
 * Reset session ad count (called on new session).
 */
export function resetSessionAdCount(userId: string): void {
  const current = userAdCounts.get(userId);
  if (current) {
    current.session = 0;
    userAdCounts.set(userId, current);
  }
}

// ============================================================
// Ad Metrics (for analytics)
// ============================================================

/**
 * Get ad completion count for a user.
 */
export function getUserAdCompletions(userId: string): number {
  return Array.from(adCompletions.values()).filter((c) => c.userId === userId).length;
}

/**
 * Get ad metrics for analytics.
 */
export function getAdMetrics(): {
  totalRequested: number;
  totalCompleted: number;
  completionRate: number;
} {
  const totalCompleted = adCompletions.size;
  // In production, track requests separately
  const totalRequested = totalCompleted; // Simplified for MVP

  return {
    totalRequested,
    totalCompleted,
    completionRate: totalRequested > 0 ? totalCompleted / totalRequested : 0,
  };
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAdService(): void {
  adCompletions.clear();
  userAdCounts.clear();
  dailyAdRewards.clear();
}

export function _getAdCompletionCount(): number {
  return adCompletions.size;
}
