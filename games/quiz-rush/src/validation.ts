/**
 * Quiz Rush — Anti-Cheat Validation
 *
 * Rule-based detection for cheating patterns.
 * Results: VALID | SUSPICIOUS | REJECTED
 */

import type { AntiCheatRule } from '@gtx-rush/game-engine';
import type { GameSessionData } from '@gtx-rush/game-engine';
import type { GameInput } from '@gtx-rush/types';
import { QUIZ_RUSH_CONFIG } from './config';

export type CheatVerdict = 'valid' | 'suspicious' | 'rejected';

export interface AntiCheatVerdict {
  verdict: CheatVerdict;
  flags: string[];
  fraudScore: number;
  details: Record<string, unknown>;
}

// ── Rule: Answer time too fast (below humanly possible) ──────────────
const answerTooFast: AntiCheatRule = {
  name: 'ANSWER_TOO_FAST',
  severity: 'critical',
  check: (_session, inputs) => {
    for (const input of inputs) {
      if (input.type !== 'answer_submitted') continue;
      const { timeToAnswerMs } = input.data as { timeToAnswerMs: number };
      if (timeToAnswerMs !== undefined && timeToAnswerMs < QUIZ_RUSH_CONFIG.minAnswerTimeMs) {
        return {
          passed: false,
          flag: 'ANSWER_TOO_FAST',
          details: { timeToAnswerMs, min: QUIZ_RUSH_CONFIG.minAnswerTimeMs },
        };
      }
    }
    return { passed: true };
  },
};

// ── Rule: Suspiciously consistent answer timing (automation) ──────────
const consistentTiming: AntiCheatRule = {
  name: 'CONSISTENT_TIMING',
  severity: 'high',
  check: (_session, inputs) => {
    const answerTimes = inputs
      .filter((i) => i.type === 'answer_submitted')
      .map((i) => (i.data as { timeToAnswerMs: number }).timeToAnswerMs)
      .filter((t) => t !== undefined);

    if (answerTimes.length < 4) return { passed: true };

    // Calculate coefficient of variation
    const mean = answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length;
    if (mean === 0) return { passed: false, flag: 'CONSISTENT_TIMING' };

    const variance =
      answerTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / answerTimes.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    // Very low CV means suspiciously regular intervals
    if (cv < 0.02 && answerTimes.length >= 5) {
      return {
        passed: false,
        flag: 'CONSISTENT_TIMING',
        details: { coefficientOfVariation: cv, mean, samples: answerTimes.length },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Duplicate question answered ────────────────────────────────
const duplicateAnswer: AntiCheatRule = {
  name: 'DUPLICATE_ANSWER',
  severity: 'critical',
  check: (_session, inputs) => {
    const answeredIds = inputs
      .filter((i) => i.type === 'answer_submitted' || i.type === 'timeout')
      .map((i) => (i.data as { questionId: string }).questionId);

    const unique = new Set(answeredIds);
    if (unique.size < answeredIds.length) {
      return {
        passed: false,
        flag: 'DUPLICATE_ANSWER',
        details: { total: answeredIds.length, unique: unique.size },
      };
    }
    return { passed: true };
  },
};

// ── Rule: All answers identical timestamps (replay) ─────────────────
const identicalTimestamps: AntiCheatRule = {
  name: 'IDENTICAL_TIMESTAMPS',
  severity: 'critical',
  check: (_session, inputs) => {
    const answers = inputs.filter(
      (i) => i.type === 'answer_submitted' || i.type === 'timeout'
    );
    if (answers.length < 3) return { passed: true };

    const timestamps = answers.map((i) => i.timestamp);
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

// ── Rule: Answer submitted before question shown ────────────────────
const answerBeforeQuestion: AntiCheatRule = {
  name: 'ANSWER_BEFORE_QUESTION',
  severity: 'critical',
  check: (_session, inputs) => {
    const questionShown = new Map<number, number>(); // sequence -> timestamp
    const questionAnswered = new Map<number, number>(); // sequence -> timestamp

    for (const input of inputs) {
      const seq = (input.data as Record<string, unknown>).questionSequence as number;
      if (seq === undefined) continue;

      if (input.type === 'question_shown') {
        questionShown.set(seq, input.timestamp);
      }
      if (input.type === 'answer_submitted' || input.type === 'timeout') {
        questionAnswered.set(seq, input.timestamp);
      }
    }

    for (const [seq, answerTime] of questionAnswered) {
      const shownTime = questionShown.get(seq);
      if (shownTime !== undefined && answerTime < shownTime) {
        return {
          passed: false,
          flag: 'ANSWER_BEFORE_QUESTION',
          details: { sequence: seq, shownAt: shownTime, answeredAt: answerTime },
        };
      }
    }
    return { passed: true };
  },
};

// ── Rule: Session too many questions (modified game) ────────────────
const tooManyQuestions: AntiCheatRule = {
  name: 'TOO_MANY_QUESTIONS',
  severity: 'high',
  check: (_session, inputs) => {
    const answerCount = inputs.filter(
      (i) => i.type === 'answer_submitted' || i.type === 'timeout'
    ).length;

    if (answerCount > QUIZ_RUSH_CONFIG.questionCount + 5) {
      return {
        passed: false,
        flag: 'TOO_MANY_QUESTIONS',
        details: { total: answerCount, max: QUIZ_RUSH_CONFIG.questionCount + 5 },
      };
    }
    return { passed: true };
  },
};

// ── Rule: Session out of time bounds ────────────────────────────────
const sessionTimeBounds: AntiCheatRule = {
  name: 'SESSION_TIME_BOUNDS',
  severity: 'critical',
  check: (_session, inputs) => {
    if (inputs.length < 2) return { passed: true };

    const first = inputs[0]!.timestamp;
    const last = inputs[inputs.length - 1]!.timestamp;
    const sessionDuration = last - first;

    // Session should not exceed max questions * max time per question + buffer
    const maxDuration =
      QUIZ_RUSH_CONFIG.questionCount * QUIZ_RUSH_CONFIG.defaultTimeLimitMs * 1.5 + 30_000;

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

// ── Rule: Identical answer pattern (same option selected every time) ──
const identicalAnswerPattern: AntiCheatRule = {
  name: 'IDENTICAL_ANSWER_PATTERN',
  severity: 'medium',
  check: (_session, inputs) => {
    const options = inputs
      .filter((i) => i.type === 'answer_submitted')
      .map((i) => (i.data as { selectedOptionId: string }).selectedOptionId)
      .filter((o) => o !== undefined);

    if (options.length < 6) return { passed: true };

    const unique = new Set(options);
    if (unique.size === 1) {
      return {
        passed: false,
        flag: 'IDENTICAL_ANSWER_PATTERN',
        details: { selectedOption: options[0], count: options.length },
      };
    }
    return { passed: true };
  },
};

// ── Exported rules ───────────────────────────────────────────────────
export const QUIZ_RUSH_ANTI_CHEAT_RULES: AntiCheatRule[] = [
  answerTooFast,
  consistentTiming,
  duplicateAnswer,
  identicalTimestamps,
  answerBeforeQuestion,
  tooManyQuestions,
  sessionTimeBounds,
  identicalAnswerPattern,
];

/**
 * Calculate a fraud score from anti-cheat flags.
 */
export function calculateFraudScore(flags: string[]): number {
  const severityMap: Record<string, number> = {
    ANSWER_TOO_FAST: 100,
    CONSISTENT_TIMING: 20,
    DUPLICATE_ANSWER: 100,
    IDENTICAL_TIMESTAMPS: 100,
    ANSWER_BEFORE_QUESTION: 100,
    TOO_MANY_QUESTIONS: 20,
    SESSION_TIME_BOUNDS: 50,
    IDENTICAL_ANSWER_PATTERN: 10,
    INPUT_FLOOD: 20,
    IMPOSSIBLE_TIMING: 100,
    DUPLICATE_SEQUENCE: 10,
    SESSION_EXPIRED: 100,
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

  for (const rule of QUIZ_RUSH_ANTI_CHEAT_RULES) {
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
      rulesChecked: QUIZ_RUSH_ANTI_CHEAT_RULES.length,
      flagsCount: flags.length,
    },
  };
}
