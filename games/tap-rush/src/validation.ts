/**
 * Tap Rush — Anti-Cheat Validation
 *
 * Rule-based detection for cheating patterns.
 * Results: VALID | SUSPICIOUS | REJECTED
 *
 * Follows GTX Rush Anti-Cheat standards.
 */

import type { AntiCheatRule } from '@gtx-rush/game-engine';
import type { GameSessionData } from '@gtx-rush/game-engine';
import type { GameInput } from '@gtx-rush/types';
import { TAP_RUSH_CONFIG } from './config';

export type CheatVerdict = 'valid' | 'suspicious' | 'rejected';

export interface AntiCheatVerdict {
  verdict: CheatVerdict;
  flags: string[];
  fraudScore: number;
  details: Record<string, unknown>;
}

// ── Rule: Tap rate exceeded (too many taps per second) ───────────────
const tapRateExceeded: AntiCheatRule = {
  name: 'TAP_RATE_EXCEEDED',
  severity: 'high',
  check: (_session, inputs) => {
    const taps = inputs.filter((i) => i.type === 'tap' || i.type === 'target_hit' || i.type === 'invalid_tap');
    if (taps.length < 2) return { passed: true };

    const timeSpan = taps[taps.length - 1]!.timestamp - taps[0]!.timestamp;
    if (timeSpan <= 0) return { passed: false, flag: 'TAP_RATE_EXCEEDED' };

    const rate = taps.length / (timeSpan / 1000);
    if (rate > TAP_RUSH_CONFIG.maxTapRatePerSecond) {
      return {
        passed: false,
        flag: 'TAP_RATE_EXCEEDED',
        details: { rate, max: TAP_RUSH_CONFIG.maxTapRatePerSecond },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Too many taps total ────────────────────────────────────────
const tooManyTaps: AntiCheatRule = {
  name: 'TOO_MANY_TAPS',
  severity: 'medium',
  check: (_session, inputs) => {
    const taps = inputs.filter((i) => i.type === 'tap' || i.type === 'target_hit' || i.type === 'invalid_tap');
    if (taps.length > TAP_RUSH_CONFIG.maxTotalTaps) {
      return {
        passed: false,
        flag: 'TOO_MANY_TAPS',
        details: { total: taps.length, max: TAP_RUSH_CONFIG.maxTotalTaps },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Tap regularity (bot-like intervals) ───────────────────────
const tapRegularity: AntiCheatRule = {
  name: 'TAP_REGULARITY',
  severity: 'high',
  check: (_session, inputs) => {
    const taps = inputs
      .filter((i) => i.type === 'tap' || i.type === 'target_hit' || i.type === 'invalid_tap')
      .sort((a, b) => a.timestamp - b.timestamp);
    if (taps.length < 10) return { passed: true };

    // Check if intervals between taps are suspiciously regular
    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i]!.timestamp - taps[i - 1]!.timestamp);
    }

    // Calculate coefficient of variation
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean === 0) return { passed: false, flag: 'TAP_REGULARITY' };

    const variance =
      intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // Coefficient of variation

    // Very low CV means suspiciously regular (bot-like)
    if (cv < 0.02 && taps.length >= 20) {
      return {
        passed: false,
        flag: 'TAP_REGULARITY',
        details: { coefficientOfVariation: cv, meanInterval: mean },
      };
    }

    return { passed: true };
  },
};

// ── Rule: Impossible tap interval (faster than humanly possible) ─────
const impossibleTapInterval: AntiCheatRule = {
  name: 'IMPOSSIBLE_TAP_INTERVAL',
  severity: 'critical',
  check: (_session, inputs) => {
    const taps = inputs
      .filter((i) => i.type === 'tap' || i.type === 'target_hit' || i.type === 'invalid_tap')
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < taps.length; i++) {
      const interval = taps[i]!.timestamp - taps[i - 1]!.timestamp;
      if (interval < TAP_RUSH_CONFIG.minTapIntervalMs) {
        return {
          passed: false,
          flag: 'IMPOSSIBLE_TAP_INTERVAL',
          details: {
            interval,
            min: TAP_RUSH_CONFIG.minTapIntervalMs,
            index: i,
          },
        };
      }
    }

    return { passed: true };
  },
};

// ── Rule: All taps identical timestamps (replay) ────────────────────
const identicalTimestamps: AntiCheatRule = {
  name: 'IDENTICAL_TIMESTAMPS',
  severity: 'critical',
  check: (_session, inputs) => {
    const taps = inputs.filter((i) => i.type === 'tap' || i.type === 'target_hit' || i.type === 'invalid_tap');
    if (taps.length < 3) return { passed: true };

    const timestamps = taps.map((i) => i.timestamp);
    const unique = new Set(timestamps);
    if (unique.size === 1) {
      return {
        passed: false,
        flag: 'IDENTICAL_TIMESTAMPS',
        details: { count: timestamps.length, time: timestamps[0] },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Target hit without spawn ──────────────────────────────────
const hitWithoutSpawn: AntiCheatRule = {
  name: 'HIT_WITHOUT_SPAWN',
  severity: 'critical',
  check: (_session, inputs) => {
    const spawnedIds = new Set<string>();
    for (const input of inputs) {
      if (input.type === 'target_spawned') {
        spawnedIds.add((input.data as Record<string, unknown>).targetId as string);
      }
    }

    for (const input of inputs) {
      if (input.type === 'target_hit') {
        const targetId = (input.data as Record<string, unknown>).targetId as string;
        if (!spawnedIds.has(targetId)) {
          return {
            passed: false,
            flag: 'HIT_WITHOUT_SPAWN',
            details: { targetId },
          };
        }
      }
    }

    return { passed: true };
  },
};

// ── Rule: Duplicate target IDs ──────────────────────────────────────
const duplicateTargetIds: AntiCheatRule = {
  name: 'DUPLICATE_TARGET_IDS',
  severity: 'critical',
  check: (_session, inputs) => {
    const spawnedIds: string[] = [];
    for (const input of inputs) {
      if (input.type === 'target_spawned') {
        spawnedIds.push((input.data as Record<string, unknown>).targetId as string);
      }
    }

    const unique = new Set(spawnedIds);
    if (unique.size < spawnedIds.length) {
      return {
        passed: false,
        flag: 'DUPLICATE_TARGET_IDS',
        details: { total: spawnedIds.length, unique: unique.size },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Session events out of time bounds ─────────────────────────
const sessionTimeBounds: AntiCheatRule = {
  name: 'SESSION_TIME_BOUNDS',
  severity: 'critical',
  check: (session, inputs) => {
    if (inputs.length < 2) return { passed: true };

    const first = inputs[0]!.timestamp;
    const last = inputs[inputs.length - 1]!.timestamp;
    const sessionDuration = last - first;

    // Session should not exceed game duration + generous buffer
    const maxDuration = TAP_RUSH_CONFIG.durationMs + 5000;
    if (sessionDuration > maxDuration) {
      return {
        passed: false,
        flag: 'SESSION_TIME_BOUNDS',
        details: { duration: sessionDuration, max: maxDuration },
      };
    }

    return { passed: true };
  },
};

// ── Exported rules ───────────────────────────────────────────────────
export const TAP_RUSH_ANTI_CHEAT_RULES: AntiCheatRule[] = [
  tapRateExceeded,
  tooManyTaps,
  tapRegularity,
  impossibleTapInterval,
  identicalTimestamps,
  hitWithoutSpawn,
  duplicateTargetIds,
  sessionTimeBounds,
];

/**
 * Calculate a fraud score from anti-cheat flags.
 * Higher = more suspicious.
 */
export function calculateFraudScore(flags: string[]): number {
  const severityMap: Record<string, number> = {
    TAP_RATE_EXCEEDED: 20,
    TOO_MANY_TAPS: 5,
    TAP_REGULARITY: 20,
    IMPOSSIBLE_TAP_INTERVAL: 100,
    IDENTICAL_TIMESTAMPS: 100,
    HIT_WITHOUT_SPAWN: 100,
    DUPLICATE_TARGET_IDS: 100,
    SESSION_TIME_BOUNDS: 50,
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
  inputs: GameInput[],
): AntiCheatVerdict {
  const flags: string[] = [];

  // Run game-specific rules
  for (const rule of TAP_RUSH_ANTI_CHEAT_RULES) {
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
      rulesChecked: TAP_RUSH_ANTI_CHEAT_RULES.length,
      flagsCount: flags.length,
    },
  };
}
