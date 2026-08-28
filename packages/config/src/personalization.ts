/**
 * GTX Rush — AI Personalization & Smart Game Director Engine Config
 *
 * Configuration for player preferences, recommendations, goals,
 * adaptive difficulty, A/B testing, and feature flags.
 *
 * Contract: AI Personalization Contract v1.0
 */

import type {
  GameId,
  SkillBand,
  DifficultyAdjustment,
  ExperimentVariant,
} from '@gtx-rush/types';

// ============================================================
// Feature Flags
// ============================================================

export const PERSONALIZATION_FLAGS = {
  personalization_enabled: true,
  smart_home_enabled: true,
  adaptive_practice_enabled: true,
  smart_events_enabled: true,
  smart_missions_enabled: true,
  smart_social_enabled: true,
  goal_system_enabled: true,
  experiments_enabled: false,
  ai_recommendations_enabled: false,
} as const;

// ============================================================
// Game Preference Configuration
// ============================================================

export const GAME_PREFERENCE_CONFIG = {
  // Weight factors for calculating preference score
  weights: {
    gamesPlayed: 0.15,
    gamesCompleted: 0.20,
    repeatSessions: 0.25,
    personalBestAttempts: 0.15,
    eventParticipation: 0.15,
    averageScore: 0.10,
  },
  // Minimum games to establish preference
  minimumGamesForPreference: 3,
  // Preference decay over time (days)
  decayHalfLifeDays: 7,
  // Maximum preference score
  maxPreferenceScore: 100,
} as const;

// ============================================================
// Skill Estimation Configuration
// ============================================================

export const SKILL_CONFIG = {
  // Skill band thresholds
  bands: {
    beginner: { min: 0, max: 20 },
    intermediate: { min: 21, max: 45 },
    advanced: { min: 46, max: 70 },
    expert: { min: 71, max: 90 },
    elite: { min: 91, max: 100 },
  } as Record<SkillBand, { min: number; max: number }>,
  // Weight for recent performance
  recentPerformanceWeight: 0.6,
  // Minimum games for reliable skill estimate
  minimumGamesForSkill: 5,
  // Skill update smoothing factor
  smoothingFactor: 0.3,
} as const;

// ============================================================
// Recommendation Configuration
// ============================================================

export const RECOMMENDATION_CONFIG = {
  // Scoring weights
  weights: {
    preference: 0.25,
    recency: 0.15,
    difficultyFit: 0.20,
    socialRelevance: 0.15,
    eventUrgency: 0.15,
    goalRelevance: 0.10,
  },
  // Exploration ratio (1 - exploitation)
  explorationRatio: 0.2,
  // Maximum recommendations per request
  maxRecommendations: 6,
  // Cache duration in seconds
  cacheDurationSeconds: 300,
  // Personal best coach threshold (percentage)
  personalBestCoachThreshold: 0.05, // 5%
} as const;

// ============================================================
// Goal Configuration
// ============================================================

export const GOAL_CONFIG = {
  // Maximum active goals per user
  maxActiveGoals: 5,
  // Goal expiration (days)
  goalExpirationDays: 30,
  // System-suggested goal templates
  templates: {
    reach_rank: {
      targets: [1000, 5000, 10000, 50000],
      titles: ['Reach Top {target}', 'Break into Top {target}', 'Climb to Top {target}'],
    },
    get_personal_best: {
      targets: [1, 3, 5],
      titles: ['Set {target} Personal Best', 'Achieve {target} New High Scores'],
    },
    maintain_streak: {
      targets: [3, 7, 14, 30],
      titles: ['Keep {target}-Day Streak', 'Maintain {target} Day Streak'],
    },
    win_challenges: {
      targets: [1, 3, 5, 10],
      titles: ['Win {target} Challenge', 'Conquer {target} Challenges'],
    },
    complete_missions: {
      targets: [2, 5, 10],
      titles: ['Complete {target} Missions', 'Finish {target} Missions'],
    },
    play_games: {
      targets: [5, 10, 20],
      titles: ['Play {target} Games', 'Complete {target} Sessions'],
    },
    join_events: {
      targets: [1, 3, 5],
      titles: ['Join {target} Event', 'Participate in {target} Events'],
    },
  },
} as const;

// ============================================================
// Adaptive Difficulty Configuration
// ============================================================

export const ADAPTIVE_DIFFICULTY_CONFIG: Record<GameId, {
  enabled: boolean;
  practiceMode: boolean;
  adjustments: DifficultyAdjustment[];
}> = {
  'reaction-rush': {
    enabled: true,
    practiceMode: true,
    adjustments: [
      { skillBand: 'beginner', timingMultiplier: 1.5, targetMultiplier: 0.8, comboMultiplier: 0.5, description: 'More generous timing' },
      { skillBand: 'intermediate', timingMultiplier: 1.0, targetMultiplier: 1.0, comboMultiplier: 1.0, description: 'Normal timing' },
      { skillBand: 'advanced', timingMultiplier: 0.9, targetMultiplier: 1.1, comboMultiplier: 1.2, description: 'Faster timing' },
      { skillBand: 'expert', timingMultiplier: 0.8, targetMultiplier: 1.2, comboMultiplier: 1.5, description: 'Expert timing' },
      { skillBand: 'elite', timingMultiplier: 0.7, targetMultiplier: 1.3, comboMultiplier: 2.0, description: 'Elite timing' },
    ],
  },
  'tap-rush': {
    enabled: true,
    practiceMode: true,
    adjustments: [
      { skillBand: 'beginner', timingMultiplier: 1.4, targetMultiplier: 0.7, comboMultiplier: 0.5, description: 'Easier targets' },
      { skillBand: 'intermediate', timingMultiplier: 1.0, targetMultiplier: 1.0, comboMultiplier: 1.0, description: 'Normal difficulty' },
      { skillBand: 'advanced', timingMultiplier: 0.9, targetMultiplier: 1.2, comboMultiplier: 1.3, description: 'Faster targets' },
      { skillBand: 'expert', timingMultiplier: 0.8, targetMultiplier: 1.4, comboMultiplier: 1.6, description: 'Expert targets' },
      { skillBand: 'elite', timingMultiplier: 0.7, targetMultiplier: 1.5, comboMultiplier: 2.0, description: 'Elite targets' },
    ],
  },
  'quiz-rush': {
    enabled: true,
    practiceMode: true,
    adjustments: [
      { skillBand: 'beginner', timingMultiplier: 1.5, targetMultiplier: 0.6, comboMultiplier: 0.5, description: 'Easier questions' },
      { skillBand: 'intermediate', timingMultiplier: 1.0, targetMultiplier: 1.0, comboMultiplier: 1.0, description: 'Standard questions' },
      { skillBand: 'advanced', timingMultiplier: 0.9, targetMultiplier: 1.2, comboMultiplier: 1.2, description: 'Harder questions' },
      { skillBand: 'expert', timingMultiplier: 0.8, targetMultiplier: 1.4, comboMultiplier: 1.5, description: 'Expert questions' },
      { skillBand: 'elite', timingMultiplier: 0.7, targetMultiplier: 1.5, comboMultiplier: 2.0, description: 'Elite questions' },
    ],
  },
};

// ============================================================
// Engagement Configuration
// ============================================================

export const ENGAGEMENT_CONFIG = {
  // Thresholds for engagement levels
  levels: {
    inactive: { minDaysSinceLastSession: 7 },
    returning: { minDaysSinceLastSession: 2, maxDaysSinceLastSession: 7 },
    active: { minDaysSinceLastSession: 0, maxDaysSinceLastSession: 2 },
    power: { minGamesPerWeek: 10, minDaysPerWeek: 5 },
  },
  // Welcome back message thresholds
  welcomeBack: {
    missedEvents: true,
    missedFriends: true,
    showNewEvents: true,
  },
} as const;

// ============================================================
// Cold Start Configuration
// ============================================================

export const COLD_START_CONFIG = {
  // Default recommendations for new users
  defaultRecommendations: [
    { type: 'game' as const, gameId: 'reaction-rush' as GameId, title: 'Try Reaction Rush', reason: 'Our most popular game' },
    { type: 'game' as const, gameId: 'tap-rush' as GameId, title: 'Try Tap Rush', reason: 'Fast-paced tapping action' },
    { type: 'game' as const, gameId: 'quiz-rush' as GameId, title: 'Try Quiz Rush', reason: 'Test your knowledge' },
  ],
  // Minimum games before personalization kicks in
  minimumGamesForPersonalization: 3,
  // Exploration ratio for cold start
  coldStartExplorationRatio: 0.5,
} as const;

// ============================================================
// Cache Configuration
// ============================================================

export const PERSONALIZATION_CACHE = {
  // Player profile cache duration (seconds)
  profileCacheDuration: 600,
  // Recommendation cache duration (seconds)
  recommendationCacheDuration: 300,
  // Skill estimate cache duration (seconds)
  skillCacheDuration: 1800,
  // Goal cache duration (seconds)
  goalCacheDuration: 300,
} as const;

// ============================================================
// API Response Configuration
// ============================================================

export const PERSONALIZATION_API = {
  // Maximum goals per response
  maxGoals: 10,
  // Maximum recommendations per response
  maxRecommendations: 8,
  // Maximum plan tasks
  maxPlanTasks: 5,
  // Default page size
  defaultPageSize: 20,
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get skill band from score
 */
export function getSkillBand(score: number): SkillBand {
  const bands = SKILL_CONFIG.bands;
  if (score <= bands.beginner.max) return 'beginner';
  if (score <= bands.intermediate.max) return 'intermediate';
  if (score <= bands.advanced.max) return 'advanced';
  if (score <= bands.expert.max) return 'expert';
  return 'elite';
}

/**
 * Get adaptive difficulty adjustment for a game and skill level
 */
export function getDifficultyAdjustment(
  gameId: GameId,
  skillBand: SkillBand,
): DifficultyAdjustment | null {
  const config = ADAPTIVE_DIFFICULTY_CONFIG[gameId];
  if (!config?.enabled) return null;
  return config.adjustments.find((a) => a.skillBand === skillBand) ?? null;
}

/**
 * Get engagement level from days since last session
 */
export function getEngagementLevel(
  daysSinceLastSession: number,
  gamesPerWeek: number,
  daysPerWeek: number,
): 'inactive' | 'returning' | 'active' | 'power' {
  const config = ENGAGEMENT_CONFIG.levels;
  if (daysPerWeek >= config.power.minDaysPerWeek && gamesPerWeek >= config.power.minGamesPerWeek) {
    return 'power';
  }
  if (daysSinceLastSession <= config.active.maxDaysSinceLastSession) {
    return 'active';
  }
  if (daysSinceLastSession <= config.returning.maxDaysSinceLastSession) {
    return 'returning';
  }
  return 'inactive';
}

/**
 * Generate experiment variant assignment
 */
export function assignExperimentVariant(
  userId: string,
  variants: ExperimentVariant[],
): ExperimentVariant {
  // Simple hash-based assignment for deterministic results
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  hash = Math.abs(hash);

  // Normalize hash to 0-1
  const normalized = (hash % 10000) / 10000;

  // Find variant based on cumulative weights
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (normalized < cumulative) {
      return variant;
    }
  }

  // Fallback to first variant
  return variants[0]!;
}
