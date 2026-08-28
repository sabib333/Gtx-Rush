/**
 * GTX Rush — Retention Engine Configuration v1.0
 *
 * Configuration for missions, streaks, rewards, and retention mechanics.
 * All values are configurable and version-controlled.
 *
 * Contract: Retention Engine Contract v1.0
 */

import type {
  MissionType,
  MissionFrequency,
  MissionDifficulty,
  MissionRewardConfiguration,
  MissionConfiguration,
} from '@gtx-rush/types';

// ============================================================
// Mission Definitions
// ============================================================

export interface MissionTemplate {
  id: string;
  name: string;
  description: string;
  type: MissionType;
  target: number;
  gameId: string | null;
  configuration: MissionConfiguration;
  rewardConfiguration: MissionRewardConfiguration;
  frequency: MissionFrequency;
  difficulty: MissionDifficulty;
  /** Weight for selection probability (higher = more likely) */
  weight: number;
  /** Minimum user level to receive this mission */
  minLevel: number;
  /** Maximum user level to receive this mission (0 = no max) */
  maxLevel: number;
  /** Version for mission definition tracking */
  version: number;
}

/**
 * Default daily mission templates.
 * These are pre-configured missions that rotate daily.
 */
export const DAILY_MISSION_TEMPLATES: MissionTemplate[] = [
  // === EASY MISSIONS ===
  {
    id: 'daily_play_1_game',
    name: 'Play a Game',
    description: 'Complete 1 game session',
    type: 'PLAY_GAME',
    target: 1,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 50 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 10,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_play_2_games',
    name: 'Play 2 Games',
    description: 'Complete 2 game sessions',
    type: 'PLAY_GAME',
    target: 2,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 100 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 10,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_complete_reaction',
    name: 'Play Reaction Rush',
    description: 'Complete a Reaction Rush game',
    type: 'COMPLETE_GAME',
    target: 1,
    gameId: 'reaction-rush',
    configuration: { gameId: 'reaction-rush' },
    rewardConfiguration: { xp: 75 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 8,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_complete_tap',
    name: 'Play Tap Rush',
    description: 'Complete a Tap Rush game',
    type: 'COMPLETE_GAME',
    target: 1,
    gameId: 'tap-rush',
    configuration: { gameId: 'tap-rush' },
    rewardConfiguration: { xp: 75 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 8,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_complete_quiz',
    name: 'Play Quiz Rush',
    description: 'Complete a Quiz Rush game',
    type: 'COMPLETE_GAME',
    target: 1,
    gameId: 'quiz-rush',
    configuration: { gameId: 'quiz-rush' },
    rewardConfiguration: { xp: 75 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 8,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },

  // === MEDIUM MISSIONS ===
  {
    id: 'daily_score_5000',
    name: 'Score 5,000+',
    description: 'Score 5,000 or more points in a single game',
    type: 'SCORE_THRESHOLD',
    target: 5000,
    gameId: null,
    configuration: { minScore: 5000 },
    rewardConfiguration: { xp: 150 },
    frequency: 'daily',
    difficulty: 'medium',
    weight: 8,
    minLevel: 3,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_score_10000',
    name: 'Score 10,000+',
    description: 'Score 10,000 or more points in a single game',
    type: 'SCORE_THRESHOLD',
    target: 10000,
    gameId: null,
    configuration: { minScore: 10000 },
    rewardConfiguration: { xp: 200 },
    frequency: 'daily',
    difficulty: 'medium',
    weight: 6,
    minLevel: 5,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_personal_best',
    name: 'Set a Personal Best',
    description: 'Beat your highest score in any game',
    type: 'SET_PERSONAL_BEST',
    target: 1,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 150 },
    frequency: 'daily',
    difficulty: 'medium',
    weight: 7,
    minLevel: 2,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_play_3_games',
    name: 'Play 3 Games',
    description: 'Complete 3 game sessions',
    type: 'PLAY_GAME',
    target: 3,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 125 },
    frequency: 'daily',
    difficulty: 'medium',
    weight: 8,
    minLevel: 2,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_quiz_correct_5',
    name: 'Get 5 Correct Answers',
    description: 'Answer 5 questions correctly in Quiz Rush',
    type: 'ANSWER_CORRECTLY',
    target: 5,
    gameId: 'quiz-rush',
    configuration: { gameId: 'quiz-rush' },
    rewardConfiguration: { xp: 125 },
    frequency: 'daily',
    difficulty: 'medium',
    weight: 6,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_tap_combo_5',
    name: 'Reach 5x Combo',
    description: 'Achieve a 5x combo in Tap Rush',
    type: 'ACHIEVE_COMBO',
    target: 5,
    gameId: 'tap-rush',
    configuration: { gameId: 'tap-rush', comboThreshold: 5 },
    rewardConfiguration: { xp: 125 },
    frequency: 'daily',
    difficulty: 'medium',
    weight: 6,
    minLevel: 2,
    maxLevel: 0,
    version: 1,
  },

  // === HARD MISSIONS ===
  {
    id: 'daily_win_challenge',
    name: 'Win a Challenge',
    description: 'Win a friend challenge or daily challenge',
    type: 'WIN_CHALLENGE',
    target: 1,
    gameId: null,
    configuration: { challengeType: 'any' },
    rewardConfiguration: { xp: 250 },
    frequency: 'daily',
    difficulty: 'hard',
    weight: 5,
    minLevel: 5,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_complete_daily_rush',
    name: 'Complete Daily Rush',
    description: 'Complete today\'s Daily Rush challenge',
    type: 'COMPLETE_DAILY_RUSH',
    target: 1,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 200 },
    frequency: 'daily',
    difficulty: 'hard',
    weight: 6,
    minLevel: 3,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_score_20000',
    name: 'Score 20,000+',
    description: 'Score 20,000 or more points in a single game',
    type: 'SCORE_THRESHOLD',
    target: 20000,
    gameId: null,
    configuration: { minScore: 20000 },
    rewardConfiguration: { xp: 300 },
    frequency: 'daily',
    difficulty: 'hard',
    weight: 4,
    minLevel: 8,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'daily_share_result',
    name: 'Share Your Score',
    description: 'Share your game result with a friend',
    type: 'SHARE_RESULT',
    target: 1,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 100 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 5,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
];

/**
 * Weekly mission templates.
 */
export const WEEKLY_MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'weekly_play_10_games',
    name: 'Play 10 Games',
    description: 'Complete 10 game sessions this week',
    type: 'PLAY_GAME',
    target: 10,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 500 },
    frequency: 'weekly',
    difficulty: 'medium',
    weight: 10,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'weekly_score_50000',
    name: 'Score 50,000 Total',
    description: 'Accumulate 50,000 points across all games this week',
    type: 'SCORE_THRESHOLD',
    target: 50000,
    gameId: null,
    configuration: { cumulative: true },
    rewardConfiguration: { xp: 750 },
    frequency: 'weekly',
    difficulty: 'hard',
    weight: 6,
    minLevel: 5,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'weekly_win_3_challenges',
    name: 'Win 3 Challenges',
    description: 'Win 3 challenges this week',
    type: 'WIN_CHALLENGE',
    target: 3,
    gameId: null,
    configuration: { challengeType: 'any' },
    rewardConfiguration: { xp: 600 },
    frequency: 'weekly',
    difficulty: 'hard',
    weight: 5,
    minLevel: 5,
    maxLevel: 0,
    version: 1,
  },
  {
    id: 'weekly_play_all_games',
    name: 'Play All Games',
    description: 'Play at least one game of each type this week',
    type: 'PLAY_GAME',
    target: 3,
    gameId: null,
    configuration: { uniqueGames: true },
    rewardConfiguration: { xp: 400 },
    frequency: 'weekly',
    difficulty: 'medium',
    weight: 7,
    minLevel: 2,
    maxLevel: 0,
    version: 1,
  },
];

/**
 * Monthly mission templates (extensible, not shown in MVP UI).
 */
export const MONTHLY_MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'monthly_play_50_games',
    name: 'Play 50 Games',
    description: 'Complete 50 game sessions this month',
    type: 'PLAY_GAME',
    target: 50,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 2000 },
    frequency: 'monthly',
    difficulty: 'hard',
    weight: 10,
    minLevel: 1,
    maxLevel: 0,
    version: 1,
  },
];

// ============================================================
// Daily Mission Generation Config
// ============================================================

export interface DailyMissionGenerationConfig {
  /** Number of daily missions to assign per user */
  dailyMissionCount: number;
  /** Minimum number of easy missions */
  minEasyMissions: number;
  /** Minimum number of medium missions */
  minMediumMissions: number;
  /** Minimum number of hard missions */
  minHardMissions: number;
  /** Ensure at least one mission for a random game */
  ensureGameVariety: boolean;
}

export const DAILY_MISSION_GENERATION_CONFIG: DailyMissionGenerationConfig = {
  dailyMissionCount: 3,
  minEasyMissions: 1,
  minMediumMissions: 1,
  minHardMissions: 0,
  ensureGameVariety: true,
};

// ============================================================
// Streak Configuration
// ============================================================

export interface StreakEngineConfig {
  /** UTC hour boundary for day rollover (0 = midnight UTC) */
  dayBoundaryHour: number;
  /** Minimum qualifying activities to count a streak day */
  minActivitiesForDay: number;
  /** Maximum streak days that can be lost (for future streak repair) */
  maxRecoveryDays: number;
  /** Hours before end of day to show "at risk" warning */
  atRiskWarningHours: number;
}

export const STREAK_ENGINE_CONFIG: StreakEngineConfig = {
  dayBoundaryHour: 0,
  minActivitiesForDay: 1,
  maxRecoveryDays: 0, // No recovery in MVP
  atRiskWarningHours: 6,
};

// ============================================================
// Streak Milestones
// ============================================================

export interface StreakMilestoneConfig {
  daysRequired: number;
  rewardType: 'xp' | 'badge' | 'title' | 'cosmetic' | 'profile_frame';
  rewardValue: string | number;
  xp: number;
  badgeId?: string;
  titleId?: string;
  cosmeticId?: string;
}

export const STREAK_MILESTONES: StreakMilestoneConfig[] = [
  { daysRequired: 3, rewardType: 'xp', rewardValue: 100, xp: 100 },
  { daysRequired: 7, rewardType: 'badge', rewardValue: 'streak_7_days', xp: 200, badgeId: 'streak_7_days' },
  { daysRequired: 14, rewardType: 'xp', rewardValue: 500, xp: 500 },
  { daysRequired: 30, rewardType: 'badge', rewardValue: 'streak_30_days', xp: 1000, badgeId: 'streak_30_days' },
  { daysRequired: 60, rewardType: 'xp', rewardValue: 2000, xp: 2000 },
  { daysRequired: 100, rewardType: 'title', rewardValue: 'legendary_streak', xp: 5000, titleId: 'legendary_streak' },
  { daysRequired: 365, rewardType: 'badge', rewardValue: 'streak_365_days', xp: 10000, badgeId: 'streak_365_days' },
];

// ============================================================
// Reward Configuration
// ============================================================

export interface RewardConfig {
  /** Auto-claim rewards on mission completion (true) or require manual claim (false) */
  autoClaimEnabled: boolean;
  /** Maximum XP that can be earned from missions per day */
  dailyMissionXpCap: number;
  /** Maximum XP that can be earned from streak per day */
  dailyStreakXpCap: number;
}

export const REWARD_CONFIG: RewardConfig = {
  autoClaimEnabled: false, // Manual claim by default for engagement
  dailyMissionXpCap: 1000,
  dailyStreakXpCap: 500,
};

// ============================================================
// XP Sources for Retention
// ============================================================

export const RETENTION_XP_SOURCES = {
  MISSION_COMPLETE: 0, // Variable per mission
  STREAK_MILESTONE: 0, // Variable per milestone
  LEVEL_UP_BONUS: 0, // Variable per level
} as const;

// ============================================================
// Retention Analytics Event Config
// ============================================================

export const RETENTION_ANALYTICS_EVENTS = [
  'mission_viewed',
  'mission_started',
  'mission_progressed',
  'mission_completed',
  'mission_claimed',
  'mission_expired',
  'streak_started',
  'streak_extended',
  'streak_milestone',
  'streak_broken',
  'level_up',
  'reward_unlocked',
  'reward_claimed',
  'daily_rush_viewed',
  'retention_home_viewed',
] as const;

// ============================================================
// New User Onboarding Missions
// ============================================================

export const NEW_USER_MISSIONS: MissionTemplate[] = [
  {
    id: 'new_user_play_1',
    name: 'Welcome! Play Your First Game',
    description: 'Complete your first game session',
    type: 'PLAY_GAME',
    target: 1,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 100 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 100,
    minLevel: 1,
    maxLevel: 1, // Only for level 1 users
    version: 1,
  },
  {
    id: 'new_user_play_3',
    name: 'Get Started! Play 3 Games',
    description: 'Complete 3 game sessions',
    type: 'PLAY_GAME',
    target: 3,
    gameId: null,
    configuration: {},
    rewardConfiguration: { xp: 150 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 100,
    minLevel: 1,
    maxLevel: 2, // Level 1-2 users
    version: 1,
  },
  {
    id: 'new_user_score_1000',
    name: 'Score Your First 1,000',
    description: 'Score 1,000 or more points in a game',
    type: 'SCORE_THRESHOLD',
    target: 1000,
    gameId: null,
    configuration: { minScore: 1000 },
    rewardConfiguration: { xp: 100 },
    frequency: 'daily',
    difficulty: 'easy',
    weight: 100,
    minLevel: 1,
    maxLevel: 2,
    version: 1,
  },
];

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get mission templates for a user's level.
 */
export function getTemplatesForLevel(
  level: number,
  frequency: MissionFrequency = 'daily',
): MissionTemplate[] {
  const allTemplates = frequency === 'daily'
    ? DAILY_MISSION_TEMPLATES
    : frequency === 'weekly'
      ? WEEKLY_MISSION_TEMPLATES
      : MONTHLY_MISSION_TEMPLATES;

  return allTemplates.filter(
    (t) => level >= t.minLevel && (t.maxLevel === 0 || level <= t.maxLevel),
  );
}

/**
 * Get the current period string for a frequency.
 */
export function getCurrentPeriod(frequency: MissionFrequency): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  switch (frequency) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly': {
      // ISO week calculation
      const d = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${year}-${month}`;
    case 'once':
      return 'once';
  }
}

/**
 * Get today's date in UTC as YYYY-MM-DD.
 */
export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculate XP level from total XP.
 */
export function calculateLevel(xpTotal: number, levels: Array<{ level: number; xpRequired: number }>): number {
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xpTotal >= levels[i]!.xpRequired) {
      return levels[i]!.level;
    }
  }
  return 1;
}
