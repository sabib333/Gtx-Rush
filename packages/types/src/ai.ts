/**
 * GTX Rush — AI Intelligence Engine Types v1.0
 *
 * Types for the AI intelligence layer: model registry, feature store,
 * risk signals, review queue, and moderation assistance.
 *
 * Contract: AI Intelligence Contract v1.0
 */

import type { FraudSignal } from './growth';

// ============================================================
// Model Versioning (§16, §31, §32, §46, §47)
// ============================================================

export type ModelStatus = 'test' | 'shadow' | 'active' | 'retired';

export type ModelKind =
  | 'score_anomaly'
  | 'bot_detection'
  | 'referral_fraud'
  | 'economy_anomaly'
  | 'content_moderation'
  | 'recommendation_ranking';

export interface ModelVersion {
  modelId: string;
  kind: ModelKind;
  version: string;
  /** Dataset snapshot the model was trained/built on */
  trainingDatasetVersion: string;
  deployedAt: Date | null;
  status: ModelStatus;
  /** Feature-set version used at inference time */
  featureSetVersion: string;
}

export interface ShadowComparison {
  modelId: string;
  prediction: number; // model risk/score output
  actualOutcome: 'fraud_confirmed' | 'false_positive' | 'pending';
  recordedAt: Date;
}

// ============================================================
// Risk Signals & Decisions (§21-27, §28)
// ============================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskDomain =
  | 'score'
  | 'bot'
  | 'referral'
  | 'economy'
  | 'payment'
  | 'content';

// FraudSignal is defined in growth.ts (shared); AI signals add `weight`.

/**
 * An AI-produced decision. Every decision is versioned and auditable.
 * Anti-cheat decisions are RISK SIGNALS — never automatic verdicts.
 */
export interface AIDecision {
  id: string;
  domain: RiskDomain;
  subjectId: string; // userId or contentId
  modelId: string;
  modelVersion: string;
  featureSetVersion: string;
  decision: string; // e.g. 'flag_for_review' | 'allow' | 'hold_rewards'
  confidence: number; // 0-1
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  reasonCodes: string[];
  signals: FraudSignal[];
  shadowMode: boolean; // true → no user-facing effect
  createdAt: Date;
}

// ============================================================
// Review Queue (§29)
// ============================================================

export type ReviewCaseType =
  | 'score_anomaly'
  | 'bot_risk'
  | 'referral_risk'
  | 'economy_risk'
  | 'payment_risk'
  | 'content_risk';

export type ReviewCaseStatus = 'open' | 'confirmed' | 'dismissed' | 'escalated' | 'restricted';

export type AdminReviewAction = 'confirm' | 'dismiss' | 'escalate' | 'restrict';

export interface AIReviewCase {
  id: string;
  caseType: ReviewCaseType;
  subjectId: string;
  decisionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reasonCodes: string[];
  status: ReviewCaseStatus;
  assignedTo: string | null;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

// ============================================================
// Feature Store (§2, §37, §38)
// ============================================================

/** Non-sensitive behavioral features only. Sensitive profiling prohibited. */
export interface PlayerFeatures {
  userId: string;
  gamesPlayed: number;
  preferredGames: string[];
  averageSessionMinutes: number;
  challengeActivity: number;
  difficultyPreference: string;
  eventParticipation: number;
  creatorActivity: number;
  socialActivity: number;
  daysSinceLastActive: number;
  activeDaysLast7: number;
  computedAt: Date;
}

export interface ContentFeatures {
  contentId: string;
  creatorId: string;
  completionRate: number;
  repeatPlayRate: number;
  abandonmentRate: number;
  reportCount: number;
  positiveReactions: number;
  playCount: number;
  ageDays: number;
  textFingerprint: string;
  computedAt: Date;
}

// ============================================================
// Moderation Assistance (§17, §19, §20, §56, §57)
// ============================================================

export type ModerationScreeningDecision =
  | 'allow'
  | 'allow_with_flags'
  | 'human_review'
  | 'block';

export interface ContentScreeningResult {
  contentId: string;
  ruleValidationPassed: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  decision: ModerationScreeningDecision;
  flags: string[];
  reasonCodes: string[];
  sanitizedForAI: boolean;
}

export interface DuplicateMatch {
  contentId: string;
  similarity: number; // 0-1
}

// ============================================================
// Player Segments (§3)
// ============================================================

/** Behavioral segments only — a player may belong to multiple. */
export type PlayerSegment =
  | 'new_player'
  | 'casual_player'
  | 'competitive_player'
  | 'social_player'
  | 'creator'
  | 'event_player'
  | 'returning_player'
  | 'high_skill_player';

export interface PlayerSegmentResult {
  userId: string;
  segments: PlayerSegment[];
  computedAt: Date;
}

// ============================================================
// Recommendations (§4-9, §11, §14, §15, §39)
// ============================================================

export type RecommendationKind = 'game' | 'challenge' | 'creator' | 'event' | 'mission';

/**
 * A user-facing AI recommendation. NEVER contains internal risk scores,
 * model internals, or sensitive data (§35, §55).
 */
export interface AIRecommendation {
  id: string;
  kind: RecommendationKind;
  /** gameId / challengeId / creatorId / eventId / missionId */
  refId: string;
  title: string;
  /** Human-readable reason (§35 explainability) */
  reason: string;
  reasonCode: string;
  score: number;
  /** True when this slot was reserved for content discovery (§15) */
  exploration: boolean;
  /** 'fallback' when AI is unavailable and safe defaults are served (§39) */
  source: 'ai' | 'fallback';
}

/** Personalized home (§8). System navigation is never hidden behind AI. */
export interface AIHomeFeed {
  continueSection: AIRecommendation[];
  recommended: AIRecommendation[];
  friends: AIRecommendation[];
  trending: AIRecommendation[];
  events: AIRecommendation[];
  segments: PlayerSegment[];
  generatedAt: Date;
  source: 'ai' | 'fallback';
}

/** Difficulty suggestion (§9). Advisory only — never changes official rules. */
export interface DifficultySuggestion {
  gameId: string;
  suggestedDifficulty: 'easy' | 'normal' | 'hard' | 'expert';
  reason: string;
  reasonCode: string;
}

// ============================================================
// Recommendation Analytics (§44)
// ============================================================

export type RecommendationAction = 'impression' | 'click' | 'start' | 'complete' | 'dismiss';

export interface RecommendationInteraction {
  recommendationId: string;
  userId: string;
  kind: RecommendationKind;
  action: RecommendationAction;
  timestamp: Date;
}

export interface AIRecommendationMetrics {
  impressions: number;
  clicks: number;
  starts: number;
  completions: number;
  dismissals: number;
  clickThroughRate: number;
  completionRate: number;
}

// ============================================================
// Model Monitoring (§34, §44, §45, §48)
// ============================================================

export interface ModelHealthMetrics {
  modelId: string;
  version: string;
  status: ModelStatus;
  totalPredictions: number;
  confirmedFraud: number;
  falsePositives: number;
  falsePositiveRate: number;
  precision: number;
  recall: number;
  driftFlagged: boolean;
  lastEvaluatedAt: Date | null;
}
