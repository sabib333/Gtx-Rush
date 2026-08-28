/**
 * Tap Rush — Frontend Types
 */

export type GameMode = 'normal' | 'daily_challenge' | 'friend_challenge';

export type GameState =
  | 'idle'
  | 'countdown'
  | 'active'
  | 'paused'
  | 'time_up'
  | 'result'
  | 'error'
  | 'aborted';

export type TargetType = 'normal' | 'bonus';

export interface Target {
  id: string;
  type: TargetType;
  x: number;
  y: number;
  size: number;
  spawnTimestamp: number;
  state: 'active' | 'hit' | 'missed' | 'expired';
}

export type InputEventType =
  | 'session_started'
  | 'target_spawned'
  | 'target_hit'
  | 'target_missed'
  | 'invalid_tap'
  | 'session_finished';

export interface InputEvent {
  type: InputEventType;
  timestamp: number;
  targetId?: string;
  targetType?: TargetType;
  targetPosition?: { x: number; y: number };
  tapPosition?: { x: number; y: number };
  combo?: number;
  data?: Record<string, unknown>;
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
  validTaps: number;
  invalidTaps: number;
  accuracy: number;
  highestCombo: number;
  tapsPerSecond: number;
  bonusTaps: number;
  breakdown: {
    baseScore: number;
    comboBonus: number;
    bonusTargetScore: number;
    invalidTapPenalty: number;
  };
  metadata: Record<string, unknown>;
  events: InputEvent[];
  durationMs: number;
}

/** Config constants (mirrored from packages/config for frontend use) */
export const TAP_RUSH_CONFIG = {
  durationMs: 15_000,
  countdownDuration: 3,
  targetSizePx: 56,
  minTargetDistancePx: 100,
  safeMarginPx: 60,
  minSpawnDelayMs: 50,
  maxSpawnDelayMs: 300,
  targetLifetimeMs: 3_000,
  normalTargetPoints: 100,
  bonusTargetPoints: 500,
  invalidTapPenalty: 50,
  comboMultiplierBase: 1.0,
  comboMultiplierIncrement: 0.1,
  comboMultiplierMax: 3.0,
  comboThreshold: 3,
  comboBreakReduction: 5,
  comboResetOnInvalid: false,
  bonusTargetProbability: 0.1,
  backgroundColor: '#0f172a',
  targetColors: {
    normal: '#22c55e',
    bonus: '#f59e0b',
    hit: '#3b82f6',
    invalid: '#ef4444',
  },
} as const;

export function calculateComboMultiplier(combo: number): number {
  if (combo < TAP_RUSH_CONFIG.comboThreshold) {
    return 1.0;
  }
  const effectiveCombo = combo - TAP_RUSH_CONFIG.comboThreshold;
  const rawMultiplier =
    TAP_RUSH_CONFIG.comboMultiplierBase +
    effectiveCombo * TAP_RUSH_CONFIG.comboMultiplierIncrement;
  return Math.min(rawMultiplier, TAP_RUSH_CONFIG.comboMultiplierMax);
}

export function calculateTapScore(
  targetType: TargetType,
  combo: number,
): { points: number; multiplier: number } {
  const basePoints =
    targetType === 'bonus'
      ? TAP_RUSH_CONFIG.bonusTargetPoints
      : TAP_RUSH_CONFIG.normalTargetPoints;
  const multiplier = calculateComboMultiplier(combo);
  const points = Math.round(basePoints * multiplier);
  return { points, multiplier };
}

export function generateTargetPosition(
  areaWidth: number,
  areaHeight: number,
  targetSize: number,
  previousPosition?: { x: number; y: number },
): { x: number; y: number } {
  const margin = TAP_RUSH_CONFIG.safeMarginPx;
  const minX = margin;
  const maxX = Math.max(minX, areaWidth - targetSize - margin);
  const minY = margin;
  const maxY = Math.max(minY, areaHeight - targetSize - margin);

  if (minX >= maxX || minY >= maxY) {
    return { x: areaWidth / 2 - targetSize / 2, y: areaHeight / 2 - targetSize / 2 };
  }

  let x: number;
  let y: number;
  let attempts = 0;

  do {
    x = minX + Math.random() * (maxX - minX);
    y = minY + Math.random() * (maxY - minY);
    attempts++;
  } while (
    previousPosition &&
    attempts < 20 &&
    Math.hypot(x - previousPosition.x, y - previousPosition.y) <
      TAP_RUSH_CONFIG.minTargetDistancePx
  );

  return { x, y };
}

export function isTapOnTarget(
  tapX: number,
  tapY: number,
  targetX: number,
  targetY: number,
  targetSize: number,
): boolean {
  const halfSize = targetSize / 2;
  const hitRadius = halfSize * 1.2;
  const centerX = targetX + halfSize;
  const centerY = targetY + halfSize;
  return Math.hypot(tapX - centerX, tapY - centerY) <= hitRadius;
}

export function getNextSpawnDelay(): number {
  return (
    TAP_RUSH_CONFIG.minSpawnDelayMs +
    Math.random() * (TAP_RUSH_CONFIG.maxSpawnDelayMs - TAP_RUSH_CONFIG.minSpawnDelayMs)
  );
}

export function shouldSpawnBonusTarget(): boolean {
  return Math.random() < TAP_RUSH_CONFIG.bonusTargetProbability;
}
