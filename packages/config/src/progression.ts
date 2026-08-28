import type { XPSourceConfig, LevelDefinition } from '@gtx-rush/types';

export const XP_SOURCES: XPSourceConfig[] = [
  { source: 'game_play', xpAmount: 10, dailyLimit: 100 },
  { source: 'game_win', xpAmount: 25, dailyLimit: 250 },
  { source: 'daily_challenge', xpAmount: 50, dailyLimit: 50 },
  { source: 'streak', xpAmount: 5, dailyLimit: 100 },
  { source: 'friend_challenge', xpAmount: 30, dailyLimit: 150 },
  { source: 'achievement', xpAmount: 0 }, // Variable per badge
  { source: 'purchase', xpAmount: 0 },
  { source: 'admin_adjustment', xpAmount: 0 },
];

export const LEVELS: LevelDefinition[] = [
  { level: 1, xpRequired: 0, title: 'Rookie', rewards: {} },
  { level: 2, xpRequired: 100, title: 'Beginner', rewards: { features: ['custom_avatar'] } },
  { level: 3, xpRequired: 300, title: 'Player', rewards: {} },
  { level: 4, xpRequired: 600, title: 'Skilled', rewards: { cosmetics: ['avatar_frame_bronze'] } },
  { level: 5, xpRequired: 1000, title: 'Expert', rewards: {} },
  { level: 6, xpRequired: 1500, title: 'Pro', rewards: { cosmetics: ['avatar_frame_silver'] } },
  { level: 7, xpRequired: 2200, title: 'Elite', rewards: {} },
  { level: 8, xpRequired: 3000, title: 'Master', rewards: { cosmetics: ['avatar_frame_gold'] } },
  { level: 9, xpRequired: 4000, title: 'Champion', rewards: {} },
  { level: 10, xpRequired: 5500, title: 'Legend', rewards: { cosmetics: ['avatar_frame_diamond'], badges: ['legend'] } },
  // Extend as needed
];

export const STREAK_CONFIG = {
  /** Hours in a UTC day before it counts as "played today" */
  dayBoundaryHour: 0,
  /** Number of days for a streak to count */
  minDaysForStreak: 1,
  /** XP multiplier for streak of 7+ days */
  streakMultiplier7Days: 1.5,
  /** XP multiplier for streak of 30+ days */
  streakMultiplier30Days: 2.0,
  /** Badge awarded at streak milestones */
  streakBadges: {
    7: 'streak_7_days',
    14: 'streak_14_days',
    30: 'streak_30_days',
    60: 'streak_60_days',
    100: 'streak_100_days',
    365: 'streak_365_days',
  },
  /** Max streak recovery per month (premium feature) */
  maxRecoveriesPerMonth: 1,
};
