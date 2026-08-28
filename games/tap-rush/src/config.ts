/**
 * Tap Rush — Game Configuration
 *
 * All game parameters are centralized here.
 * No magic numbers in gameplay code.
 *
 * GTX Rush — Tap Rush Game Contract v1.0
 */

// ── Version ──────────────────────────────────────────────────────────
export const TAP_RUSH_VERSION = '1.0.0';

// ── Game Modes ───────────────────────────────────────────────────────
export type GameMode = 'normal' | 'daily_challenge' | 'friend_challenge';

// ── Game State Machine ───────────────────────────────────────────────
export type GameState =
  | 'idle'
  | 'countdown'
  | 'active'
  | 'paused'
  | 'time_up'
  | 'result'
  | 'error'
  | 'aborted';

// ── Target Types ─────────────────────────────────────────────────────
export type TargetType = 'normal' | 'bonus';

export interface Target {
  id: string;
  type: TargetType;
  x: number;
  y: number;
  size: number;
  spawnTimestamp: number; // monotonic (DOMHighResTimeStamp)
  state: 'active' | 'hit' | 'missed' | 'expired';
}

// ── Tap Events ───────────────────────────────────────────────────────
export type InputEventType =
  | 'session_started'
  | 'target_spawned'
  | 'target_hit'
  | 'target_missed'
  | 'invalid_tap'
  | 'session_finished';

export interface InputEvent {
  type: InputEventType;
  timestamp: number; // monotonic
  targetId?: string;
  targetType?: TargetType;
  targetPosition?: { x: number; y: number };
  tapPosition?: { x: number; y: number };
  combo?: number;
  data?: Record<string, unknown>;
}

// ── Target Position Generation ───────────────────────────────────────
export interface TargetBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ── Scoring Result ───────────────────────────────────────────────────
export interface TapRushGameResult {
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

// ── Session Data ─────────────────────────────────────────────────────
export interface TapRushSession {
  sessionId: string;
  gameVersion: string;
  mode: GameMode;
  challengeId?: string;
  opponentUserId?: string;
  targetScore?: number;
  startedAt: number;
  targets: Target[];
  currentTargetId: string | null;
  score: number;
  combo: number;
  highestCombo: number;
  validTaps: number;
  invalidTaps: number;
  bonusTaps: number;
  isComplete: boolean;
  events: InputEvent[];
}

// ── Combo State ──────────────────────────────────────────────────────
export interface ComboState {
  current: number;
  highest: number;
  multiplier: number;
}

// ── Centralized Configuration ────────────────────────────────────────
export const TAP_RUSH_CONFIG = {
  // ── Timing ───────────────────────────────────────────────
  /** Game duration in milliseconds (15 seconds) */
  durationMs: 15_000,

  /** Countdown duration in seconds (3-2-1-GO!) */
  countdownDuration: 3,

  // ── Target ───────────────────────────────────────────────
  /** Target size (radius in px) — large enough for mobile */
  targetSizePx: 56,

  /** Minimum distance between consecutive targets (px) */
  minTargetDistancePx: 100,

  /** Safe margin from viewport edges (px) — avoids Telegram nav */
  safeMarginPx: 60,

  /** Minimum delay between target spawns (ms) */
  minSpawnDelayMs: 50,

  /** Maximum delay between target spawns (ms) */
  maxSpawnDelayMs: 300,

  /** Target visibility duration before it expires (ms) */
  targetLifetimeMs: 3_000,

  // ── Scoring ──────────────────────────────────────────────
  /** Points for a valid tap on a normal target */
  normalTargetPoints: 100,

  /** Points for a valid tap on a bonus target */
  bonusTargetPoints: 500,

  /** Points for an invalid tap (negative = penalty) */
  invalidTapPenalty: 50,

  // ── Combo ────────────────────────────────────────────────
  /** Combo multiplier base */
  comboMultiplierBase: 1.0,

  /** Combo multiplier increment per consecutive hit */
  comboMultiplierIncrement: 0.1,

  /** Maximum combo multiplier cap */
  comboMultiplierMax: 3.0,

  /** Combo threshold to start earning multiplier (taps before multiplier kicks in) */
  comboThreshold: 3,

  /** Combo penalty: how many combo points lost on invalid tap */
  comboBreakReduction: 5,

  /** Whether invalid tap resets combo entirely */
  comboResetOnInvalid: false,

  // ── Bonus Targets ────────────────────────────────────────
  /** Probability of spawning a bonus target (0-1) */
  bonusTargetProbability: 0.1,

  // ── Pause ────────────────────────────────────────────────
  /** Allow pause during gameplay */
  allowPause: false,

  /** Max pause duration before auto-abort (ms) */
  maxPauseDurationMs: 30_000,

  // ── Anti-Cheat ───────────────────────────────────────────
  /** Maximum taps per second before flagging */
  maxTapRatePerSecond: 20,

  /** Maximum total taps allowed in a game */
  maxTotalTaps: 500,

  /** Minimum interval between taps (ms) — below this is suspicious */
  minTapIntervalMs: 30,

  /** Coordinate bounds for target generation */
  coordinateBounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 } as TargetBounds,

  // ── Visual ───────────────────────────────────────────────
  backgroundColor: '#0f172a',

  targetColors: {
    normal: '#22c55e',    // green
    bonus: '#f59e0b',     // amber/gold
    hit: '#3b82f6',       // blue flash
    invalid: '#ef4444',   // red flash
  },

  // ── UI ───────────────────────────────────────────────────
  maxDisplayScore: 99999,
} as const;

// ── Derived Types ────────────────────────────────────────────────────
export type TapRushConfig = typeof TAP_RUSH_CONFIG;

// ── Helper: Calculate combo multiplier ───────────────────────────────
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

// ── Helper: Calculate score for a single tap ─────────────────────────
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

// ── Helper: Calculate full game result from events ───────────────────
export function calculateGameResult(
  events: InputEvent[],
  startedAt: number,
  endedAt: number,
): TapRushGameResult {
  let score = 0;
  let combo = 0;
  let highestCombo = 0;
  let validTaps = 0;
  let invalidTaps = 0;
  let bonusTaps = 0;
  let baseScore = 0;
  let comboBonus = 0;
  let bonusTargetScore = 0;
  let invalidTapPenalty = 0;

  for (const event of events) {
    switch (event.type) {
      case 'target_hit': {
        validTaps++;
        combo++;

        if (event.targetType === 'bonus') {
          bonusTaps++;
          const { points, multiplier } = calculateTapScore('bonus', combo);
          const basePoints = TAP_RUSH_CONFIG.bonusTargetPoints;
          bonusTargetScore += basePoints;
          comboBonus += points - basePoints;
          score += points;
        } else {
          const { points, multiplier } = calculateTapScore('normal', combo);
          const basePoints = TAP_RUSH_CONFIG.normalTargetPoints;
          baseScore += basePoints;
          comboBonus += points - basePoints;
          score += points;
        }

        highestCombo = Math.max(highestCombo, combo);
        break;
      }
      case 'invalid_tap': {
        invalidTaps++;
        const penalty = TAP_RUSH_CONFIG.invalidTapPenalty;
        invalidTapPenalty += penalty;
        score = Math.max(0, score - penalty);

        if (TAP_RUSH_CONFIG.comboResetOnInvalid) {
          combo = 0;
        } else {
          combo = Math.max(0, combo - TAP_RUSH_CONFIG.comboBreakReduction);
        }
        break;
      }
      // target_missed doesn't change score, just notes the target expired
    }
  }

  const durationMs = endedAt - startedAt;
  const totalTaps = validTaps + invalidTaps;
  const accuracy = totalTaps > 0 ? validTaps / totalTaps : 0;
  const tapsPerSecond = durationMs > 0 ? totalTaps / (durationMs / 1000) : 0;

  return {
    score: Math.max(0, score),
    validTaps,
    invalidTaps,
    accuracy: Math.round(accuracy * 100),
    highestCombo,
    tapsPerSecond: Math.round(tapsPerSecond * 10) / 10,
    bonusTaps,
    breakdown: {
      baseScore,
      comboBonus,
      bonusTargetScore,
      invalidTapPenalty,
    },
    metadata: {
      averageCombo: validTaps > 0 ? Math.round((validTaps / Math.max(1, validTaps)) * 10) / 10 : 0,
      totalTaps,
    },
    events,
    durationMs,
  };
}

// ── Helper: Generate safe target position ────────────────────────────
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

  // Ensure valid range
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

// ── Helper: Determine if a tap is within target bounds ───────────────
export function isTapOnTarget(
  tapX: number,
  tapY: number,
  targetX: number,
  targetY: number,
  targetSize: number,
): boolean {
  const halfSize = targetSize / 2;
  // Generous hit area for mobile (1.2x target size)
  const hitRadius = halfSize * 1.2;
  const centerX = targetX + halfSize;
  const centerY = targetY + halfSize;
  return Math.hypot(tapX - centerX, tapY - centerY) <= hitRadius;
}

// ── Helper: Determine if a tap is in a dangerous zone ────────────────
export function isInDangerZone(
  _tapX: number,
  _tapY: number,
  _areaWidth: number,
  _areaHeight: number,
): boolean {
  // For now, rely on the safe margin for target placement
  // The game area is already constrained by the layout
  return false;
}

// ── Helper: Get next spawn delay ─────────────────────────────────────
export function getNextSpawnDelay(): number {
  return (
    TAP_RUSH_CONFIG.minSpawnDelayMs +
    Math.random() * (TAP_RUSH_CONFIG.maxSpawnDelayMs - TAP_RUSH_CONFIG.minSpawnDelayMs)
  );
}

// ── Helper: Should spawn bonus target ────────────────────────────────
export function shouldSpawnBonusTarget(): boolean {
  return Math.random() < TAP_RUSH_CONFIG.bonusTargetProbability;
}
