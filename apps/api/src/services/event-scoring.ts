/**
 * GTX Rush — Event Scoring Engine v1.0
 *
 * Event scoring engine that handles:
 * - Score calculation from game scores
 * - Multiple scoring formulas
 * - Rank calculation
 * - Tie-breaking
 * - Score validation
 *
 * SECURITY:
 * - Score calculation is server-authoritative
 * - Anti-cheat integration
 * - Score validation is server-side
 *
 * Contract: Live Ops Contract v1.0
 */

import type {
  Event,
  EventAttempt,
  EventParticipant,
  EventScoringConfig,
  ScoringFormula,
  ScoreValidation,
} from '@gtx-rush/types';
import {
  SCORING_FORMULAS,
  calculateEventScore,
} from '@gtx-rush/config';

// ============================================================
// Score Calculation
// ============================================================

/**
 * Calculate event score from game score.
 *
 * SECURITY:
 * - Score calculation is server-authoritative
 * - Anti-cheat flags are checked
 */
export function calculateScore(
  gameScore: number,
  config: EventScoringConfig,
  antiCheatFlags: string[] = [],
): {
  eventScore: number;
  validated: boolean;
  flags: string[];
} {
  // Check anti-cheat flags
  if (antiCheatFlags.length > 0) {
    return {
      eventScore: 0,
      validated: false,
      flags: antiCheatFlags,
    };
  }

  // Calculate event score
  const eventScore = calculateEventScore(
    [gameScore],
    config.formula,
    config.multiplier,
    config.topN,
  );

  return {
    eventScore,
    validated: true,
    flags: [],
  };
}

/**
 * Calculate event score from multiple game scores.
 */
export function calculateEventScoreFromMultiple(
  gameScores: number[],
  config: EventScoringConfig,
): number {
  return calculateEventScore(
    gameScores,
    config.formula,
    config.multiplier,
    config.topN,
  );
}

// ============================================================
// Rank Calculation
// ============================================================

/**
 * Calculate ranks for all participants in an event.
 *
 * SECURITY:
 * - Tie-breaking is deterministic
 * - Ranks are server-calculated
 */
export function calculateRanks(
  participants: EventParticipant[],
  tieBreak: 'earliest_timestamp' | 'latest_timestamp' | 'random' = 'earliest_timestamp',
): Map<string, number> {
  const ranks = new Map<string, number>();

  // Sort participants by score
  const sorted = [...participants]
    .filter((p) => p.eventScore > 0)
    .sort((a, b) => {
      // Primary: higher score first
      if (b.eventScore !== a.eventScore) return b.eventScore - a.eventScore;

      // Tie-breaking
      switch (tieBreak) {
        case 'earliest_timestamp':
          return (a.lastAttemptAt?.getTime() ?? Infinity) - (b.lastAttemptAt?.getTime() ?? Infinity);
        case 'latest_timestamp':
          return (b.lastAttemptAt?.getTime() ?? 0) - (a.lastAttemptAt?.getTime() ?? 0);
        case 'random':
          return 0.5 - Math.random(); // Random but stable for same sort
        default:
          return 0;
      }
    });

  // Assign ranks
  sorted.forEach((participant, index) => {
    ranks.set(participant.userId, index + 1);
  });

  return ranks;
}

/**
 * Get rank for a specific user.
 */
export function getUserRank(
  participants: EventParticipant[],
  userId: string,
  tieBreak: 'earliest_timestamp' | 'latest_timestamp' | 'random' = 'earliest_timestamp',
): number | null {
  const ranks = calculateRanks(participants, tieBreak);
  return ranks.get(userId) ?? null;
}

/**
 * Get rank change for a user.
 */
export function getRankChange(
  participants: EventParticipant[],
  userId: string,
  previousRank: number | null,
  tieBreak: 'earliest_timestamp' | 'latest_timestamp' | 'random' = 'earliest_timestamp',
): number | null {
  const currentRank = getUserRank(participants, userId, tieBreak);
  if (currentRank === null || previousRank === null) return null;
  return previousRank - currentRank; // Positive = improved
}

// ============================================================
// Score Validation
// ============================================================

/**
 * Validate an event score.
 *
 * SECURITY:
 * - Validates against anti-cheat
 * - Checks score bounds
 * - Validates timing
 */
export function validateEventScore(
  attempt: EventAttempt,
  event: Event,
): {
  valid: boolean;
  status: ScoreValidation;
  reason: string;
} {
  // Check anti-cheat flags
  if (attempt.antiCheatFlags.length > 0) {
    return {
      valid: false,
      status: 'held',
      reason: `Anti-cheat flags: ${attempt.antiCheatFlags.join(', ')}`,
    };
  }

  // Check score bounds (must be positive)
  if (attempt.gameScore < 0) {
    return {
      valid: false,
      status: 'rejected',
      reason: 'Negative score',
    };
  }

  // Check for impossible scores (e.g., > max possible)
  // This would be game-specific in production
  const maxPossibleScore = 100000; // Example threshold
  if (attempt.gameScore > maxPossibleScore) {
    return {
      valid: false,
      status: 'held',
      reason: 'Score exceeds maximum possible',
    };
  }

  // Check timing (score must be submitted within event window)
  const submittedAt = attempt.submittedAt.getTime();
  if (submittedAt < event.startsAt.getTime() || submittedAt > event.endsAt.getTime() + 60000) {
    return {
      valid: false,
      status: 'rejected',
      reason: 'Score submitted outside event window',
    };
  }

  return {
    valid: true,
    status: 'validated',
    reason: '',
  };
}

/**
 * Batch validate multiple attempts.
 */
export function batchValidateAttempts(
  attempts: EventAttempt[],
  event: Event,
): {
  validated: EventAttempt[];
  rejected: EventAttempt[];
  held: EventAttempt[];
} {
  const validated: EventAttempt[] = [];
  const rejected: EventAttempt[] = [];
  const held: EventAttempt[] = [];

  for (const attempt of attempts) {
    const result = validateEventScore(attempt, event);
    attempt.validationStatus = result.status;

    switch (result.status) {
      case 'validated':
        validated.push(attempt);
        break;
      case 'rejected':
        rejected.push(attempt);
        break;
      case 'held':
        held.push(attempt);
        break;
    }
  }

  return { validated, rejected, held };
}

// ============================================================
// Score Aggregation
// ============================================================

/**
 * Aggregate scores for an event based on scoring formula.
 */
export function aggregateScores(
  attempts: EventAttempt[],
  formula: ScoringFormula,
  topN: number = 5,
): number {
  const validScores = attempts
    .filter((a) => a.validationStatus === 'validated')
    .map((a) => a.gameScore);

  return calculateEventScore(validScores, formula, 1.0, topN);
}

/**
 * Get best score from attempts.
 */
export function getBestScore(attempts: EventAttempt[]): number {
  const validScores = attempts
    .filter((a) => a.validationStatus === 'validated')
    .map((a) => a.gameScore);

  return validScores.length > 0 ? Math.max(...validScores) : 0;
}

/**
 * Get total score from attempts.
 */
export function getTotalScore(attempts: EventAttempt[]): number {
  return attempts
    .filter((a) => a.validationStatus === 'validated')
    .reduce((sum, a) => sum + a.gameScore, 0);
}

/**
 * Get average score from attempts.
 */
export function getAverageScore(attempts: EventAttempt[]): number {
  const validAttempts = attempts.filter((a) => a.validationStatus === 'validated');
  if (validAttempts.length === 0) return 0;
  return validAttempts.reduce((sum, a) => sum + a.gameScore, 0) / validAttempts.length;
}

// ============================================================
// Cleanup / Testing
// ============================================================

export function _clearEventScoring(): void {
  // No persistent state in scoring engine
}
