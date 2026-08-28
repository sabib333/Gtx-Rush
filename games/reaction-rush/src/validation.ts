/**
 * Reaction Rush — Anti-Cheat Validation
 *
 * Rule-based detection for cheating patterns.
 * Results: VALID | SUSPICIOUS | REJECTED
 */

import type { AntiCheatRule } from '@gtx-rush/game-engine';
import type { GameSessionData } from '@gtx-rush/game-engine';
import type { GameInput } from '@gtx-rush/types';
import { REACTION_RUSH_CONFIG } from './config';

export type CheatVerdict = 'valid' | 'suspicious' | 'rejected';

export interface AntiCheatVerdict {
  verdict: CheatVerdict;
  flags: string[];
  fraudScore: number;
  details: Record<string, unknown>;
}

// ── Rule: Reaction time too fast (below human limit) ──────────────────
const reactionTooFast: AntiCheatRule = {
  name: 'REACTION_TOO_FAST',
  severity: 'critical',
  check: (_session, inputs) => {
    for (const input of inputs) {
      if (input.type !== 'target_tapped') continue;
      const { reactionTimeMs } = input.data as { reactionTimeMs: number };
      if (reactionTimeMs !== undefined && reactionTimeMs < REACTION_RUSH_CONFIG.minReactionTimeMs) {
        return {
          passed: false,
          flag: 'REACTION_TOO_FAST',
          details: { reactionTimeMs, min: REACTION_RUSH_CONFIG.minReactionTimeMs },
        };
      }
    }
    return { passed: true };
  },
};

// ── Rule: Reaction time too slow (beyond reasonable) ──────────────────
const reactionTooSlow: AntiCheatRule = {
  name: 'REACTION_TOO_SLOW',
  severity: 'low',
  check: (_session, inputs) => {
    for (const input of inputs) {
      if (input.type !== 'target_tapped') continue;
      const { reactionTimeMs } = input.data as { reactionTimeMs: number };
      if (reactionTimeMs !== undefined && reactionTimeMs > REACTION_RUSH_CONFIG.maxReactionTimeMs) {
        return {
          passed: false,
          flag: 'REACTION_TOO_SLOW',
          details: { reactionTimeMs, max: REACTION_RUSH_CONFIG.maxReactionTimeMs },
        };
      }
    }
    return { passed: true };
  },
};

// ── Rule: Identical reaction times (bot/automation) ──────────────────
const identicalReactionTimes: AntiCheatRule = {
  name: 'IDENTICAL_REACTION_TIMES',
  severity: 'high',
  check: (_session, inputs) => {
    const reactionTimes = inputs
      .filter((i) => i.type === 'target_tapped')
      .map((i) => (i.data as { reactionTimeMs: number }).reactionTimeMs)
      .filter((t) => t !== undefined);

    if (reactionTimes.length < 3) return { passed: true };

    const unique = new Set(reactionTimes);
    if (unique.size === 1) {
      return {
        passed: false,
        flag: 'IDENTICAL_REACTION_TIMES',
        details: { count: reactionTimes.length, time: reactionTimes[0] },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Suspiciously regular timing intervals (automation) ──────────
const regularTimingPattern: AntiCheatRule = {
  name: 'REGULAR_TIMING_PATTERN',
  severity: 'high',
  check: (_session, inputs) => {
    const taps = inputs
      .filter((i) => i.type === 'target_tapped')
      .sort((a, b) => a.timestamp - b.timestamp);

    if (taps.length < 5) return { passed: true };

    // Calculate variance in reaction times
    const times = taps.map((i) => (i.data as { reactionTimeMs: number }).reactionTimeMs);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation — very low means suspiciously consistent
    const cv = mean > 0 ? stdDev / mean : 0;

    if (cv < 0.02 && times.length >= 5) {
      return {
        passed: false,
        flag: 'REGULAR_TIMING_PATTERN',
        details: { coefficientOfVariation: cv, mean, stdDev, samples: times.length },
      };
    }
    return { passed: true };
  },
};

// ── Rule: False start frequency too high ──────────────────────────────
const excessiveFalseStarts: AntiCheatRule = {
  name: 'EXCESSIVE_FALSE_STARTS',
  severity: 'medium',
  check: (_session, inputs) => {
    const falseStarts = inputs.filter((i) => i.type === 'false_start').length;
    const totalRounds = new Set(inputs.map((i) => (i.data as { roundNumber: number }).roundNumber)).size;

    if (totalRounds > 0 && falseStarts / totalRounds > 0.8) {
      return {
        passed: false,
        flag: 'EXCESSIVE_FALSE_STARTS',
        details: { falseStarts, totalRounds, ratio: falseStarts / totalRounds },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Modified round count ────────────────────────────────────────
const invalidRoundCount: AntiCheatRule = {
  name: 'INVALID_ROUND_COUNT',
  severity: 'critical',
  check: (_session, inputs) => {
    const roundNumbers = new Set(inputs.map((i) => (i.data as { roundNumber: number }).roundNumber));
    const expected = REACTION_RUSH_CONFIG.totalRounds;

    if (roundNumbers.size > expected) {
      return {
        passed: false,
        flag: 'INVALID_ROUND_COUNT',
        details: { actual: roundNumbers.size, expected },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Missing required events ─────────────────────────────────────
const missingEvents: AntiCheatRule = {
  name: 'MISSING_EVENTS',
  severity: 'medium',
  check: (_session, inputs) => {
    const roundNumbers = new Set(inputs.map((i) => (i.data as { roundNumber: number }).roundNumber));

    for (const roundNum of roundNumbers) {
      const roundInputs = inputs.filter(
        (i) => (i.data as { roundNumber: number }).roundNumber === roundNum
      );
      const types = new Set(roundInputs.map((i) => i.type));

      // Each round must have round_started
      if (!types.has('round_started')) {
        return {
          passed: false,
          flag: 'MISSING_EVENTS',
          details: { round: roundNum, missing: 'round_started' },
        };
      }

      // If target was tapped, must have target_activated
      if (types.has('target_tapped') && !types.has('target_activated')) {
        return {
          passed: false,
          flag: 'MISSING_EVENTS',
          details: { round: roundNum, missing: 'target_activated' },
        };
      }
    }
    return { passed: true };
  },
};

// ── Exported rules ────────────────────────────────────────────────────
export const REACTION_RUSH_ANTI_CHEAT_RULES: AntiCheatRule[] = [
  reactionTooFast,
  reactionTooSlow,
  identicalReactionTimes,
  regularTimingPattern,
  excessiveFalseStarts,
  invalidRoundCount,
  missingEvents,
];

/**
 * Calculate a fraud score from anti-cheat flags.
 * Higher = more suspicious.
 */
export function calculateFraudScore(flags: string[]): number {
  const severityMap: Record<string, number> = {
    REACTION_TOO_FAST: 100,
    INVALID_ROUND_COUNT: 100,
    IDENTICAL_REACTION_TIMES: 20,
    REGULAR_TIMING_PATTERN: 20,
    MISSING_EVENTS: 5,
    EXCESSIVE_FALSE_STARTS: 5,
    REACTION_TOO_SLOW: 1,
    INPUT_FLOOD: 20,
    IMPOSSIBLE_TIMING: 100,
    DUPLICATE_SEQUENCE: 10,
    SESSION_EXPIRED: 100,
    SESSION_DURATION_EXCEEDED: 50,
  };

  return flags.reduce((score, flag) => score + (severityMap[flag] ?? 1), 0);
}

/**
 * Determine verdict from fraud score.
 */
export function getVerdict(fraudScore: number): CheatVerdict {
  if (fraudScore >= 100) return 'rejected';
  if (fraudScore >= 10) return 'suspicious';
  return 'valid';
}

/**
 * Run full anti-cheat check on a session.
 */
export function runAntiCheat(
  session: GameSessionData,
  inputs: GameInput[]
): AntiCheatVerdict {
  const flags: string[] = [];

  // Run game-specific rules
  for (const rule of REACTION_RUSH_ANTI_CHEAT_RULES) {
    const result = rule.check(session, inputs);
    if (!result.passed && result.flag) {
      flags.push(result.flag);
    }
  }

  const fraudScore = calculateFraudScore(flags);
  const verdict = getVerdict(fraudScore);

  return {
    verdict,
    flags,
    fraudScore,
    details: {
      rulesChecked: REACTION_RUSH_ANTI_CHEAT_RULES.length,
      flagsCount: flags.length,
    },
  };
}
