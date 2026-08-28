/**
 * Reaction Rush — Frontend Types
 */

export type GameMode = 'normal' | 'daily_challenge' | 'friend_challenge';

export type RoundState = 'waiting' | 'target_active' | 'tapped' | 'false_start' | 'missed';

export type GameState =
  | 'idle'
  | 'countdown'
  | 'waiting'
  | 'playing'
  | 'game_complete'
  | 'result'
  | 'paused'
  | 'error'
  | 'aborted';

export type InputEventType =
  | 'round_started'
  | 'target_activated'
  | 'target_tapped'
  | 'false_start'
  | 'round_completed';

export interface InputEvent {
  type: InputEventType;
  timestamp: number;
  roundNumber: number;
  data?: Record<string, unknown>;
}

export interface RoundData {
  roundNumber: number;
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
  events: InputEvent[];
  durationMs: number;
}

/** Config constants (mirrored from packages/config for frontend use) */
export const REACTION_RUSH_CONFIG = {
  totalRounds: 5,
  minDelayMs: 1500,
  maxDelayMs: 5000,
  targetTimeoutMs: 4000,
  minReactionTimeMs: 100,
  maxReactionTimeMs: 3000,
  targetMarginPx: 40,
  falseStartPenalty: 100,
  speedBonusThresholdMs: 300,
  speedBonusPoints: 50,
  perfectRoundBonus: 100,
  countdownDuration: 3,
  targetColors: {
    active: '#22c55e',
    waiting: '#ef4444',
    falseStart: '#f97316',
  },
  backgroundColor: '#0f172a',
} as const;

export function calculateRoundScore(reactionTimeMs: number, isFalseStart: boolean) {
  const { minReactionTimeMs, maxReactionTimeMs, speedBonusThresholdMs, speedBonusPoints, falseStartPenalty } = REACTION_RUSH_CONFIG;

  if (isFalseStart) {
    return { score: 0, speedBonus: 0, perfectBonus: 0, penalty: falseStartPenalty };
  }

  if (reactionTimeMs < minReactionTimeMs || reactionTimeMs > maxReactionTimeMs) {
    return { score: 0, speedBonus: 0, perfectBonus: 0, penalty: 0 };
  }

  const normalized = 1 - (reactionTimeMs - minReactionTimeMs) / (maxReactionTimeMs - minReactionTimeMs);
  const score = Math.round(normalized * 1000);
  const speedBonus = reactionTimeMs < speedBonusThresholdMs ? speedBonusPoints : 0;
  const perfectBonus = reactionTimeMs < 200 ? REACTION_RUSH_CONFIG.perfectRoundBonus : 0;

  return { score, speedBonus, perfectBonus, penalty: 0 };
}

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

  for (const round of rounds) {
    if (round.isFalseStart) {
      falseStarts++;
      totalPenalty += REACTION_RUSH_CONFIG.falseStartPenalty;
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
    events: [],
    durationMs: endedAt - startedAt,
  };
}
