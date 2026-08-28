/**
 * GTX Rush — Streak Engine v1.0
 *
 * Server-authoritative streak system that handles:
 * - Streak tracking (current and longest)
 * - Server-determined qualifying days
 * - Streak milestone rewards
 * - Timezone manipulation prevention
 * - Streak states (active, at_risk, broken)
 *
 * SECURITY:
 * - Server determines streak state, not client
 * - UTC is used for all date calculations
 * - Multiple activities per day count as ONE streak day
 * - Client cannot manipulate device timezone for streak benefits
 *
 * Contract: Retention Engine Contract v1.0
 */

import { nanoid } from 'nanoid';
import type {
  Streak,
  StreakStatus,
  StreakMilestone,
  StreakDay,
  StreakResponse,
  UserStreakMilestone,
  MissionRewardConfiguration,
} from '@gtx-rush/types';
import {
  STREAK_ENGINE_CONFIG,
  STREAK_MILESTONES,
  getTodayUTC,
} from '@gtx-rush/config';

// ============================================================
// In-memory stores (production: PostgreSQL via Drizzle ORM)
// ============================================================

const streaks = new Map<string, Streak>();
const userStreakMilestones = new Map<string, UserStreakMilestone[]>();
const streakDays = new Map<string, Map<string, number>>(); // userId → YYYY-MM-DD → activityCount

// ============================================================
// Streak Management
// ============================================================

/**
 * Get or create a user's streak record.
 */
export function getOrCreateStreak(userId: string): Streak {
  let streak = streaks.get(userId);

  if (!streak) {
    streak = {
      id: nanoid(),
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      lastQualifyingActivityAt: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    streaks.set(userId, streak);
  }

  return streak;
}

/**
 * Record a qualifying activity for streak tracking.
 *
 * SECURITY:
 * - Server determines if today already has a qualifying activity
 * - Multiple activities per day count as ONE streak day
 * - UTC is used for all date calculations
 */
export function recordStreakActivity(
  userId: string,
  activityDate?: string, // Optional override for testing, defaults to today UTC
): {
  streakExtended: boolean;
  currentStreak: number;
  longestStreak: boolean; // True if new longest streak
  milestoneEarned: StreakMilestone | null;
} {
  const today = activityDate ?? getTodayUTC();
  const streak = getOrCreateStreak(userId);

  // Initialize day tracking
  if (!streakDays.has(userId)) {
    streakDays.set(userId, new Map());
  }
  const userDays = streakDays.get(userId)!;

  // Check if user already has an activity today
  const existingActivity = userDays.get(today) ?? 0;
  if (existingActivity >= STREAK_ENGINE_CONFIG.minActivitiesForDay) {
    // Already completed today - no streak extension
    return {
      streakExtended: false,
      currentStreak: streak.currentStreak,
      longestStreak: false,
      milestoneEarned: null,
    };
  }

  // Record activity
  userDays.set(today, existingActivity + 1);

  // Check if yesterday was the last active day
  const yesterday = getYesterdayUTC(today);
  const yesterdayActivity = userDays.get(yesterday) ?? 0;

  let streakExtended = false;
  let isNewLongest = false;
  let milestoneEarned: StreakMilestone | null = null;

  if (yesterdayActivity >= STREAK_ENGINE_CONFIG.minActivitiesForDay || streak.lastActiveDate === yesterday) {
    // Extend streak
    streak.currentStreak += 1;
    streakExtended = true;
  } else if (streak.lastActiveDate !== today) {
    // Streak broken (not yesterday and not today)
    streak.currentStreak = 1;
    streakExtended = false;
  }

  // Update last active date
  streak.lastActiveDate = today;
  streak.lastQualifyingActivityAt = new Date();
  streak.updatedAt = new Date();

  // Check if this is a new longest streak
  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
    isNewLongest = true;
  }

  // Check for milestone
  milestoneEarned = checkStreakMilestone(userId, streak.currentStreak);

  // Update streak status
  streak.status = calculateStreakStatus(streak, today);

  return {
    streakExtended,
    currentStreak: streak.currentStreak,
    longestStreak: isNewLongest,
    milestoneEarned,
  };
}

/**
 * Calculate the streak status based on current state and time.
 */
function calculateStreakStatus(streak: Streak, today: string): StreakStatus {
  if (streak.currentStreak === 0) {
    return 'broken';
  }

  if (streak.lastActiveDate === today) {
    return 'active';
  }

  // Check if user is at risk (hasn't played today and it's near end of day)
  const now = new Date();
  const hoursUntilEndOfDay = 24 - now.getUTCHours();
  if (hoursUntilEndOfDay <= STREAK_ENGINE_CONFIG.atRiskWarningHours) {
    return 'at_risk';
  }

  return 'active';
}

/**
 * Get yesterday's date in UTC.
 */
function getYesterdayUTC(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// ============================================================
// Streak Milestones
// ============================================================

/**
 * Check if a streak milestone has been reached.
 */
function checkStreakMilestone(userId: string, currentStreak: number): StreakMilestone | null {
  // Find the highest milestone that matches
  for (const config of STREAK_MILESTONES) {
    if (currentStreak === config.daysRequired) {
      // Check if already earned
      const earned = userStreakMilestones.get(userId) ?? [];
      const alreadyEarned = earned.some((m) => m.streakDays === config.daysRequired);

      if (!alreadyEarned) {
        // Record milestone
        const milestone: UserStreakMilestone = {
          id: nanoid(),
          userId,
          milestoneId: `streak_${config.daysRequired}_days`,
          streakDays: config.daysRequired,
          earnedAt: new Date(),
          rewardClaimedAt: null,
        };

        const userEarned = userStreakMilestones.get(userId) ?? [];
        userEarned.push(milestone);
        userStreakMilestones.set(userId, userEarned);

        return {
          id: `streak_milestone_${config.daysRequired}`,
          daysRequired: config.daysRequired,
          rewardType: config.rewardType,
          rewardValue: String(config.rewardValue),
          rewardConfiguration: {
            xp: config.xp,
            badgeId: config.badgeId,
            titleId: config.titleId,
            cosmeticId: config.cosmeticId,
          },
          isActive: true,
        };
      }
    }
  }

  return null;
}

/**
 * Get all earned streak milestones for a user.
 */
export function getUserStreakMilestones(userId: string): UserStreakMilestone[] {
  return userStreakMilestones.get(userId) ?? [];
}

// ============================================================
// Streak Queries
// ============================================================

/**
 * Get the streak response for a user.
 */
export function getStreakResponse(userId: string): StreakResponse {
  const streak = getOrCreateStreak(userId);
  const today = getTodayUTC();

  // Calculate week activity
  const weekActivity = getWeekActivity(userId);

  // Check if today is completed
  const userDays = streakDays.get(userId);
  const todayActivity = userDays?.get(today) ?? 0;
  const todayCompleted = todayActivity >= STREAK_ENGINE_CONFIG.minActivitiesForDay;

  // Find next milestone
  const nextMilestone = findNextMilestone(streak.currentStreak);
  const daysUntilNextMilestone = nextMilestone
    ? nextMilestone.daysRequired - streak.currentStreak
    : 0;

  return {
    userId,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    status: streak.status,
    lastActiveDate: streak.lastActiveDate,
    daysUntilNextMilestone,
    nextMilestone: nextMilestone
      ? {
          id: `streak_milestone_${nextMilestone.daysRequired}`,
          daysRequired: nextMilestone.daysRequired,
          rewardType: nextMilestone.rewardType,
          rewardValue: String(nextMilestone.rewardValue),
          rewardConfiguration: {
            xp: nextMilestone.xp,
            badgeId: nextMilestone.badgeId,
            titleId: nextMilestone.titleId,
            cosmeticId: nextMilestone.cosmeticId,
          },
          isActive: true,
        }
      : null,
    weekActivity,
    todayCompleted,
  };
}

/**
 * Get the next streak milestone after current streak.
 */
function findNextMilestone(currentStreak: number): typeof STREAK_MILESTONES[number] | null {
  for (const milestone of STREAK_MILESTONES) {
    if (milestone.daysRequired > currentStreak) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get activity for the past 7 days.
 */
function getWeekActivity(userId: string): StreakDay[] {
  const today = new Date();
  const weekActivity: StreakDay[] = [];
  const userDays = streakDays.get(userId);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    const activityCount = userDays?.get(dateStr) ?? 0;
    weekActivity.push({
      date: dateStr,
      qualifyingActivity: activityCount >= STREAK_ENGINE_CONFIG.minActivitiesForDay,
      activityCount,
    });
  }

  return weekActivity;
}

/**
 * Get the raw streak record for a user.
 */
export function getStreak(userId: string): Streak {
  return getOrCreateStreak(userId);
}

/**
 * Check if a user has completed a qualifying activity today.
 */
export function hasCompletedToday(userId: string): boolean {
  const today = getTodayUTC();
  const userDays = streakDays.get(userId);
  const activityCount = userDays?.get(today) ?? 0;
  return activityCount >= STREAK_ENGINE_CONFIG.minActivitiesForDay;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearAllStreaks(): void {
  streaks.clear();
  userStreakMilestones.clear();
  streakDays.clear();
}

export function _getStreakCount(): number {
  return streaks.size;
}

export function _setStreakForTesting(
  userId: string,
  currentStreak: number,
  longestStreak: number,
  lastActiveDate: string,
): void {
  const streak = getOrCreateStreak(userId);
  streak.currentStreak = currentStreak;
  streak.longestStreak = longestStreak;
  streak.lastActiveDate = lastActiveDate;
  streak.updatedAt = new Date();
}
