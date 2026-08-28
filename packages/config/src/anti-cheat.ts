export const ANTI_CHEAT_CONFIG = {
  /** Global thresholds */
  maxInputsPerSecond: 50,
  maxSessionDurationMs: 300_000, // 5 minutes absolute max
  minInputCount: 1,
  maxConcurrentSessions: 2,

  /** Fraud scoring thresholds */
  fraudScoreThresholds: {
    review: 10,
    autoSuspend: 50,
    autoBan: 100,
  },

  /** Severity scores */
  severityScores: {
    low: 1,
    medium: 5,
    high: 20,
    critical: 100,
  },

  /** Game-specific thresholds */
  games: {
    'reaction-rush': {
      minReactionTimeMs: 100,
      maxReactionTimeMs: 5_000,
      maxRounds: 10,
      patternDetectionThreshold: 0.95, // Correlation coefficient
    },
    'tap-rush': {
      maxTapRatePerSecond: 20,
      maxTotalTaps: 500,
      coordinateBounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
      tapRegularityThreshold: 0.98, // How regular intervals must be to flag
    },
    'quiz-rush': {
      minAnswerTimeMs: 200,
      maxQuestions: 20,
      suspiciousPerfectScore: true, // 100% with min time
    },
  },

  /** IP-based detection */
  maxReferralsPerIP: 5,
  maxAccountsPerDevice: 2,

  /** Rate limiting for score submissions */
  maxScoreSubmissionsPerMinute: 5,
  maxGameSessionsPerHour: 20,
};
