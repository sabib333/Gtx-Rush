/**
 * Reaction Rush — Game Configuration
 *
 * All game parameters are centralized here.
 * No magic numbers in gameplay code.
 */

export const REACTION_RUSH_VERSION = '1.0.0';

/** Core game modes */
export type GameMode = 'normal' | 'daily_challenge' | 'friend_challenge';

/** Round states */
export type RoundState = 'waiting' | 'target_active' | 'tapped' | 'false_start' | 'missed';

/** Complete game states */
export type GameState =
  | 'idle'
  | 'countdown'
  | 'waiting'
  | 'target_active'
  | 'target_tapped'
  | 'false_start_penalty'
  | 'next_round'
  | 'game_complete'
  | 'result'
  | 'paused'
  | 'error'
  | 'aborted';

/** Input event types for a round */
export type InputEventType =
  | 'round_started'
  | 'target_activated'
  | 'target_tapped'
  | 'false_start'
  | 'round_completed';

export interface InputEvent {
  type: InputEventType;
  timestamp: number; // DOMHighResTimeStamp (relative to page load)
  roundNumber: number;
  data?: Record<string, unknown>;
}

export interface RoundData {
  roundNumber: number;
  state: RoundState;
  targetActivatedAt: number | null;
  targetTappedAt: number | null;
  reactionTimeMs: number | null;
  isFalseStart: boolean;
  events: InputEvent[];
}

export interface GameSession {
  sessionId: string;
  gameVersion: string;
  mode: GameMode;
  challengeId?: string;
  opponentUserId?: string;
  targetScore?: number;
  startedAt: number;
  rounds: RoundData[];
  currentRound: number;
  totalRounds: number;
  isComplete: boolean;
}

export interface GameResult {
  score: number;
  accuracy: number;
  averageReactionTime: number;
  bestReactionTime: number;
  worstReactionTime: number;
  falseStarts: number;
  completedRounds: number;
  totalRounds: number;
  breakdown: {
    roundScores: number[];
    speedBonus: number;
    accuracyBonus: number;
    penalty: number;
  };
  metadata: Record<string, unknown>;
  events: InputEvent[];
  durationMs: number;
}

/**
 * Default game configuration.
 * All values are configurable and can be overridden.
 */
export const REACTION_RUSH_CONFIG = {
  /** Number of rounds per game */
  totalRounds: 5,

  /** Minimum delay before target appears (ms) */
  minDelayMs: 1500,

  /** Maximum delay before target appears (ms) */
  maxDelayMs: 5000,

  /** Target display duration — max time to tap (ms) */
  targetTimeoutMs: 4000,

  /** Minimum human reaction time (ms) — below this is suspicious */
  minReactionTimeMs: 100,

  /** Maximum reasonable reaction time (ms) */
  maxReactionTimeMs: 3000,

  /** Target size as percentage of game area width */
  targetSizePercent: 18,

  /** Target safe margin from edges (px) */
  targetMarginPx: 40,

  /** False start penalty (subtracted from total score) */
  falseStartPenalty: 100,

  /** Speed bonus threshold (ms) — bonus awarded for reactions faster than this */
  speedBonusThresholdMs: 300,

  /** Speed bonus points */
  speedBonusPoints: 50,

  /** Perfect round bonus — awarded when reaction < 200ms */
  perfectRoundBonus: 100,

  /** Countdown duration in seconds */
  countdownDuration: 3,

  /** Pause/resume allowed */
  allowPause: true,

  /** Max pause duration (ms) before auto-abort */
  maxPauseDurationMs: 60_000,

  /** Target colors */
  targetColors: {
    active: '#22c55e',    // green — go!
    waiting: '#ef4444',   // red — wait
    falseStart: '#f97316', // orange — false start
  },

  /** Background color */
  backgroundColor: '#0f172a',

  /** Score display */
  maxDisplayScore: 99999,
} as const;

/**
 * Scoring formula:
 *
 * Per round:
 *   reaction_score = round(1000 * (1 - (reactionTime - min) / (max - min)))
 *   speed_bonus = reactionTime < threshold ? bonusPoints : 0
 *   perfect_bonus = reactionTime < 200 ? perfectBonus : 0
 *   false_start_penalty = isFalseStart ? penalty : 0
 *
 * Final:
 *   total = sum(round_scores) + speed_bonuses + perfect_bonuses - false_start_penalties
 *   accuracy = completed_rounds / total_rounds
 */
export function calculateRoundScore(
  reactionTimeMs: number,
  isFalseStart: boolean
): { score: number; speedBonus: number; perfectBonus: number; penalty: number } {
  const { minReactionTimeMs, maxReactionTimeMs, speedBonusThresholdMs, speedBonusPoints, perfectRoundBonus, falseStartPenalty } = REACTION_RUSH_CONFIG;

  if (isFalseStart) {
    return { score: 0, speedBonus: 0, perfectBonus: 0, penalty: falseStartPenalty };
  }

  if (reactionTimeMs < minReactionTimeMs || reactionTimeMs > maxReactionTimeMs) {
    return { score: 0, speedBonus: 0, perfectBonus: 0, penalty: 0 };
  }

  const normalized = 1 - (reactionTimeMs - minReactionTimeMs) / (maxReactionTimeMs - minReactionTimeMs);
  const score = Math.round(normalized * 1000);

  const speedBonus = reactionTimeMs < speedBonusThresholdMs ? speedBonusPoints : 0;
  const perfectBonus = reactionTimeMs < 200 ? perfectRoundBonus : 0;

  return { score, speedBonus, perfectBonus, penalty: 0 };
}

/**
 * Calculate the complete game result from round data.
 */
export function calculateGameResult(
  rounds: RoundData[],
  startedAt: number,
  endedAt: number
): GameResult {
  const roundScores: number[] = [];
  let totalSpeedBonus = 0;
  let totalPerfectBonus = 0;
  let totalPenalty = 0;
  let totalReactionTime = 0;
  let bestReactionTime = Infinity;
  let worstReactionTime = 0;
  let completedRounds = 0;
  let falseStarts = 0;
  const allEvents: InputEvent[] = [];

  for (const round of rounds) {
    allEvents.push(...round.events);

    if (round.isFalseStart) {
      falseStarts++;
      const { penalty } = calculateRoundScore(0, true);
      totalPenalty += penalty;
      roundScores.push(0);
      continue;
    }

    if (round.reactionTimeMs !== null) {
      completedRounds++;
      const { score, speedBonus, perfectBonus } = calculateRoundScore(round.reactionTimeMs, false);
      roundScores.push(score);
      totalSpeedBonus += speedBonus;
      totalPerfectBonus += perfectBonus;
      totalReactionTime += round.reactionTimeMs;
      bestReactionTime = Math.min(bestReactionTime, round.reactionTimeMs);
      worstReactionTime = Math.max(worstReactionTime, round.reactionTimeMs);
    } else {
      roundScores.push(0);
    }
  }

  const baseScore = roundScores.reduce((a, b) => a + b, 0);
  const score = Math.max(0, baseScore + totalSpeedBonus + totalPerfectBonus - totalPenalty);
  const averageReactionTime = completedRounds > 0 ? Math.round(totalReactionTime / completedRounds) : 0;
  const accuracy = rounds.length > 0 ? completedRounds / rounds.length : 0;

  return {
    score,
    accuracy: Math.round(accuracy * 100),
    averageReactionTime,
    bestReactionTime: bestReactionTime === Infinity ? 0 : bestReactionTime,
    worstReactionTime,
    falseStarts,
    completedRounds,
    totalRounds: rounds.length,
    breakdown: {
      roundScores,
      speedBonus: totalSpeedBonus,
      accuracyBonus: totalPerfectBonus,
      penalty: totalPenalty,
    },
    metadata: {
      averageReactionTime,
      bestReactionTime: bestReactionTime === Infinity ? 0 : bestReactionTime,
      roundsCompleted: completedRounds,
    },
    events: allEvents,
    durationMs: endedAt - startedAt,
  };
}

/**
 * Get a random delay before target appears.
 */
export function getRandomDelay(): number {
  const { minDelayMs, maxDelayMs } = REACTION_RUSH_CONFIG;
  return Math.random() * (maxDelayMs - minDelayMs) + minDelayMs;
}

/**
 * Get a random position for the target within the game area.
 */
export function getRandomTargetPosition(
  areaWidth: number,
  areaHeight: number,
  targetSize: number
): { x: number; y: number } {
  const margin = REACTION_RUSH_CONFIG.targetMarginPx;
  const x = margin + Math.random() * (areaWidth - targetSize - margin * 2);
  const y = margin + Math.random() * (areaHeight - targetSize - margin * 2);
  return { x, y };
}
