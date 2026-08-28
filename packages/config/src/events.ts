/**
 * GTX Rush — Live Events & Tournament Configuration v1.0
 *
 * Configuration for events, tournaments, scoring, and rewards.
 * All values are configurable and version-controlled.
 *
 * Contract: Live Ops Contract v1.0
 */

import type {
  EventType,
  TournamentFormat,
  ScoringFormula,
  EventRewardTier,
  EventRewardConfig,
  EventEligibilityConfig,
  EventRules,
  EventScoringConfig,
  EventFeatureFlags,
} from '@gtx-rush/types';

// ============================================================
// Feature Flags (Default Values)
// ============================================================

export const DEFAULT_EVENT_FEATURE_FLAGS: EventFeatureFlags = {
  liveEventsEnabled: true,
  tournamentsEnabled: true,
  weekendEventsEnabled: true,
  sponsoredEventsEnabled: false, // Disabled in MVP
};

// ============================================================
// Event Type Defaults
// ============================================================

export const EVENT_TYPE_DEFAULTS: Record<EventType, {
  durationMs: number;
  maxAttempts: number | null;
  scoringFormula: ScoringFormula;
  autoDistribute: boolean;
}> = {
  daily_event: {
    durationMs: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 10,
    scoringFormula: 'best_score',
    autoDistribute: true,
  },
  weekly_event: {
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxAttempts: null, // Unlimited
    scoringFormula: 'total_score',
    autoDistribute: true,
  },
  weekend_event: {
    durationMs: 3 * 24 * 60 * 60 * 1000, // 3 days (Fri-Sun)
    maxAttempts: null,
    scoringFormula: 'total_score',
    autoDistribute: true,
  },
  limited_event: {
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days default
    maxAttempts: 50,
    scoringFormula: 'best_score',
    autoDistribute: false,
  },
  tournament: {
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxAttempts: null,
    scoringFormula: 'best_score',
    autoDistribute: false,
  },
  championship: {
    durationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxAttempts: null,
    scoringFormula: 'total_score',
    autoDistribute: false,
  },
  community_event: {
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxAttempts: null,
    scoringFormula: 'best_score',
    autoDistribute: true,
  },
};

// ============================================================
// Tournament Format Defaults
// ============================================================

export const TOURNAMENT_FORMAT_DEFAULTS: Record<TournamentFormat, {
  bracketSize?: number;
  matchDurationMs?: number;
  winsNeeded?: number;
  durationMs: number;
}> = {
  score_attack: {
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
  head_to_head: {
    matchDurationMs: 60 * 1000, // 1 minute per match
    winsNeeded: 3,
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
  elimination: {
    bracketSize: 16,
    durationMs: 14 * 24 * 60 * 60 * 1000,
  },
  bracket: {
    bracketSize: 16,
    durationMs: 14 * 24 * 60 * 60 * 1000,
  },
  swiss: {
    durationMs: 14 * 24 * 60 * 60 * 1000,
  },
  leaderboard_tournament: {
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
};

// ============================================================
// Default Event Rules
// ============================================================

export const DEFAULT_EVENT_RULES: EventRules = {
  maxAttempts: 10,
  bestScoreCounts: true,
  tieBreak: 'earliest_timestamp',
  customRules: [],
  attemptConstraint: 'limited',
};

// ============================================================
// Default Scoring Config
// ============================================================

export const DEFAULT_SCORING_CONFIG: EventScoringConfig = {
  formula: 'best_score',
  multiplier: 1.0,
  participationPoints: 10,
  personalBestBonus: 50,
  topN: 5,
  customRules: {},
};

// ============================================================
// Default Reward Config
// ============================================================

export const DEFAULT_REWARD_CONFIG: EventRewardConfig = {
  tiers: [
    {
      minRank: 1,
      maxRank: 10,
      reward: {
        xp: 500,
        badgeId: 'event_top_10',
        titleId: 'event_champion',
        cosmeticId: 'frame_event_legendary',
        profileFrameId: null,
      },
    },
    {
      minRank: 11,
      maxRank: 100,
      reward: {
        xp: 250,
        badgeId: 'event_top_100',
        titleId: null,
        cosmeticId: 'frame_event_epic',
        profileFrameId: null,
      },
    },
    {
      minRank: 101,
      maxRank: 1000,
      reward: {
        xp: 100,
        badgeId: 'event_top_1000',
        titleId: null,
        cosmeticId: null,
        profileFrameId: null,
      },
    },
  ],
  participationReward: {
    xp: 25,
    badgeId: null,
    titleId: null,
    cosmeticId: null,
    profileFrameId: null,
  },
  autoDistribute: true,
};

// ============================================================
// Default Eligibility Config
// ============================================================

export const DEFAULT_ELIGIBILITY_CONFIG: EventEligibilityConfig = {
  minLevel: 1,
  maxLevel: 0, // No max
  requiredGameId: null, // Any game
  minAccountAgeDays: 0,
  countries: [], // All countries
  requiredSeasonId: null,
  requiredTier: null,
};

// ============================================================
// Daily Event Templates
// ============================================================

export interface DailyEventTemplate {
  id: string;
  name: string;
  gameId: string;
  rules: Partial<EventRules>;
  scoring: Partial<EventScoringConfig>;
  reward: Partial<EventRewardConfig>;
}

export const DAILY_EVENT_TEMPLATES: DailyEventTemplate[] = [
  {
    id: 'daily_reaction_rush',
    name: "⚡ Today's Rush - Reaction Rush",
    gameId: 'reaction-rush',
    rules: { maxAttempts: 10, bestScoreCounts: true },
    scoring: { formula: 'best_score', multiplier: 1.0 },
    reward: {
      tiers: [
        { minRank: 1, maxRank: 100, reward: { xp: 150, badgeId: 'daily_top_100', titleId: null, cosmeticId: null, profileFrameId: null } },
        { minRank: 101, maxRank: 1000, reward: { xp: 75, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null } },
      ],
      participationReward: { xp: 10, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null },
    },
  },
  {
    id: 'daily_tap_rush',
    name: "⚡ Today's Rush - Tap Rush",
    gameId: 'tap-rush',
    rules: { maxAttempts: 10, bestScoreCounts: true },
    scoring: { formula: 'best_score', multiplier: 1.0 },
    reward: {
      tiers: [
        { minRank: 1, maxRank: 100, reward: { xp: 150, badgeId: 'daily_top_100', titleId: null, cosmeticId: null, profileFrameId: null } },
        { minRank: 101, maxRank: 1000, reward: { xp: 75, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null } },
      ],
      participationReward: { xp: 10, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null },
    },
  },
  {
    id: 'daily_quiz_rush',
    name: "⚡ Today's Rush - Quiz Rush",
    gameId: 'quiz-rush',
    rules: { maxAttempts: 5, bestScoreCounts: true },
    scoring: { formula: 'best_score', multiplier: 1.0 },
    reward: {
      tiers: [
        { minRank: 1, maxRank: 100, reward: { xp: 150, badgeId: 'daily_top_100', titleId: null, cosmeticId: null, profileFrameId: null } },
        { minRank: 101, maxRank: 1000, reward: { xp: 75, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null } },
      ],
      participationReward: { xp: 10, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null },
    },
  },
];

// ============================================================
// Weekend Event Templates
// ============================================================

export const WEEKEND_EVENT_TEMPLATES: DailyEventTemplate[] = [
  {
    id: 'weekend_rush',
    name: '🔥 Weekend Rush',
    gameId: 'reaction-rush', // Primary game
    rules: { maxAttempts: null, bestScoreCounts: false, attemptConstraint: 'unlimited' },
    scoring: { formula: 'total_score', multiplier: 1.0 },
    reward: {
      tiers: [
        { minRank: 1, maxRank: 10, reward: { xp: 1000, badgeId: 'weekend_champion', titleId: 'weekend_warrior', cosmeticId: 'frame_weekend_legendary', profileFrameId: null } },
        { minRank: 11, maxRank: 100, reward: { xp: 500, badgeId: 'weekend_top_100', titleId: null, cosmeticId: 'frame_weekend_epic', profileFrameId: null } },
        { minRank: 101, maxRank: 1000, reward: { xp: 200, badgeId: null, titleId: null, cosmeticId: null, profileFrameId: null } },
      ],
      participationReward: { xp: 50, badgeId: 'weekend_participant', titleId: null, cosmeticId: null, profileFrameId: null },
    },
  },
];

// ============================================================
// Event Scoring Formulas
// ============================================================

export const SCORING_FORMULAS = {
  best_score: {
    name: 'Best Score',
    description: 'Your highest single score counts',
    calculate: (scores: number[]) => Math.max(...scores, 0),
  },
  total_score: {
    name: 'Total Score',
    description: 'Sum of all your scores',
    calculate: (scores: number[]) => scores.reduce((sum, s) => sum + s, 0),
  },
  average_score: {
    name: 'Average Score',
    description: 'Average of all your scores',
    calculate: (scores: number[]) => scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
  },
  top_n_scores: {
    name: 'Top N Scores',
    description: 'Sum of your top N scores',
    calculate: (scores: number[], topN: number = 5) => {
      const sorted = [...scores].sort((a, b) => b - a).slice(0, topN);
      return sorted.reduce((sum, s) => sum + s, 0);
    },
  },
  points_per_win: {
    name: 'Points Per Win',
    description: 'Points awarded for each win',
    calculate: (scores: number[]) => scores.filter((s) => s > 0).length * 100,
  },
};

// ============================================================
// Event Badge Templates
// ============================================================

export const EVENT_BADGE_TEMPLATES = [
  { id: 'daily_top_100', name: 'Daily Top 100', description: 'Finished in the top 100 of a daily event', rarity: 'common' as const },
  { id: 'daily_top_10', name: 'Daily Top 10', description: 'Finished in the top 10 of a daily event', rarity: 'rare' as const },
  { id: 'weekend_champion', name: 'Weekend Champion', description: 'Finished in the top 10 of a weekend event', rarity: 'epic' as const },
  { id: 'weekend_top_100', name: 'Weekend Warrior', description: 'Finished in the top 100 of a weekend event', rarity: 'rare' as const },
  { id: 'weekend_participant', name: 'Weekend Participant', description: 'Participated in a weekend event', rarity: 'common' as const },
  { id: 'event_top_10', name: 'Event Champion', description: 'Finished in the top 10 of a major event', rarity: 'legendary' as const },
  { id: 'event_top_100', name: 'Event Elite', description: 'Finished in the top 100 of a major event', rarity: 'epic' as const },
  { id: 'event_top_1000', name: 'Event Contender', description: 'Finished in the top 1000 of a major event', rarity: 'rare' as const },
  { id: 'tournament_winner', name: 'Tournament Winner', description: 'Won a tournament', rarity: 'legendary' as const },
  { id: 'event_warrior', name: 'Event Warrior', description: 'Completed 10 live events', rarity: 'epic' as const },
  { id: 'rush_king', name: 'Rush King', description: 'Won 10 tournaments', rarity: 'legendary' as const },
];

// ============================================================
// Event Title Templates
// ============================================================

export const EVENT_TITLE_TEMPLATES = [
  { id: 'event_champion', name: 'Event Champion', description: 'Top performer in events', rarity: 'legendary' as const },
  { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Weekend event specialist', rarity: 'epic' as const },
  { id: 'rush_king', name: 'Rush King', description: 'Dominates rush events', rarity: 'legendary' as const },
  { id: 'tournament_master', name: 'Tournament Master', description: 'Tournament veteran', rarity: 'epic' as const },
];

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get default rules for an event type.
 */
export function getDefaultEventRules(type: EventType): EventRules {
  const defaults = EVENT_TYPE_DEFAULTS[type];
  return {
    ...DEFAULT_EVENT_RULES,
    maxAttempts: defaults.maxAttempts,
    bestScoreCounts: defaults.scoringFormula === 'best_score',
  };
}

/**
 * Get default scoring config for an event type.
 */
export function getDefaultScoringConfig(type: EventType): EventScoringConfig {
  const defaults = EVENT_TYPE_DEFAULTS[type];
  return {
    ...DEFAULT_SCORING_CONFIG,
    formula: defaults.scoringFormula,
  };
}

/**
 * Get default reward config for an event type.
 */
export function getDefaultRewardConfig(type: EventType): EventRewardConfig {
  return { ...DEFAULT_REWARD_CONFIG };
}

/**
 * Get default eligibility config.
 */
export function getDefaultEligibilityConfig(): EventEligibilityConfig {
  return { ...DEFAULT_ELIGIBILITY_CONFIG };
}

/**
 * Calculate event score from game scores.
 */
export function calculateEventScore(
  gameScores: number[],
  formula: ScoringFormula,
  multiplier: number = 1.0,
  topN: number = 5,
): number {
  const baseScore = SCORING_FORMULAS[formula].calculate(gameScores, topN);
  return Math.round(baseScore * multiplier);
}

/**
 * Check if event is currently active based on time.
 */
export function isEventTimeActive(startsAt: Date, endsAt: Date): boolean {
  const now = new Date();
  return now >= startsAt && now <= endsAt;
}

/**
 * Get time remaining in event.
 */
export function getEventTimeRemaining(endsAt: Date): number {
  const now = new Date();
  return Math.max(0, endsAt.getTime() - now.getTime());
}

/**
 * Get reward tier for a rank.
 */
export function getRewardTierForRank(
  rank: number,
  tiers: EventRewardTier[],
): EventRewardTier | null {
  for (const tier of tiers) {
    if (rank >= tier.minRank && (tier.maxRank === null || rank <= tier.maxRank)) {
      return tier;
    }
  }
  return null;
}

/**
 * Generate event ID.
 */
export function generateEventId(type: EventType, date?: Date): string {
  const d = date ?? new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}_${dateStr}_${random}`;
}
