import type { GameInput } from '@gtx-rush/types';
import type { GameSessionData, AntiCheatRule, AntiCheatResult } from './types';
import { ANTI_CHEAT_CONFIG } from '@gtx-rush/config';

/**
 * Global anti-cheat rules that apply to ALL games.
 * Game-specific rules are defined in each game's validation.ts.
 */

const inputFloodRule: AntiCheatRule = {
  name: 'INPUT_FLOOD',
  severity: 'high',
  check: (session, inputs): AntiCheatResult => {
    if (inputs.length < 2) return { passed: true };

    const timeSpan = inputs[inputs.length - 1]!.timestamp - inputs[0]!.timestamp;
    if (timeSpan <= 0) return { passed: false, flag: 'INPUT_FLOOD' };

    const rate = inputs.length / (timeSpan / 1000);
    if (rate > ANTI_CHEAT_CONFIG.maxInputsPerSecond) {
      return {
        passed: false,
        flag: 'INPUT_FLOOD',
        details: { rate, max: ANTI_CHEAT_CONFIG.maxInputsPerSecond },
      };
    }
    return { passed: true };
  },
};

const impossibleTimingRule: AntiCheatRule = {
  name: 'IMPOSSIBLE_TIMING',
  severity: 'critical',
  check: (_session, inputs): AntiCheatResult => {
    if (inputs.length < 3) return { passed: true };

    // Check if all timestamps are identical (bot behavior)
    const timestamps = inputs.map((i) => i.timestamp);
    const unique = new Set(timestamps);
    if (unique.size === 1) {
      return {
        passed: false,
        flag: 'IMPOSSIBLE_TIMING',
        details: { identicalTimestamps: timestamps.length },
      };
    }

    return { passed: true };
  },
};

const duplicateSequenceRule: AntiCheatRule = {
  name: 'DUPLICATE_SEQUENCE',
  severity: 'medium',
  check: (_session, inputs): AntiCheatResult => {
    const sequences = inputs.map((i) => i.sequence);
    const unique = new Set(sequences);
    if (unique.size < sequences.length) {
      return {
        passed: false,
        flag: 'DUPLICATE_SEQUENCE',
        details: { total: sequences.length, unique: unique.size },
      };
    }
    return { passed: true };
  },
};

const sessionExpiredRule: AntiCheatRule = {
  name: 'SESSION_EXPIRED',
  severity: 'critical',
  check: (session): AntiCheatResult => {
    const elapsed = Date.now() - session.startedAt.getTime();
    if (elapsed > ANTI_CHEAT_CONFIG.maxSessionDurationMs) {
      return {
        passed: false,
        flag: 'SESSION_EXPIRED',
        details: { elapsed, max: ANTI_CHEAT_CONFIG.maxSessionDurationMs },
      };
    }
    return { passed: true };
  },
};

export const GLOBAL_ANTI_CHEAT_RULES: AntiCheatRule[] = [
  inputFloodRule,
  impossibleTimingRule,
  duplicateSequenceRule,
  sessionExpiredRule,
];

/**
 * Run all global anti-cheat rules against a session.
 */
export function runGlobalAntiCheat(
  session: GameSessionData,
  inputs: GameInput[]
): { passed: boolean; flags: string[] } {
  const flags: string[] = [];

  for (const rule of GLOBAL_ANTI_CHEAT_RULES) {
    const result = rule.check(session, inputs);
    if (!result.passed && result.flag) {
      flags.push(result.flag);
    }
  }

  const hasCritical = flags.some((f) =>
    ['IMPOSSIBLE_TIMING', 'SESSION_EXPIRED'].includes(f)
  );

  return {
    passed: !hasCritical,
    flags,
  };
}
