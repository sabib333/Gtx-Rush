/**
 * GTX Rush — AI Risk Engine v1.0
 *
 * AI-assisted anomaly detection across domains (§21-27).
 * Output is a RISK SCORE — never an automatic permanent ban (§21, §30).
 *
 * Pipeline: Signals → weighted score → versioned AIDecision → review queue.
 *
 * SECURITY:
 * - All inputs are server-side observations; client claims are ignored
 * - HIGH/CRITICAL requires multiple DISTINCT signals (§30)
 * - Shadow-mode models record predictions with no user-facing effect (§32)
 *
 * Contract: AI Intelligence Contract v1.0
 */

import type { FraudSignal } from '@gtx-rush/types';
import {
  ANOMALY_CONFIG,
  REFERRAL_FRAUD_CONFIG,
} from '@gtx-rush/config';
import { createDecision, riskLevelFromScore } from './model-registry';

// ============================================================
// In-memory observation stores (production: PostgreSQL / Redis)
// ============================================================

interface ScoreRecord {
  score: number;
  sessionSeconds: number;
  gameVersion: string;
  timestamp: number;
}

interface SessionRecord {
  startedAt: number;
  endedAt: number;
  requestCount: number;
  actionIntervalsMs: number[];
}

const playerScores = new Map<string, ScoreRecord[]>(); // userId → scores
const playerSessions = new Map<string, SessionRecord[]>();
const referralQualifications = new Map<
  string,
  Array<{ inviteeId: string; registeredAt: number; qualifiedAt: number }>
>(); // inviterId → qualifications
const economyEvents = new Map<string, Array<{ type: string; amount: number; timestamp: number }>>();
const paymentEvents = new Map<string, Array<{ status: string; timestamp: number }>>();

const POPULATION_SCORES: number[] = []; // global distribution sample

// ============================================================
// Recording (server-side ingestion only)
// ============================================================

export function recordScoreSubmission(
  userId: string,
  score: number,
  sessionSeconds: number,
  gameVersion: string,
): void {
  const record: ScoreRecord = { score, sessionSeconds, gameVersion, timestamp: Date.now() };
  const list = playerScores.get(userId) ?? [];
  list.push(record);
  playerScores.set(userId, list);
  if (POPULATION_SCORES.length < 10000) POPULATION_SCORES.push(score);
}

export function recordSession(
  userId: string,
  session: { startedAt: number; endedAt: number; requestCount: number; actionIntervalsMs: number[] },
): void {
  const list = playerSessions.get(userId) ?? [];
  list.push({ ...session });
  playerSessions.set(userId, list);
}

export function recordReferralQualification(
  inviterId: string,
  inviteeId: string,
  registeredAt: number,
  qualifiedAt: number,
): void {
  const list = referralQualifications.get(inviterId) ?? [];
  list.push({ inviteeId, registeredAt, qualifiedAt });
  referralQualifications.set(inviterId, list);
}

export function recordEconomyEvent(userId: string, type: string, amount: number): void {
  const list = economyEvents.get(userId) ?? [];
  list.push({ type, amount, timestamp: Date.now() });
  economyEvents.set(userId, list);
}

export function recordPaymentEvent(userId: string, status: string): void {
  const list = paymentEvents.get(userId) ?? [];
  list.push({ status, timestamp: Date.now() });
  paymentEvents.set(userId, list);
}

// ============================================================
// Score Anomaly Detection (§23)
// ============================================================

/**
 * FLAG only — never delete or invalidate the score here. Validation of a
 * flagged score happens through the review queue + server recalculation.
 */
export function detectScoreAnomaly(userId: string, newScore: number): {
  flagged: boolean;
  signals: FraudSignal[];
} {
  const signals: FraudSignal[] = [];
  const history = playerScores.get(userId) ?? [];
  const priorScores = history.slice(0, -1).map((s) => s.score);

  // vs own history
  if (priorScores.length >= 3) {
    const best = Math.max(...priorScores);
    if (best > 0 && newScore > best * ANOMALY_CONFIG.scoreAnomalyMultiplier) {
      signals.push({
        type: 'score_spike_vs_history',
        description: `Score ${newScore} exceeds personal best ${best} by >${ANOMALY_CONFIG.scoreAnomalyMultiplier}x`,
        severity: 'medium',
        weight: 35,
      });
    }
  }

  // vs population distribution (percentile approximation)
  if (POPULATION_SCORES.length >= 100) {
    const sorted = [...POPULATION_SCORES].sort((a, b) => a - b);
    const rank = sorted.filter((s) => s < newScore).length / sorted.length;
    if (rank >= ANOMALY_CONFIG.scorePopulationPercentile / 100) {
      signals.push({
        type: 'score_population_outlier',
        description: `Score above ${ANOMALY_CONFIG.scorePopulationPercentile}th population percentile`,
        severity: 'low',
        weight: 15,
      });
    }
  }

  // impossible throughput: enormous score in tiny session
  const latest = history[history.length - 1];
  if (latest && latest.sessionSeconds > 0 && newScore / latest.sessionSeconds > 5000) {
    signals.push({
      type: 'impossible_scoring_rate',
      description: 'Scoring rate exceeds humanly plausible throughput',
      severity: 'high',
      weight: 45,
    });
  }

  return { flagged: signals.length > 0, signals };
}

export function evaluateScoreAnomaly(userId: string, modelId: string): {
  riskScore: number;
  signals: FraudSignal[];
} {
  const history = playerScores.get(userId) ?? [];
  const latest = history[history.length - 1];
  if (!latest) return { riskScore: 0, signals: [] };

  const { signals } = detectScoreAnomaly(userId, latest.score);
  return { riskScore: computeRiskScore(signals), signals };
}

// ============================================================
// Bot Detection (§24)
// ============================================================

export function evaluateBotRisk(userId: string, modelId: string): {
  riskScore: number;
  signals: FraudSignal[];
} {
  const signals: FraudSignal[] = [];
  const sessions = playerSessions.get(userId) ?? [];

  if (sessions.length < ANOMALY_CONFIG.botMinSessions) {
    return { riskScore: 0, signals };
  }

  // Timing regularity: variance of inter-action intervals near zero = automation
  const allIntervals = sessions.flatMap((s) => s.actionIntervalsMs);
  if (allIntervals.length >= 20) {
    const mean = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
    const variance =
      allIntervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allIntervals.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

    if (cv < ANOMALY_CONFIG.botTimingVarianceThreshold) {
      signals.push({
        type: 'impossible_timing_consistency',
        description: `Action timing coefficient of variation ${cv.toFixed(4)} below human threshold`,
        severity: 'high',
        weight: 50,
      });
    }
  }

  // Request frequency abuse
  const recentSession = sessions[sessions.length - 1];
  if (recentSession) {
    const durationMinutes = Math.max(0.01, (recentSession.endedAt - recentSession.startedAt) / 60000);
    if (recentSession.requestCount / durationMinutes > 600) {
      signals.push({
        type: 'abnormal_request_frequency',
        description: 'Request rate far exceeds interactive play',
        severity: 'high',
        weight: 40,
      });
    }
  }

  // Repeated identical session structure
  const durations = sessions.map((s) => s.endedAt - s.startedAt);
  const firstDuration = durations[0] ?? 0;
  const identicalDurations = durations.filter((d) => Math.abs(d - firstDuration) < 50).length;
  if (identicalDurations >= sessions.length) {
    signals.push({
      type: 'repeated_identical_behavior',
      description: 'All sessions have near-identical durations',
      severity: 'medium',
      weight: 25,
    });
  }

  return { riskScore: computeRiskScore(signals), signals };
}

// ============================================================
// Referral Fraud Intelligence (§25)
// ============================================================

export function evaluateReferralRisk(inviterId: string, modelId: string): {
  riskScore: number;
  signals: FraudSignal[];
} {
  const signals: FraudSignal[] = [];
  const quals = referralQualifications.get(inviterId) ?? [];

  // Qualification speed: too fast to be organic
  const fastQuals = quals.filter(
    (q) =>
      q.qualifiedAt - q.registeredAt <
      REFERRAL_FRAUD_CONFIG.fastQualificationMinutes * 60 * 1000,
  );
  if (fastQuals.length >= REFERRAL_FRAUD_CONFIG.clusterSizeThreshold) {
    signals.push({
      type: 'referral_fast_qualification_cluster',
      description: `${fastQuals.length} referrals qualified within ${REFERRAL_FRAUD_CONFIG.fastQualificationMinutes} minutes of registration`,
      severity: 'high',
      weight: 45,
    });
  }

  // Reward velocity
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recentQualified = quals.filter((q) => q.qualifiedAt > hourAgo);
  if (recentQualified.length > REFERRAL_FRAUD_CONFIG.rewardVelocityPerHourMax) {
    signals.push({
      type: 'referral_reward_velocity',
      description: `${recentQualified.length} qualified referrals in one hour`,
      severity: 'medium',
      weight: 30,
    });
  }

  // Cluster: sequential registrations with uniform spacing (automation signature)
  if (quals.length >= REFERRAL_FRAUD_CONFIG.clusterSizeThreshold) {
    const gaps = quals
      .slice(1)
      .map((q, i) => q.registeredAt - (quals[i]?.registeredAt ?? q.registeredAt));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const uniformity =
      gaps.every((g) => Math.abs(g - avgGap) < avgGap * 0.1) && avgGap > 0;
    if (uniformity) {
      signals.push({
        type: 'referral_registration_uniformity',
        description: 'Registrations arrive at machine-uniform intervals',
        severity: 'high',
        weight: 40,
      });
    }
  }

  return { riskScore: computeRiskScore(signals), signals };
}

// ============================================================
// Economy Anomaly Detection (§26)
// ============================================================

export function evaluateEconomyRisk(userId: string, modelId: string): {
  riskScore: number;
  signals: FraudSignal[];
} {
  const signals: FraudSignal[] = [];
  const events = economyEvents.get(userId) ?? [];

  // XP spike: total gain in last hour vs typical daily pace proxy
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const xpLastHour = events
    .filter((e) => e.type === 'xp' && e.timestamp > hourAgo)
    .reduce((sum, e) => sum + e.amount, 0);

  const xpBaseline = events.filter((e) => e.type === 'xp');
  const baselineAvg =
    xpBaseline.length > 10
      ? xpBaseline.reduce((s, e) => s + e.amount, 0) /
        Math.max(1, (events[events.length - 1]?.timestamp ?? Date.now()) - (events[0]?.timestamp ?? Date.now())) *
        3600000
      : 0;

  if (
    baselineAvg > 0 &&
    xpLastHour > baselineAvg * ANOMALY_CONFIG.economyXpSpikeMultiplier &&
    xpLastHour > 1000
  ) {
    signals.push({
      type: 'economy_xp_spike',
      description: `XP gain ${xpLastHour}/h far exceeds established baseline`,
      severity: 'high',
      weight: 40,
    });
  }

  // Repeated identical claims within window
  const windowStart = Date.now() - ANOMALY_CONFIG.economyRepeatedClaimWindowMinutes * 60 * 1000;
  const claimCounts = new Map<string, number>();
  for (const e of events) {
    if (e.type.startsWith('claim:') && e.timestamp > windowStart) {
      claimCounts.set(e.type, (claimCounts.get(e.type) ?? 0) + 1);
    }
  }
  for (const [claimType, count] of claimCounts) {
    if (count >= ANOMALY_CONFIG.economyRepeatedClaimMax) {
      signals.push({
        type: 'economy_repeated_claims',
        description: `${count} identical claims (${claimType}) within window`,
        severity: 'medium',
        weight: 30,
        metadata: { claimType },
      });
    }
  }

  return { riskScore: computeRiskScore(signals), signals };
}

// ============================================================
// Payment Anomaly (§27) — flagging ONLY
// ============================================================

/**
 * Payment truth always comes from authoritative provider verification.
 * This produces a review signal, never a payment decision.
 */
export function evaluatePaymentRisk(userId: string, modelId: string): {
  riskScore: number;
  signals: FraudSignal[];
} {
  const signals: FraudSignal[] = [];
  const events = paymentEvents.get(userId) ?? [];

  const windowStart = Date.now() - ANOMALY_CONFIG.paymentFailureWindowMinutes * 60 * 1000;
  const failures = events.filter((e) => e.status === 'failed' && e.timestamp > windowStart);
  if (failures.length >= ANOMALY_CONFIG.paymentFailureMax) {
    signals.push({
      type: 'payment_repeated_failures',
      description: `${failures.length} failed payments in ${ANOMALY_CONFIG.paymentFailureWindowMinutes} minutes`,
      severity: 'medium',
      weight: 25,
    });
  }

  // Duplicate confirmations for the same purchase are verified by the
  // payment service; we only observe the pattern here.
  const confirms = events.filter((e) => e.status === 'confirmed').length;
  if (confirms >= 5) {
    signals.push({
      type: 'payment_unusual_volume',
      description: 'Unusual confirmation volume requires verification check',
      severity: 'low',
      weight: 15,
    });
  }

  return { riskScore: computeRiskScore(signals), signals };
}

// ============================================================
// Scoring Helper
// ============================================================

function computeRiskScore(signals: FraudSignal[]): number {
  return Math.min(
    100,
    signals.reduce((sum, s) => sum + (s.weight ?? 0), 0),
  );
}

export function currentRiskLevel(score: number): string {
  return riskLevelFromScore(score);
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearRiskEngine(): void {
  playerScores.clear();
  playerSessions.clear();
  referralQualifications.clear();
  economyEvents.clear();
  paymentEvents.clear();
  POPULATION_SCORES.length = 0;
}
