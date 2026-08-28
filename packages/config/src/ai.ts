/**
 * GTX Rush — AI Intelligence Engine Configuration v1.0
 *
 * All thresholds configurable and version-controlled.
 *
 * Contract: AI Intelligence Contract v1.0
 */

import type { RiskLevel } from '@gtx-rush/types';

// ============================================================
// Risk Scoring (§22, §30)
// ============================================================

export const AI_RISK_CONFIG = {
  /** Risk score → level thresholds */
  levels: {
    low: 0,
    medium: 40,
    high: 65,
    critical: 85,
  } as Record<RiskLevel, number>,

  /** Minimum distinct signal types before HIGH/CRITICAL action (§30 false-positive protection) */
  minDistinctSignalsForHigh: 2,
  /** Review queue is required above this level — never automatic punishment */
  humanReviewRequiredAbove: 'high' as RiskLevel,
};

// ============================================================
// Anomaly Detection Thresholds (§21, §23, §24, §26)
// ============================================================

export const ANOMALY_CONFIG = {
  /** Score anomaly: multiple of the player's own historical best */
  scoreAnomalyMultiplier: 3.0,
  /** Score anomaly: percentile vs population above which flagged */
  scorePopulationPercentile: 99.5,
  /** Bot detection: max allowed timing variance for "impossible consistency" */
  botTimingVarianceThreshold: 0.02,
  /** Bot detection: minimum sessions before bot signals are evaluated */
  botMinSessions: 10,
  /** Economy: daily XP growth multiplier over user baseline considered unusual */
  economyXpSpikeMultiplier: 5.0,
  /** Economy: repeated identical claims within window */
  economyRepeatedClaimWindowMinutes: 60,
  economyRepeatedClaimMax: 3,
  /** Payment: failed attempts within window before flagging */
  paymentFailureWindowMinutes: 30,
  paymentFailureMax: 5,
};

// ============================================================
// Referral Fraud Intelligence (§25)
// ============================================================

export const REFERRAL_FRAUD_CONFIG = {
  /** Qualification speed: minutes from registration to qualification below which suspicious */
  fastQualificationMinutes: 3,
  /** Cluster size of referrals sharing metadata patterns before flagging */
  clusterSizeThreshold: 5,
  /** Reward velocity: qualified referrals per hour per inviter before flagging */
  rewardVelocityPerHourMax: 4,
};

// ============================================================
// Content Moderation & Duplicate Detection (§17, §20, §56, §57)
// ============================================================

export const MODERATION_AI_CONFIG = {
  /** Similarity threshold for near-duplicate detection (0-1) */
  duplicateSimilarityThreshold: 0.85,
  /** Max content length sent to any screening pipeline (data minimization §57) */
  maxScreenableLength: 2000,
  /** Prompt-injection patterns screened out before any AI processing */
  injectionPatterns: [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?(prior|above)\s+rules/i,
    /you\s+are\s+now\s+a/i,
    /system\s*[:]\s*/i,
    /<\/?(system|assistant|developer)>/i,
    /\b(execute|run)\b.{0,20}\b(command|script|sql)\b/i,
  ],
};

// ============================================================
// Recommendation Tuning (§15, §16, §50)
// ============================================================

export const RECOMMENDATION_AI_CONFIG = {
  /** Exploration ratio: share of recommendations reserved for discovery */
  explorationRatio: 0.3,
  /** Content quality weights for creator challenges (§16) */
  qualityWeights: {
    completionRate: 0.35,
    repeatPlayRate: 0.25,
    positiveReactions: 0.2,
    abandonmentPenalty: 0.1,
    reportPenalty: 0.1,
  },
  /** One weak signal never permanently suppresses content (§16) */
  suppressionRequiresSignals: 3,
};

// ============================================================
// Recommendation Ranking (§5, §6, §14)
// ============================================================

export const RANKING_AI_CONFIG = {
  /** Ranking weights — long-term quality over short-term CTR (§14) */
  weights: {
    relevance: 0.4,
    quality: 0.25,
    freshness: 0.15,
    socialRelevance: 0.2,
  },
  /** Freshness half-life in days for content ranking */
  freshnessHalfLifeDays: 14,
  /** Creator diversity: max recommendations from a single creator per feed (§6, §50) */
  maxPerCreator: 1,
  /** Echo-chamber guard: penalty applied to already-followed/played creators (§6) */
  echoChamberPenalty: 0.15,
  /** Minimum plays before content quality signals are trusted (§16) */
  minPlaysForQualitySignal: 3,
};

// ============================================================
// Cost Controls (§41) & LLM Boundaries (§42)
// ============================================================

export const AI_COST_CONFIG = {
  /** Max AI screening calls per minute (global budget) */
  maxScreeningCallsPerMinute: 30,
  /** Prefer rules/heuristics below this complexity; LLM only above */
  llmEscalationThreshold: 'rule_engine_insufficient',
  /** Cache TTL for recommendation results (seconds) */
  recommendationCacheTtlSeconds: 300,
  /** Batch inference preferred for non-realtime scoring */
  batchInferenceIntervalMinutes: 15,
};

// ============================================================
// Safe Fallbacks (§39, §40)
// ============================================================

export const AI_FALLBACK_CONFIG = {
  /** Trending fallback list size when AI recommendations are unavailable */
  trendingFallbackLimit: 5,
  /** Cache TTL override source (kept in sync with AI_COST_CONFIG) */
  recommendationCacheTtlSeconds: AI_COST_CONFIG.recommendationCacheTtlSeconds,
};

/** LLM usage boundaries (§42). These systems must NEVER use LLM inference. */
export const LLM_FORBIDDEN_DOMAINS = [
  'score_validation',
  'payment_validation',
  'xp_calculation',
  'leaderboard_ranking',
] as const;

// ============================================================
// Model Monitoring (§34, §45, §46)
// ============================================================

export const AI_MONITORING_CONFIG = {
  /** False positive rate above which a model is drift-flagged */
  driftFalsePositiveRateThreshold: 0.05,
  /** Minimum predictions before precision/recall are meaningful */
  minPredictionsForMetrics: 100,
  /** Shadow mode evaluation period (days) before promotion review */
  shadowEvaluationDays: 7,
};

// ============================================================
// Feature Store (§37)
// ============================================================

export const FEATURE_STORE_CONFIG = {
  /** Retention policy: raw events (days) — aggregates survive longer */
  rawEventRetentionDays: 90,
  aggregatedFeatureRetentionDays: 365,
  modelOutputRetentionDays: 180,
};
