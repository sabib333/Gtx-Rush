/**
 * GTX Rush — Creator & User-Generated Content Engine Config
 *
 * Configuration for creator profiles, custom challenges,
 * content validation, moderation, and discovery.
 *
 * Contract: Creator Engine Contract v1.0
 */

import type {
  ChallengeDifficulty,
  ChallengeVisibility,
  GameId,
  ReportReason,
} from '@gtx-rush/types';

// ============================================================
// Feature Flags
// ============================================================

export const CREATOR_FLAGS = {
  creator_enabled: true,
  custom_challenges_enabled: true,
  community_discovery_enabled: true,
  creator_follow_enabled: true,
  creator_badges_enabled: true,
  creator_monetization_enabled: false,
  ai_content_assist_enabled: false,
} as const;

// ============================================================
// Creator Profile Configuration
// ============================================================

export const CREATOR_PROFILE_CONFIG = {
  // Creator level XP requirements
  levelXp: [
    0,      // Level 1
    100,    // Level 2
    300,    // Level 3
    600,    // Level 4
    1000,   // Level 5
    1500,   // Level 6
    2200,   // Level 7
    3000,   // Level 8
    4000,   // Level 9
    5000,   // Level 10
  ],
  // XP rewards for creator actions
  xpRewards: {
    challenge_created: 10,
    challenge_published: 20,
    challenge_played: 1,
    challenge_completed: 2,
    challenge_shared: 5,
    follower_gained: 3,
    challenge_trending: 50,
  },
  // Maximum bio length
  maxBioLength: 200,
  // Maximum display name length
  maxDisplayNameLength: 30,
} as const;

// ============================================================
// Challenge Configuration
// ============================================================

export const CHALLENGE_CONFIG = {
  // Title validation
  title: {
    minLength: 3,
    maxLength: 50,
    forbiddenPatterns: [
      'OFFICIAL',
      'ADMIN',
      'REWARD',
      'FREE MONEY',
      'CLICK HERE',
      'www.',
      'http://',
      'https://',
    ],
  },
  // Description validation
  description: {
    maxLength: 500,
    forbiddenPatterns: [
      '<script',
      'javascript:',
      'onclick',
      'onerror',
      'data:',
    ],
  },
  // Difficulty settings
  difficulties: {
    easy: { color: '#4CAF50', label: 'Easy', multiplier: 0.8 },
    medium: { color: '#FF9800', label: 'Medium', multiplier: 1.0 },
    hard: { color: '#F44336', label: 'Hard', multiplier: 1.2 },
    extreme: { color: '#9C27B0', label: 'Extreme', multiplier: 1.5 },
  } as Record<ChallengeDifficulty, { color: string; label: string; multiplier: number }>,
  // Visibility options
  visibility: {
    public: { label: 'Public', discoverable: true },
    private: { label: 'Private', discoverable: false },
    unlisted: { label: 'Unlisted', discoverable: false },
  } as Record<ChallengeVisibility, { label: string; discoverable: boolean }>,
  // Maximum challenges per creator per day
  maxChallengesPerDay: 10,
  // Maximum concurrent published challenges
  maxPublishedChallenges: 50,
} as const;

// ============================================================
// Game-Specific Configuration Limits
// ============================================================

export const GAME_CONFIG_LIMITS: Record<GameId, {
  reaction?: {
    minRounds: number;
    maxRounds: number;
    minTimeWindow: number;
    maxTimeWindow: number;
    minDifficulty: number;
    maxDifficulty: number;
  };
  tap?: {
    minDuration: number;
    maxDuration: number;
    minTargetCount: number;
    maxTargetCount: number;
    minDifficulty: number;
    maxDifficulty: number;
  };
  quiz?: {
    minQuestionCount: number;
    maxQuestionCount: number;
    minTimePerQuestion: number;
    maxTimePerQuestion: number;
    minDifficulty: number;
    maxDifficulty: number;
    allowedCategories: string[];
  };
}> = {
  'reaction-rush': {
    reaction: {
      minRounds: 3,
      maxRounds: 20,
      minTimeWindow: 500,
      maxTimeWindow: 3000,
      minDifficulty: 1,
      maxDifficulty: 10,
    },
  },
  'tap-rush': {
    tap: {
      minDuration: 10,
      maxDuration: 60,
      minTargetCount: 5,
      maxTargetCount: 50,
      minDifficulty: 1,
      maxDifficulty: 10,
    },
  },
  'quiz-rush': {
    quiz: {
      minQuestionCount: 5,
      maxQuestionCount: 30,
      minTimePerQuestion: 5,
      maxTimePerQuestion: 30,
      minDifficulty: 1,
      maxDifficulty: 10,
      allowedCategories: [
        'general',
        'science',
        'technology',
        'sports',
        'history',
        'geography',
        'entertainment',
      ],
    },
  },
};

// ============================================================
// Content Validation Configuration
// ============================================================

export const CONTENT_VALIDATION_CONFIG = {
  // Profanity filter (simplified - production would use a real service)
  profanityFilter: {
    enabled: true,
    action: 'reject', // 'reject' or 'review'
  },
  // Spam detection
  spamDetection: {
    enabled: true,
    maxIdenticalTitles: 3,
    maxSimilarDescriptions: 5,
    cooldownMinutes: 5,
  },
  // Content quality thresholds
  qualityThresholds: {
    high: {
      minCompletionRate: 0.7,
      minUniquePlayers: 100,
      minReactions: 50,
      maxReports: 2,
    },
    low: {
      maxCompletionRate: 0.2,
      maxUniquePlayers: 10,
      minReports: 5,
    },
  },
} as const;

// ============================================================
// Moderation Configuration
// ============================================================

export const MODERATION_CONFIG = {
  // Report thresholds
  reportThresholds: {
    autoReview: 3, // Reports before auto-review
    autoRemove: 5, // Reports before auto-remove
    creatorWarning: 3, // Reports before warning
    creatorLimit: 5, // Reports before limiting creation
    creatorSuspend: 10, // Reports before suspension
  },
  // Moderation actions
  actions: {
    warning: { duration: null, description: 'Content violates guidelines' },
    limited_creation: { duration: 7 * 24 * 60 * 60 * 1000, description: 'Creation privileges limited' },
    content_removed: { duration: null, description: 'Content removed for policy violation' },
    creator_suspended: { duration: 30 * 24 * 60 * 60 * 1000, description: 'Creator account suspended' },
  },
  // Auto-approve settings
  autoApprove: {
    enabled: true,
    minCreatorLevel: 3,
    maxReports: 0,
    qualityScore: 'normal' as const,
  },
} as const;

// ============================================================
// Discovery Configuration
// ============================================================

export const DISCOVERY_CONFIG = {
  // Trending algorithm weights
  trendingWeights: {
    uniquePlayers: 0.3,
    recentPlays: 0.25,
    completionRate: 0.2,
    shareRate: 0.15,
    reactionRate: 0.1,
  },
  // Pagination
  defaultPageSize: 20,
  maxPageSize: 50,
  // Cache durations (seconds)
  cacheDuration: {
    trending: 300, // 5 minutes
    new: 60, // 1 minute
    popular: 600, // 10 minutes
  },
  // Diversity settings
  diversity: {
    maxChallengesPerCreator: 3, // Max challenges from same creator in feed
    newCreatorBoost: 1.5, // Boost multiplier for new creators
    newCreatorThreshold: 5, // Challenges created to be considered "new"
  },
} as const;

// ============================================================
// Creator Badges Configuration
// ============================================================

export const CREATOR_BADGES = {
  first_creation: {
    id: 'creator_first',
    name: 'First Creation',
    description: 'Created your first challenge',
    icon: '🎯',
    requirement: { challengesCreated: 1 },
  },
  popular_creator: {
    id: 'creator_popular',
    name: 'Popular Creator',
    description: 'Challenge reached 100 unique players',
    icon: '🔥',
    requirement: { uniquePlayers: 100 },
  },
  community_favorite: {
    id: 'creator_favorite',
    name: 'Community Favorite',
    description: 'Received 50 reactions on challenges',
    icon: '❤️',
    requirement: { reactions: 50 },
  },
  challenge_master: {
    id: 'creator_master',
    name: 'Challenge Master',
    description: 'Created 25 challenges with 80%+ completion rate',
    icon: '👑',
    requirement: { challengesCreated: 25, completionRate: 0.8 },
  },
  viral_creator: {
    id: 'creator_viral',
    name: 'Viral Creator',
    description: 'Challenge shared 100 times',
    icon: '🚀',
    requirement: { shares: 100 },
  },
} as const;

// ============================================================
// Rate Limiting Configuration
// ============================================================

export const CREATOR_RATE_LIMITS = {
  challengeCreation: {
    perMinute: 2,
    perHour: 10,
    perDay: 50,
  },
  challengePublishing: {
    perMinute: 2,
    perHour: 10,
    perDay: 50,
  },
  following: {
    perMinute: 5,
    perHour: 50,
    perDay: 200,
  },
  reporting: {
    perMinute: 3,
    perHour: 20,
    perDay: 100,
  },
} as const;

// ============================================================
// Deep Link Configuration (Creator-specific)
// ============================================================

export const CREATOR_DEEP_LINK_CONFIG = {
  baseUrl: 'https://t.me/gtxrushbot',
  challengePrefix: 'challenge',
  maxLength: 200,
} as const;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get creator level from XP
 */
export function getCreatorLevelFromXp(xp: number): number {
  const levels = CREATOR_PROFILE_CONFIG.levelXp;
  for (let i = levels.length - 1; i >= 0; i--) {
    const levelXp = levels[i];
    if (levelXp !== undefined && xp >= levelXp) return i + 1;
  }
  return 1;
}

/**
 * Get XP required for next level
 */
export function getXpForNextLevel(currentLevel: number): number {
  const levels = CREATOR_PROFILE_CONFIG.levelXp;
  return levels[currentLevel] ?? levels[levels.length - 1] ?? 0;
}

/**
 * Get trending score for a challenge
 */
export function calculateTrendingScore(stats: {
  uniquePlayers: number;
  recentPlays: number;
  completionRate: number;
  shareRate: number;
  reactionRate: number;
}): number {
  const weights = DISCOVERY_CONFIG.trendingWeights;
  return (
    stats.uniquePlayers * weights.uniquePlayers +
    stats.recentPlays * weights.recentPlays +
    stats.completionRate * 100 * weights.completionRate +
    stats.shareRate * weights.shareRate +
    stats.reactionRate * weights.reactionRate
  );
}

/**
 * Validate challenge title
 */
export function isTitleValid(title: string): { valid: boolean; error?: string } {
  if (title.length < CHALLENGE_CONFIG.title.minLength) {
    return { valid: false, error: `Title must be at least ${CHALLENGE_CONFIG.title.minLength} characters` };
  }
  if (title.length > CHALLENGE_CONFIG.title.maxLength) {
    return { valid: false, error: `Title must be at most ${CHALLENGE_CONFIG.title.maxLength} characters` };
  }
  const upperTitle = title.toUpperCase();
  for (const pattern of CHALLENGE_CONFIG.title.forbiddenPatterns) {
    if (upperTitle.includes(pattern)) {
      return { valid: false, error: 'Title contains forbidden content' };
    }
  }
  return { valid: true };
}

/**
 * Validate challenge description
 */
export function isDescriptionValid(description: string): { valid: boolean; error?: string } {
  if (description.length > CHALLENGE_CONFIG.description.maxLength) {
    return { valid: false, error: `Description must be at most ${CHALLENGE_CONFIG.description.maxLength} characters` };
  }
  const lowerDesc = description.toLowerCase();
  for (const pattern of CHALLENGE_CONFIG.description.forbiddenPatterns) {
    if (lowerDesc.includes(pattern)) {
      return { valid: false, error: 'Description contains forbidden content' };
    }
  }
  return { valid: true };
}


